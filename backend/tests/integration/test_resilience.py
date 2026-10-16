import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.services.incident_service import IncidentService


def test_database_outage_returns_503_with_retry_after(
    client: TestClient, auth_headers, monkeypatch: pytest.MonkeyPatch
) -> None:
    headers = auth_headers("ana")

    def database_down(*_args: object, **_kwargs: object) -> None:
        raise OperationalError("SELECT 1", {}, Exception("connection refused"))

    monkeypatch.setattr(IncidentService, "list_incidents", database_down)

    response = client.get("/api/incidents", headers=headers)

    assert response.status_code == 503
    assert response.headers["retry-after"] == "5"
    assert response.json()["type"] == "/problems/database-unavailable"
    assert "connection refused" not in response.text


def test_unexpected_error_does_not_leak_internals(
    client: TestClient, auth_headers, monkeypatch: pytest.MonkeyPatch
) -> None:
    headers = auth_headers("ana")

    def bug(*_args: object, **_kwargs: object) -> None:
        raise RuntimeError("segredo interno")

    monkeypatch.setattr(IncidentService, "summarize", bug)

    with TestClient(client.app, raise_server_exceptions=False) as safe_client:
        response = safe_client.get("/api/incidents/summary", headers=headers)

    assert response.status_code == 500
    assert "segredo" not in response.text


def test_readiness_checks_database(client: TestClient) -> None:
    assert client.get("/api/health/ready").json() == {"status": "ok", "database": "ok"}
