import asyncio
from collections.abc import AsyncIterator

from fastapi import APIRouter, Header, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse

from app.api.deps import CurrentUser
from app.core.db import SessionFactory
from app.realtime.broadcaster import Broadcaster
from app.realtime.events import format_sse
from app.schemas.chat import ChatMessageRead
from app.services.chat_service import ChatService

router = APIRouter(tags=["realtime"])

HEARTBEAT_SECONDS = 15
RECONNECT_DELAY_MS = 3000


def _missed_messages(after_id: int) -> list[str]:
    with SessionFactory() as session:
        messages = ChatService(session).messages_after(after_id)
        return [
            format_sse(
                {
                    "type": "chat.message",
                    "id": message.id,
                    "data": ChatMessageRead.model_validate(message).model_dump(mode="json"),
                }
            )
            for message in messages
        ]


@router.get(
    "/stream",
    summary="Eventos em tempo real (Server-Sent Events): chat e mudanças de incidentes",
    response_class=StreamingResponse,
)
async def stream(
    request: Request,
    _: CurrentUser,
    last_event_id: str | None = Header(default=None, alias="Last-Event-ID"),
) -> StreamingResponse:
    broadcaster: Broadcaster = request.app.state.broadcaster
    # Inscreve antes do replay: nada que chegue durante o replay se perde. Duplicatas
    # possíveis são descartadas pelo cliente, que deduplica pelo id da mensagem.
    queue = broadcaster.subscribe()

    async def events() -> AsyncIterator[str]:
        try:
            yield f"retry: {RECONNECT_DELAY_MS}\n\n"
            if last_event_id and last_event_id.isdigit():
                for chunk in await run_in_threadpool(_missed_messages, int(last_event_id)):
                    yield chunk
            while not await request.is_disconnected():
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_SECONDS)
                except TimeoutError:
                    yield ": ping\n\n"
                    continue
                yield format_sse(event)
        finally:
            broadcaster.unsubscribe(queue)

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
