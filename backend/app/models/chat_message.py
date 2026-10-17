import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Identity, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.domain.chat import MessageKind, Notice
from app.models.handover_request import HandoverRequest
from app.models.incident import Incident, enum_column
from app.models.user import User


class ChatMessage(Base):
    """Mensagem do chat da central. O id sequencial é o `Last-Event-ID` do stream (ADR-0014)."""

    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    kind: Mapped[MessageKind] = mapped_column(enum_column(MessageKind, "chat_message_kind"))
    notice: Mapped[Notice | None] = mapped_column(enum_column(Notice, "chat_notice"))
    body: Mapped[str] = mapped_column(Text)
    author_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    author: Mapped[User | None] = relationship(lazy="joined")
    incident_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("incidents.id", ondelete="SET NULL")
    )
    incident: Mapped[Incident | None] = relationship(lazy="joined")
    handover_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("handover_requests.id", ondelete="SET NULL")
    )
    handover: Mapped[HandoverRequest | None] = relationship(lazy="joined")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
