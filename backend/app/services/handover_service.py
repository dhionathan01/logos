"""Passagem de incidentes entre analistas: pedir, aceitar, recusar, cancelar, delegar."""

import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.db import retry_transient_db_errors
from app.core.errors import (
    DuplicateHandoverError,
    HandoverNotAllowedError,
    NotAssigneeError,
    NotFoundError,
    VersionConflictError,
)
from app.core.security import AuthenticatedUser
from app.domain.chat import HandoverStatus, MessageKind, Notice, can_be_transferred
from app.domain.incident import EventType
from app.models import HandoverRequest, Incident, User
from app.repositories.event_repository import EventRepository
from app.repositories.handover_repository import HandoverRepository
from app.repositories.incident_repository import IncidentRepository
from app.repositories.user_repository import UserRepository
from app.schemas.chat import DelegateRequest, HandoverCreate
from app.services.central_feed import CentralFeed, incident_ref


class HandoverService:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._incidents = IncidentRepository(session)
        self._handovers = HandoverRepository(session)
        self._users = UserRepository(session)
        self._events = EventRepository(session)
        self._feed = CentralFeed(session)

    @retry_transient_db_errors
    def list_for_incident(self, incident_id: uuid.UUID) -> list[HandoverRequest]:
        with self._session.begin():
            self._require_incident(incident_id)
            return self._handovers.for_incident(incident_id)

    @retry_transient_db_errors
    def request(
        self, incident_id: uuid.UUID, requester: AuthenticatedUser, data: HandoverCreate
    ) -> HandoverRequest:
        try:
            with self._session.begin():
                incident = self._require_incident(incident_id)
                if not can_be_transferred(incident.status) or incident.assignee_id is None:
                    raise HandoverNotAllowedError(
                        "Só dá para pedir um incidente que alguém está investigando. "
                        "Se ele está aberto, basta assumir."
                    )
                if incident.assignee_id == requester.id:
                    raise HandoverNotAllowedError("Este incidente já está com você.")

                handover = self._handovers.add(
                    HandoverRequest(
                        incident_id=incident.id,
                        requester_id=requester.id,
                        owner_id=incident.assignee_id,
                        reason=data.reason,
                    )
                )
                reason = f": “{data.reason}”" if data.reason else "."
                self._feed.post(
                    f"{requester.display_name} pediu para assumir {incident_ref(incident)}{reason}",
                    kind=MessageKind.HANDOVER,
                    notice=Notice.HANDOVER_REQUESTED,
                    author_id=requester.id,
                    incident_id=incident.id,
                    handover_id=handover.id,
                )
                return handover
        except IntegrityError as error:
            # Índice único parcial: outro pedido pendente foi criado antes (ou ao mesmo tempo).
            raise DuplicateHandoverError(
                "Outro analista já pediu este incidente. Aguarde a resposta de quem está com ele."
            ) from error

    @retry_transient_db_errors
    def accept(self, handover_id: uuid.UUID, actor: AuthenticatedUser) -> HandoverRequest:
        with self._session.begin():
            handover = self._require_pending(handover_id)
            self._ensure_is_owner(handover, actor, "aceitar")
            if not self._handovers.resolve(handover.id, HandoverStatus.ACCEPTED):
                raise HandoverNotAllowedError("Este pedido já foi respondido.")
            incident = self._transfer(
                handover.incident_id, handover.owner, handover.requester, via="handover"
            )
            self._feed.post(
                f"{handover.owner.display_name} passou {incident_ref(incident)} "
                f"para {handover.requester.display_name}.",
                notice=Notice.HANDOVER_ACCEPTED,
                author_id=actor.id,
                incident_id=incident.id,
                handover_id=handover.id,
            )
            return self._reload(handover.id)

    @retry_transient_db_errors
    def decline(self, handover_id: uuid.UUID, actor: AuthenticatedUser) -> HandoverRequest:
        with self._session.begin():
            handover = self._require_pending(handover_id)
            self._ensure_is_owner(handover, actor, "recusar")
            if not self._handovers.resolve(handover.id, HandoverStatus.DECLINED):
                raise HandoverNotAllowedError("Este pedido já foi respondido.")
            self._feed.post(
                f"{handover.owner.display_name} vai continuar com "
                f"{incident_ref(handover.incident)} e recusou o pedido de "
                f"{handover.requester.display_name}.",
                notice=Notice.HANDOVER_DECLINED,
                author_id=actor.id,
                incident_id=handover.incident_id,
                handover_id=handover.id,
            )
            return self._reload(handover.id)

    @retry_transient_db_errors
    def cancel(self, handover_id: uuid.UUID, actor: AuthenticatedUser) -> HandoverRequest:
        with self._session.begin():
            handover = self._require_pending(handover_id)
            if handover.requester_id != actor.id:
                raise NotAssigneeError("Só quem fez o pedido pode cancelá-lo.")
            if not self._handovers.resolve(handover.id, HandoverStatus.CANCELLED):
                raise HandoverNotAllowedError("Este pedido já foi respondido.")
            self._feed.post(
                f"{actor.display_name} cancelou o pedido para assumir "
                f"{incident_ref(handover.incident)}.",
                notice=Notice.HANDOVER_CANCELLED,
                author_id=actor.id,
                incident_id=handover.incident_id,
                handover_id=handover.id,
            )
            return self._reload(handover.id)

    @retry_transient_db_errors
    def delegate(
        self, incident_id: uuid.UUID, actor: AuthenticatedUser, data: DelegateRequest
    ) -> Incident:
        with self._session.begin():
            incident = self._require_incident(incident_id)
            if incident.version != data.version:
                raise VersionConflictError(
                    "Este incidente mudou desde que você o abriu. Confira antes de delegar."
                )
            if incident.assignee_id != actor.id or incident.assignee is None:
                raise NotAssigneeError("Só o responsável pode delegar o incidente.")
            target = self._users.get(data.to_user_id)
            if target is None:
                raise NotFoundError("Analista não encontrado.")
            if target.id == actor.id:
                raise HandoverNotAllowedError("O incidente já está com você.")

            owner = incident.assignee
            updated = self._transfer(
                incident.id, owner, target, via="delegation", version=data.version
            )
            self._feed.post(
                f"{owner.display_name} delegou {incident_ref(updated)} para {target.display_name}.",
                notice=Notice.DELEGATED,
                author_id=actor.id,
                incident_id=updated.id,
            )
            self._close_stale_requests(updated)
            return updated

    def _transfer(
        self,
        incident_id: uuid.UUID,
        owner: User,
        target: User,
        *,
        via: str,
        version: int | None = None,
    ) -> Incident:
        if not self._incidents.transfer_assignee(incident_id, owner.id, target.id, version):
            raise HandoverNotAllowedError(
                f"{owner.display_name} não é mais o responsável por este incidente."
            )
        self._events.record(
            incident_id,
            EventType.ASSIGNEE_CHANGED,
            owner.id,
            changes={
                "assignee": {"from": owner.display_name, "to": target.display_name},
                "via": via,
            },
        )
        self._feed.incident_changed(incident_id)
        incident = self._incidents.get(incident_id)
        if incident is None:  # pragma: no cover - acabou de ser atualizado na mesma transação
            raise NotFoundError("Incidente não encontrado.")
        return incident

    def _close_stale_requests(self, incident: Incident) -> None:
        """Ao trocar de responsável por delegação, pedidos pendentes perdem o sentido."""
        for handover_id in self._handovers.cancel_pending_for(incident.id):
            self._feed.post(
                f"Pedido para assumir {incident_ref(incident)} encerrado: o incidente "
                "mudou de responsável.",
                notice=Notice.HANDOVER_CANCELLED,
                incident_id=incident.id,
                handover_id=handover_id,
            )

    def _require_incident(self, incident_id: uuid.UUID) -> Incident:
        incident = self._incidents.get(incident_id)
        if incident is None:
            raise NotFoundError("Incidente não encontrado. Ele pode ter sido excluído.")
        return incident

    def _require_pending(self, handover_id: uuid.UUID) -> HandoverRequest:
        handover = self._handovers.get(handover_id)
        if handover is None:
            raise NotFoundError("Pedido não encontrado.")
        if handover.status != HandoverStatus.PENDING:
            raise HandoverNotAllowedError("Este pedido já foi respondido.")
        return handover

    @staticmethod
    def _ensure_is_owner(handover: HandoverRequest, actor: AuthenticatedUser, action: str) -> None:
        if handover.owner_id != actor.id:
            raise NotAssigneeError(
                f"Só {handover.owner.display_name}, responsável pelo incidente, pode {action}."
            )

    def _reload(self, handover_id: uuid.UUID) -> HandoverRequest:
        handover = self._handovers.get(handover_id)
        if handover is None:  # pragma: no cover
            raise NotFoundError("Pedido não encontrado.")
        return handover
