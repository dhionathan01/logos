from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.core.db import SessionFactory
from app.models import ChatMessage, Incident, User
from app.scripts.seed import reset_demo_data


def test_reset_removes_visitor_data_but_keeps_analysts(
    client: TestClient, auth_headers, create_incident
) -> None:
    headers = auth_headers("ana")
    incident = create_incident()
    client.patch(
        f"/api/incidents/{incident['id']}/status",
        json={"status": "investigating", "version": 1},
        headers=headers,
    )
    client.post("/api/chat/messages", json={"body": "spam"}, headers=headers)

    reset_demo_data()

    with SessionFactory() as session:
        assert session.scalar(select(func.count(Incident.id))) == 0
        assert session.scalar(select(func.count(ChatMessage.id))) == 0
        assert session.scalar(select(func.count(User.id))) > 0
