"""Publicação de eventos em tempo real pelo PostgreSQL (ADR-0014)."""

import json
from typing import Any, Literal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

CHANNEL = "logos_events"

EventType = Literal["chat.message", "incident.changed"]


def publish(
    session: Session, event_type: EventType, data: dict[str, Any], event_id: int | None = None
) -> None:
    """Agenda a notificação na transação atual.

    O PostgreSQL só entrega o NOTIFY quando a transação é confirmada: se ela falhar,
    nenhum cliente fica sabendo de algo que não aconteceu.
    """
    payload = json.dumps({"type": event_type, "id": event_id, "data": data}, default=str)
    session.execute(select(func.pg_notify(CHANNEL, payload)))


def format_sse(event: dict[str, Any]) -> str:
    """Serializa no formato text/event-stream. Só mensagens de chat levam id (permitem replay)."""
    lines = [f"event: {event['type']}"]
    if event.get("id") is not None:
        lines.append(f"id: {event['id']}")
    lines.append(f"data: {json.dumps(event['data'], ensure_ascii=False, default=str)}")
    return "\n".join(lines) + "\n\n"
