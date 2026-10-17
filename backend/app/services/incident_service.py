import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.db import retry_transient_db_errors
from app.core.errors import (
    DuplicateIncidentError,
    IncidentNotEditableError,
    InvalidTransitionError,
    NotAssigneeError,
    NotFoundError,
    VersionConflictError,
)
from app.core.security import AuthenticatedUser
from app.domain.chat import Notice, ends_assignment, notice_for_transition
from app.domain.incident import (
    EventType,
    Severity,
    Status,
    can_transition,
    default_severity_for,
    is_restricted_to_assignee,
    requires_assignee,
)
from app.models import Incident, IncidentEvent
from app.repositories.event_repository import EventRepository
from app.repositories.handover_repository import HandoverRepository
from app.repositories.incident_repository import IncidentRepository
from app.schemas.incident import (
    IncidentCreate,
    IncidentFilters,
    IncidentRead,
    IncidentSummary,
    IncidentUpdate,
    StatusChange,
)
from app.services.central_feed import CentralFeed, incident_ref

NOTICE_VERB: dict[Notice, str] = {
    Notice.CLAIMED: "assumiu",
    Notice.RESUMED: "retomou a investigação de",
    Notice.RELEASED: "devolveu à fila",
    Notice.CLOSED: "fechou",
    Notice.MARKED_INCONCLUSIVE: "marcou como inconclusivo",
}


@dataclass(frozen=True, slots=True)
class CreationResult:
    incident: Incident
    created: bool


