import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.domain.chat import HandoverStatus
from app.models.incident import Incident, enum_column
from app.models.user import User


class HandoverRequest(Base):
    """Pedido de um analista para assumir um incidente que está com outro (ADR-0015)."""

    __tablename__ = "handover_requests"
    __table_args__ = (
        # No máximo um pedido pendente por incidente, garantido pelo banco mesmo com cliques
        # simultâneos (índice único parcial).
        Index(
            "uq_handover_requests_one_pending_per_incident",
            "incident_id",
            unique=True,
            postgresql_where=text("status = 'pending'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    incident_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("incidents.id", ondelete="CASCADE"))
    incident: Mapped[Incident] = relationship(lazy="joined")
    requester_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    requester: Mapped[User] = relationship(foreign_keys=[requester_id], lazy="joined")
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    owner: Mapped[User] = relationship(foreign_keys=[owner_id], lazy="joined")
    status: Mapped[HandoverStatus] = mapped_column(
        enum_column(HandoverStatus, "handover_status"), default=HandoverStatus.PENDING
    )
    reason: Mapped[str] = mapped_column(String(300), default="", server_default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
