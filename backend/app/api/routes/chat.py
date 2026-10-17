from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, SessionDep
from app.schemas.chat import ChatHistory, ChatMessageCreate, ChatMessageRead
from app.services.chat_service import ChatService

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/messages", summary="Histórico do chat da central (mais recentes)")
def history(
    session: SessionDep,
    _: CurrentUser,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    before_id: Annotated[int | None, Query(ge=1)] = None,
) -> ChatHistory:
    messages, has_more = ChatService(session).history(limit, before_id)
    return ChatHistory(
        items=[ChatMessageRead.model_validate(message) for message in messages],
        has_more=has_more,
    )


@router.post(
    "/messages", status_code=status.HTTP_201_CREATED, summary="Envia mensagem para a central"
)
def post_message(
    payload: ChatMessageCreate, session: SessionDep, user: CurrentUser
) -> ChatMessageRead:
    return ChatMessageRead.model_validate(ChatService(session).post(user, payload))
