import json
from collections.abc import Iterator

import psycopg
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import make_url

from app.core.config import get_settings
from app.realtime.events import CHANNEL


@pytest.fixture
def listener() -> Iterator[psycopg.Connection]:
    dsn = make_url(get_settings().database_url).set(drivername="postgresql")
    with psycopg.connect(dsn.render_as_string(hide_password=False), autocommit=True) as conn:
        conn.execute(f"LISTEN {CHANNEL}")
        yield conn


def received(listener: psycopg.Connection) -> list[dict]:
    return [json.loads(n.payload) for n in listener.notifies(timeout=0.5, stop_after=20)]


def test_committed_message_is_published_with_its_id(
    client: TestClient, auth_headers, listener
) -> None:
    created = client.post(
        "/api/chat/messages", json={"body": "Bom dia, central"}, headers=auth_headers("ana")
    ).json()

    events = received(listener)

    assert {"type": "chat.message", "id": created["id"]}.items() <= events[-1].items()
    assert events[-1]["data"]["body"] == "Bom dia, central"


def test_claim_publishes_chat_notice_and_incident_change(
    client: TestClient, auth_headers, create_incident, listener
) -> None:
    incident = create_incident()
    received(listener)  # descarta os eventos da criação

    client.patch(
        f"/api/incidents/{incident['id']}/status",
        json={"status": "investigating", "version": 1},
        headers=auth_headers("ana"),
    )

    types = [event["type"] for event in received(listener)]
    assert types == ["chat.message", "incident.changed"]


def test_rejected_change_publishes_nothing_about_the_change(
    client: TestClient, auth_headers, create_incident, listener
) -> None:
    incident = create_incident()
    received(listener)

    client.patch(
        f"/api/incidents/{incident['id']}/status",
        json={"status": "closed", "version": 1},
        headers=auth_headers("ana"),
    )

    # Transição inválida: a transação foi desfeita, então nenhum aviso foi entregue.
    assert received(listener) == []
