from fastapi.testclient import TestClient

from app.core.config import get_settings

PAYLOAD = {
    "title": "Bloqueio por queda de barreira",
    "category": "road_block",
    "vehicle_id": "CAM-1200",
    "location": "BR-040, km 12",
}


def fleet_headers(**extra: str) -> dict[str, str]:
    return {"X-API-Key": get_settings().ingestion_api_key.get_secret_value(), **extra}


def test_fleet_system_can_report_with_api_key(client: TestClient) -> None:
    response = client.post("/api/incidents", json=PAYLOAD, headers=fleet_headers())

    assert response.status_code == 201
    assert response.headers["location"].startswith("/api/incidents/")


def test_invalid_api_key_is_rejected(client: TestClient) -> None:
    response = client.post("/api/incidents", json=PAYLOAD, headers={"X-API-Key": "chute"})

    assert response.status_code == 401


def test_api_key_only_grants_ingestion(client: TestClient) -> None:
    assert client.get("/api/incidents", headers=fleet_headers()).status_code == 401


def test_retry_with_same_idempotency_key_does_not_duplicate(
    client: TestClient, auth_headers
) -> None:
    headers = fleet_headers(**{"Idempotency-Key": "truck-1200-evt-0001"})

    first = client.post("/api/incidents", json=PAYLOAD, headers=headers)
    retry = client.post("/api/incidents", json=PAYLOAD, headers=headers)

    assert first.status_code == 201
    assert retry.status_code == 200
    assert retry.headers["idempotent-replayed"] == "true"
    assert retry.json()["id"] == first.json()["id"]
    total = client.get("/api/incidents", headers=auth_headers("ana")).json()["total"]
    assert total == 1


def test_reusing_idempotency_key_for_different_incident_is_a_conflict(
    client: TestClient,
) -> None:
    headers = fleet_headers(**{"Idempotency-Key": "truck-1200-evt-0002"})
    client.post("/api/incidents", json=PAYLOAD, headers=headers)

    response = client.post(
        "/api/incidents", json={**PAYLOAD, "title": "Outro incidente"}, headers=headers
    )

    assert response.status_code == 409
    assert response.json()["type"] == "/problems/duplicate-idempotency-key"


def test_malformed_idempotency_key_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/incidents", json=PAYLOAD, headers=fleet_headers(**{"Idempotency-Key": "a b"})
    )

    assert response.status_code == 422
