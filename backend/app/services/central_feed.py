"""Avisos da central: grava no chat e publica em tempo real, dentro da transação de quem chama."""

import uuid

from sqlalchemy.orm import Session

from app.domain.chat import MessageKind, Notice
from app.models import ChatMessage, Incident
from app.realtime.events import publish
from app.repositories.chat_repository import ChatRepository
from app.schemas.chat import ChatMessageRead


def incident_ref(incident: Incident) -> str:
    return f"“{incident.title}” ({incident.vehicle_id})"


class CentralFeed:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._chat = ChatRepository(session)

    def post(
        self,
        body: str,
        *,
        kind: MessageKind = MessageKind.SYSTEM,
        notice: Notice | None = None,
        author_id: uuid.UUID | None = None,
        incident_id: uuid.UUID | None = None,
        handover_id: uuid.UUID | None = None,
    ) -> ChatMessage:
        message = self._chat.add(
            ChatMessage(
                kind=kind,
                notice=notice,
                body=body,
                author_id=author_id,
                incident_id=incident_id,
                handover_id=handover_id,
            )
        )
        publish(
            self._session,
            "chat.message",
            ChatMessageRead.model_validate(message).model_dump(mode="json"),
            event_id=message.id,
        )
        return message

    def incident_changed(self, incident_id: uuid.UUID) -> None:
        publish(self._session, "incident.changed", {"incident_id": str(incident_id)})
