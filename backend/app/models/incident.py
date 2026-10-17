import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.domain.incident import Category, Severity, Status
from app.models.user import User


def enum_column(enum_class: type[StrEnum], name: str) -> Enum:
    # VARCHAR + CHECK em vez de ENUM nativo: adicionar um valor não exige ALTER TYPE.
    return Enum(
        enum_class,
        name=name,
        native_enum=False,
        create_constraint=True,
        length=32,
        values_callable=lambda members: [member.value for member in members],
    )


class Incident(Base):
    __tablename__ = "incidents"
    __table_args__ = (
        Index("ix_incidents_status_severity", "status", "severity"),
        Index("ix_incidents_reported_at", "reported_at"),
        Index("ix_incidents_assignee_id", "assignee_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="", server_default="")
    category: Mapped[Category] = mapped_column(enum_column(Category, "incident_category"))
    severity: Mapped[Severity] = mapped_column(enum_column(Severity, "incident_severity"))
    status: Mapped[Status] = mapped_column(
        enum_column(Status, "incident_status"), default=Status.OPEN
    )
    vehicle_id: Mapped[str] = mapped_column(String(20))
    location: Mapped[str] = mapped_column(String(200))
    resolution_note: Mapped[str | None] = mapped_column(Text)

    assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    assignee: Mapped[User | None] = relationship(lazy="joined")

    idempotency_key: Mapped[str | None] = mapped_column(String(64), unique=True)
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")

    reported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    # Marcos para os indicadores de SLA (ADR-0013).
    first_claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
