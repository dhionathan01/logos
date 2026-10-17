import asyncio

from app.realtime.broadcaster import QUEUE_SIZE, Broadcaster
from app.realtime.events import format_sse


def test_chat_events_carry_id_for_replay() -> None:
    chunk = format_sse({"type": "chat.message", "id": 42, "data": {"body": "olá"}})

    assert chunk == 'event: chat.message\nid: 42\ndata: {"body": "olá"}\n\n'


def test_incident_events_have_no_id() -> None:
    chunk = format_sse({"type": "incident.changed", "id": None, "data": {"incident_id": "x"}})

    assert "id:" not in chunk
    assert chunk.endswith("\n\n")


def test_every_subscriber_receives_each_event() -> None:
    broadcaster = Broadcaster("postgresql+psycopg://u:p@localhost/db")
    first, second = broadcaster.subscribe(), broadcaster.subscribe()

    broadcaster.dispatch({"type": "incident.changed"})

    assert first.get_nowait() == second.get_nowait() == {"type": "incident.changed"}


def test_slow_subscriber_drops_oldest_instead_of_blocking_others() -> None:
    broadcaster = Broadcaster("postgresql+psycopg://u:p@localhost/db")
    slow = broadcaster.subscribe()

    for index in range(QUEUE_SIZE + 5):
        broadcaster.dispatch({"seq": index})

    assert slow.qsize() == QUEUE_SIZE
    assert slow.get_nowait() == {"seq": 5}


def test_unsubscribed_clients_stop_receiving() -> None:
    broadcaster = Broadcaster("postgresql+psycopg://u:p@localhost/db")
    queue = broadcaster.subscribe()
    broadcaster.unsubscribe(queue)

    broadcaster.dispatch({"type": "incident.changed"})

    assert queue.empty()
    assert broadcaster.subscriber_count == 0


def test_dsn_drops_sqlalchemy_driver_suffix() -> None:
    broadcaster = Broadcaster("postgresql+psycopg://logos:segredo@db:5432/logos")

    assert broadcaster._dsn == "postgresql://logos:segredo@db:5432/logos"


def test_queue_type_is_asyncio() -> None:
    assert isinstance(Broadcaster("postgresql://x").subscribe(), asyncio.Queue)