class IncidentService:
    """Casos de uso do incidente. Cada método público é uma transação."""

    def __init__(self, session: Session) -> None:
        self._session = session
        self._incidents = IncidentRepository(session)
        self._events = EventRepository(session)
        self._handovers = HandoverRepository(session)
        self._feed = CentralFeed(session)

    @retry_transient_db_errors
    def list_incidents(self, filters: IncidentFilters) -> tuple[list[Incident], int]:
        with self._session.begin():
            return self._incidents.search(filters)

    @retry_transient_db_errors
    def summarize(self) -> IncidentSummary:
        with self._session.begin():
            return IncidentSummary(
                active_by_severity=self._incidents.count_active_by_severity(),
                by_status=self._incidents.count_by_status(),
            )

    @retry_transient_db_errors
    def get_incident(self, incident_id: uuid.UUID) -> Incident:
        with self._session.begin():
            return self._require(incident_id)

    @retry_transient_db_errors
    def list_events(self, incident_id: uuid.UUID) -> list[IncidentEvent]:
        with self._session.begin():
            self._require(incident_id)
            return self._events.list_for_incident(incident_id)

    @retry_transient_db_errors
    def create_incident(
        self,
        data: IncidentCreate,
        idempotency_key: str | None = None,
        reporter: AuthenticatedUser | None = None,
    ) -> CreationResult:
        """Registra um incidente. Reenvios com a mesma Idempotency-Key não duplicam."""
        if idempotency_key:
            with self._session.begin():
                existing = self._incidents.find_by_idempotency_key(idempotency_key)
            if existing:
                return self._replay(existing, data)

        incident = Incident(
            title=data.title,
            description=data.description,
            category=data.category,
            severity=data.severity or default_severity_for(data.category),
            status=Status.OPEN,
            vehicle_id=data.vehicle_id,
            location=data.location,
            reported_at=data.reported_at or datetime.now(UTC),
            idempotency_key=idempotency_key,
        )
        try:
            with self._session.begin():
                self._incidents.add(incident)
                self._events.record(
                    incident.id,
                    EventType.CREATED,
                    reporter.id if reporter else None,
                    to_status=Status.OPEN,
                )
                self._feed.incident_changed(incident.id)
                if incident.severity == Severity.HIGH:
                    self._feed.post(
                        f"Novo incidente de alta criticidade: {incident_ref(incident)}, "
                        f"{incident.location}.",
                        notice=Notice.NEW_HIGH_SEVERITY,
                        incident_id=incident.id,
                    )
        except IntegrityError:
            # Dois reenvios simultâneos com a mesma chave: o segundo perde a corrida
            # no índice único e devolve o registro que o primeiro criou.
            if not idempotency_key:
                raise
            with self._session.begin():
                existing = self._incidents.find_by_idempotency_key(idempotency_key)
            if existing is None:
                raise
            return self._replay(existing, data)
        return CreationResult(incident=incident, created=True)

    @retry_transient_db_errors
    def update_details(
        self, incident_id: uuid.UUID, data: IncidentUpdate, actor: AuthenticatedUser
    ) -> Incident:
        with self._session.begin():
            incident = self._require(incident_id)
            self._ensure_version(incident, data.version)
            if incident.status == Status.CLOSED:
                raise IncidentNotEditableError("Incidentes fechados não podem ser editados.")
            self._ensure_actor_may_change(incident, actor)
            changes = data.changes()
            diff = {
                field: {"from": _plain(getattr(incident, field)), "to": _plain(value)}
                for field, value in changes.items()
                if getattr(incident, field) != value
            }
            updated = self._apply(incident, data.version, changes)
            self._events.record(incident.id, EventType.DETAILS_UPDATED, actor.id, changes=diff)
            self._feed.incident_changed(incident.id)
            return updated

    @retry_transient_db_errors
    def change_status(
        self, incident_id: uuid.UUID, change: StatusChange, actor: AuthenticatedUser
    ) -> Incident:
        try:
            return self._change_status(incident_id, change, actor)
        except (VersionConflictError, NotAssigneeError):
            if change.status == Status.INVESTIGATING:
                self._record_claim_conflict(incident_id, actor)
            raise

    def _change_status(
        self, incident_id: uuid.UUID, change: StatusChange, actor: AuthenticatedUser
    ) -> Incident:
        with self._session.begin():
            incident = self._require(incident_id)
            incident_status_before = incident.status
            self._ensure_version(incident, change.version)
            if not can_transition(incident.status, change.status):
                raise InvalidTransitionError(
                    f"Não é possível mudar de '{incident.status.value}' "
                    f"para '{change.status.value}'.",
                    current_status=incident.status.value,
                )
            self._ensure_actor_may_change(incident, actor)

            values: dict[str, Any] = {"status": change.status}
            if requires_assignee(change.status):
                values["assignee_id"] = actor.id
                # Tempo de resposta conta a partir da primeira vez que alguém assumiu.
                values["first_claimed_at"] = func.coalesce(Incident.first_claimed_at, func.now())
            elif change.status == Status.OPEN:
                values["assignee_id"] = None
            if change.status == Status.CLOSED:
                values["closed_at"] = func.now()
            if change.resolution_note is not None:
                values["resolution_note"] = change.resolution_note

            updated = self._apply(incident, change.version, values)
            self._events.record(
                incident.id,
                EventType.STATUS_CHANGED,
                actor.id,
                from_status=incident_status_before,
                to_status=change.status,
                changes={"resolution_note": change.resolution_note}
                if change.resolution_note
                else None,
            )
            self._announce_status_change(updated, incident_status_before, change.status, actor)
            return updated

    def _announce_status_change(
        self, incident: Incident, previous: Status, target: Status, actor: AuthenticatedUser
    ) -> None:
        notice = notice_for_transition(previous, target)
        self._feed.post(
            f"{actor.display_name} {NOTICE_VERB[notice]} {incident_ref(incident)}.",
            notice=notice,
            author_id=actor.id,
            incident_id=incident.id,
        )
        self._feed.incident_changed(incident.id)
        if ends_assignment(target):
            for handover_id in self._handovers.cancel_pending_for(incident.id):
                self._feed.post(
                    f"Pedido para assumir {incident_ref(incident)} encerrado: o incidente foi "
                    f"{'devolvido à fila' if target == Status.OPEN else 'fechado'}.",
                    notice=Notice.HANDOVER_CANCELLED,
                    incident_id=incident.id,
                    handover_id=handover_id,
                )

    def _record_claim_conflict(self, incident_id: uuid.UUID, actor: AuthenticatedUser) -> None:
        """A tentativa que perdeu a corrida também vira registro visível para a central."""
        with self._session.begin():
            incident = self._incidents.get(incident_id)
            if incident is None or incident.assignee is None or incident.assignee_id == actor.id:
                return
            self._feed.post(
                f"{actor.display_name} tentou assumir {incident_ref(incident)}, mas "
                f"{incident.assignee.display_name} já está investigando.",
                notice=Notice.CLAIM_CONFLICT,
                author_id=actor.id,
                incident_id=incident.id,
            )

    @retry_transient_db_errors
    def delete_incident(self, incident_id: uuid.UUID, version: int) -> None:
        with self._session.begin():
            incident = self._require(incident_id)
            self._ensure_version(incident, version)
            if incident.status != Status.OPEN:
                raise IncidentNotEditableError(
                    "Só incidentes abertos e ainda não assumidos podem ser excluídos."
                )
            if not self._incidents.delete_if_version(incident_id, version):
                self._raise_conflict(incident_id)
            self._feed.incident_changed(incident_id)

    def _apply(self, incident: Incident, version: int, values: dict[str, Any]) -> Incident:
        if not self._incidents.update_if_version(incident.id, version, values):
            self._raise_conflict(incident.id)
        return self._require(incident.id)

    def _require(self, incident_id: uuid.UUID) -> Incident:
        incident = self._incidents.get(incident_id)
        if incident is None:
            raise NotFoundError("Incidente não encontrado. Ele pode ter sido excluído.")
        return incident

    def _ensure_version(self, incident: Incident, expected_version: int) -> None:
        if incident.version != expected_version:
            raise _version_conflict(incident)

    def _raise_conflict(self, incident_id: uuid.UUID) -> None:
        raise _version_conflict(self._require(incident_id))

    @staticmethod
    def _ensure_actor_may_change(incident: Incident, actor: AuthenticatedUser) -> None:
        if (
            is_restricted_to_assignee(incident.status)
            and incident.assignee_id is not None
            and incident.assignee_id != actor.id
        ):
            assignee = incident.assignee.display_name if incident.assignee else "Outro analista"
            raise NotAssigneeError(
                f"{assignee} está investigando este incidente.",
                current=_serialize(incident),
            )

    @staticmethod
    def _replay(existing: Incident, data: IncidentCreate) -> CreationResult:
        same_request = (
            existing.title == data.title
            and existing.category == data.category
            and existing.vehicle_id == data.vehicle_id
        )
        if not same_request:
            raise DuplicateIncidentError(
                "Esta Idempotency-Key já foi usada para registrar outro incidente."
            )
        return CreationResult(incident=existing, created=False)


def _plain(value: object) -> object:
    """Valor serializável em JSON para o diff da auditoria (enums viram texto)."""
    return value.value if isinstance(value, StrEnum) else value


def _serialize(incident: Incident) -> dict[str, Any]:
    return IncidentRead.model_validate(incident).model_dump(mode="json")


def _version_conflict(current: Incident) -> VersionConflictError:
    return VersionConflictError(
        "Este incidente foi alterado por outra pessoa enquanto você o visualizava. "
        "Confira a versão atual antes de tentar novamente.",
        current=_serialize(current),
    )
