import uuid
from typing import Any, cast

from sqlalchemy import ColumnElement, CursorResult, Result, case, delete, func, or_, select, update
from sqlalchemy.orm import Session

from app.domain.incident import SEVERITY_RANK, STATUS_RANK, Severity, Status
from app.models import Incident
from app.schemas.incident import IncidentFilters

_severity_order = case(
    {severity.value: rank for severity, rank in SEVERITY_RANK.items()}, value=Incident.severity
)
_status_order = case(
    {status.value: rank for status, rank in STATUS_RANK.items()}, value=Incident.status
)


class IncidentRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def search(self, filters: IncidentFilters) -> tuple[list[Incident], int]:
        conditions = self._conditions(filters)
        total = self._session.scalar(select(func.count(Incident.id)).where(*conditions)) or 0
        # Prioridade: criticidade, depois o que ainda exige ação, depois o mais antigo.
        query = (
            select(Incident)
            .where(*conditions)
            .order_by(_severity_order, _status_order, Incident.reported_at.asc())
            .limit(filters.limit)
            .offset(filters.offset)
        )
        return list(self._session.scalars(query).unique()), total

    def get(self, incident_id: uuid.UUID) -> Incident | None:
        return self._session.get(Incident, incident_id, populate_existing=True)

    def find_by_idempotency_key(self, key: str) -> Incident | None:
        return self._session.scalar(select(Incident).where(Incident.idempotency_key == key))

    def add(self, incident: Incident) -> Incident:
        self._session.add(incident)
        self._session.flush()
        return incident

    def update_if_version(
        self, incident_id: uuid.UUID, expected_version: int, values: dict[str, Any]
    ) -> bool:
        """Aplica a mudança só se ninguém alterou o incidente desde a leitura do cliente.

        A checagem e a escrita acontecem no mesmo UPDATE, de forma atômica no banco:
        se outro analista gravou antes, a versão não bate e nenhuma linha é afetada.
        """
        result = self._session.execute(
            update(Incident)
            .where(Incident.id == incident_id, Incident.version == expected_version)
            .values(**values, version=Incident.version + 1, updated_at=func.now())
            .execution_options(synchronize_session=False)
        )
        return _affected_rows(result) == 1

    def delete_if_version(self, incident_id: uuid.UUID, expected_version: int) -> bool:
        result = self._session.execute(
            delete(Incident).where(Incident.id == incident_id, Incident.version == expected_version)
        )
        return _affected_rows(result) == 1

    def count_active_by_severity(self) -> dict[Severity, int]:
        rows = self._session.execute(
            select(Incident.severity, func.count())
            .where(Incident.status != Status.CLOSED)
            .group_by(Incident.severity)
        )
        counts = {severity: 0 for severity in Severity}
        counts.update({severity: count for severity, count in rows.tuples()})
        return counts

    def count_by_status(self) -> dict[Status, int]:
        rows = self._session.execute(
            select(Incident.status, func.count()).group_by(Incident.status)
        )
        counts = {status: 0 for status in Status}
        counts.update({status: count for status, count in rows.tuples()})
        return counts

    @staticmethod
    def _conditions(filters: IncidentFilters) -> list[ColumnElement[bool]]:
        conditions: list[ColumnElement[bool]] = []
        if filters.severity:
            conditions.append(Incident.severity.in_(filters.severity))
        if filters.category:
            conditions.append(Incident.category.in_(filters.category))
        if filters.status:
            conditions.append(Incident.status.in_(filters.status))
        if filters.search:
            pattern = f"%{_escape_like(filters.search)}%"
            conditions.append(
                or_(
                    Incident.title.ilike(pattern, escape="\\"),
                    Incident.vehicle_id.ilike(pattern, escape="\\"),
                    Incident.location.ilike(pattern, escape="\\"),
                )
            )
        return conditions


def _affected_rows(result: Result[Any]) -> int:
    return cast(CursorResult[Any], result).rowcount


def _escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
