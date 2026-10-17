import uuid
from collections.abc import Mapping

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.incident import EventType, Status
from app.models import IncidentEvent


class EventRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def record(
        self,
        incident_id: uuid.UUID,
        event_type: EventType,
        actor_id: uuid.UUID | None,
        *,
        from_status: Status | None = None,
        to_status: Status | None = None,
        changes: Mapping[str, object] | None = None,
    ) -> None:
        self._session.add(
            IncidentEvent(
                incident_id=incident_id,
                event_type=event_type,
                actor_id=actor_id,
                from_status=from_status,
                to_status=to_status,
                changes=dict(changes) if changes is not None else None,
            )
        )
        self._session.flush()

    def list_for_incident(self, incident_id: uuid.UUID) -> list[IncidentEvent]:
        query = (
            select(IncidentEvent)
            .where(IncidentEvent.incident_id == incident_id)
            .order_by(IncidentEvent.occurred_at.asc(), IncidentEvent.id)
        )
        return list(self._session.scalars(query).unique())
