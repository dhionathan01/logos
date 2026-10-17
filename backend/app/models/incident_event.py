import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.domain.incident import EventType, Status
from app.models.incident import enum_column
from app.models.user import User


class IncidentEvent(Base):
    """Trilha de auditoria: gravada na mesma transação da alteração que descreve."""

    __tablename__ = "incident_events"
    __table_args__ = (Index("ix_incident_events_incident_occurred", "incident_id", "occurred_at"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    incident_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("incidents.id", ondelete="CASCADE"))
    event_type: Mapped[EventType] = mapped_column(enum_column(EventType, "incident_event_type"))
    from_status: Mapped[Status | None] = mapped_column(
        enum_column(Status, "incident_event_from_status")
    )
    to_status: Mapped[Status | None] = mapped_column(
        enum_column(Status, "incident_event_to_status")
    )
    changes: Mapped[dict[str, object] | None] = mapped_column(JSON)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    actor: Mapped[User | None] = relationship(lazy="joined")
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
