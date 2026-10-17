from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ChatMessage

MAX_REPLAY = 500


class ChatRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def add(self, message: ChatMessage) -> ChatMessage:
        self._session.add(message)
        self._session.flush()
        # Carrega autor, incidente e pedido para publicar a mensagem completa no stream.
        self._session.refresh(message)
        return message

    def recent(self, limit: int, before_id: int | None = None) -> list[ChatMessage]:
        query = select(ChatMessage).order_by(ChatMessage.id.desc()).limit(limit)
        if before_id is not None:
            query = query.where(ChatMessage.id < before_id)
        return list(reversed(list(self._session.scalars(query).unique())))

    def after(self, after_id: int) -> list[ChatMessage]:
        """Mensagens perdidas durante uma desconexão (replay do stream)."""
        query = (
            select(ChatMessage)
            .where(ChatMessage.id > after_id)
            .order_by(ChatMessage.id)
            .limit(MAX_REPLAY)
        )
        return list(self._session.scalars(query).unique())
