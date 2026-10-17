"""Escuta o canal do PostgreSQL e distribui os eventos para as conexões SSE (ADR-0014)."""

import asyncio
import contextlib
import json
import logging
from typing import Any

import psycopg
from sqlalchemy.engine import make_url

from app.realtime.events import CHANNEL

logger = logging.getLogger(__name__)

QUEUE_SIZE = 256
MAX_BACKOFF_SECONDS = 30.0

Event = dict[str, Any]


class Broadcaster:
    """Uma conexão LISTEN por processo; cada cliente SSE recebe uma fila própria."""

    def __init__(self, database_url: str) -> None:
        # O psycopg recebe a URL sem o sufixo de driver do SQLAlchemy ("+psycopg").
        self._dsn = (
            make_url(database_url)
            .set(drivername="postgresql")
            .render_as_string(hide_password=False)
        )
        self._subscribers: set[asyncio.Queue[Event]] = set()
        self._task: asyncio.Task[None] | None = None

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)

    def subscribe(self) -> asyncio.Queue[Event]:
        queue: asyncio.Queue[Event] = asyncio.Queue(maxsize=QUEUE_SIZE)
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue[Event]) -> None:
        self._subscribers.discard(queue)

    def dispatch(self, event: Event) -> None:
        for queue in list(self._subscribers):
            if queue.full():
                # Cliente lento demais: descarta o mais antigo. Mensagens perdidas voltam
                # pelo replay (Last-Event-ID) quando ele reconectar.
                with contextlib.suppress(asyncio.QueueEmpty):
                    queue.get_nowait()
            queue.put_nowait(event)

    async def start(self) -> None:
        self._task = asyncio.create_task(self._listen_forever(), name="realtime-listener")

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task

    async def _listen_forever(self) -> None:
        backoff = 1.0
        while True:
            try:
                async with await psycopg.AsyncConnection.connect(
                    self._dsn, autocommit=True
                ) as connection:
                    await connection.execute(f"LISTEN {CHANNEL}")
                    logger.info("Escutando eventos em tempo real no canal %s", CHANNEL)
                    backoff = 1.0
                    async for notification in connection.notifies():
                        self._handle(notification.payload)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.warning(
                    "Conexão de tempo real perdida; nova tentativa em %.0fs", backoff, exc_info=True
                )
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, MAX_BACKOFF_SECONDS)

    def _handle(self, payload: str) -> None:
        try:
            event = json.loads(payload)
        except json.JSONDecodeError:
            logger.warning("Evento de tempo real ignorado: payload inválido")
            return
        self.dispatch(event)
