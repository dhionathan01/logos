from sqlalchemy.orm import Session

from app.core.db import retry_transient_db_errors
from app.core.errors import NotFoundError
from app.core.security import AuthenticatedUser
from app.domain.chat import MessageKind
from app.models import ChatMessage, Incident
from app.repositories.chat_repository import ChatRepository
from app.schemas.chat import ChatMessageCreate
from app.services.central_feed import CentralFeed


class ChatService:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._chat = ChatRepository(session)
        self._feed = CentralFeed(session)

    @retry_transient_db_errors
    def history(self, limit: int, before_id: int | None = None) -> tuple[list[ChatMessage], bool]:
        with self._session.begin():
            # Busca um a mais para saber se ainda há mensagens antigas para carregar.
            messages = self._chat.recent(limit + 1, before_id)
        has_more = len(messages) > limit
        return (messages[1:] if has_more else messages), has_more

    @retry_transient_db_errors
    def messages_after(self, after_id: int) -> list[ChatMessage]:
        with self._session.begin():
            return self._chat.after(after_id)

    @retry_transient_db_errors
    def post(self, author: AuthenticatedUser, data: ChatMessageCreate) -> ChatMessage:
        with self._session.begin():
            if data.incident_id and self._session.get(Incident, data.incident_id) is None:
                raise NotFoundError("O incidente citado não existe mais.")
            return self._feed.post(
                data.body,
                kind=MessageKind.USER,
                author_id=author.id,
                incident_id=data.incident_id,
            )
