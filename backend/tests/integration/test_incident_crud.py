from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient


def test_create_derives_severity_from_category(create_incident) -> None:
    incident = create_incident(category="accident_with_victims", title="Colisão com feridos")

    assert incident["severity"] == "high"
    assert incident["status"] == "open"
    assert incident["version"] == 1
    assert incident["assignee"] is None


def test_create_normalizes_input(create_incident) -> None:
    incident = create_incident(title="  Pneu furado  ", vehicle_id="cam-0001")

    assert incident["title"] == "Pneu furado"
    assert incident["vehicle_id"] == "CAM-0001"


@pytest.mark.parametrize(
    ("override", "field"),
    [
        ({"category": "meteoro"}, "category"),
        ({"severity": "critica"}, "severity"),
        ({"title": "ab"}, "title"),
        ({"title": "x" * 121}, "title"),
        ({"vehicle_id": "CAM 01; DROP TABLE"}, "vehicle_id"),
        ({"reported_at": (datetime.now(UTC) + timedelta(days=1)).isoformat()}, "reported_at"),
        ({"reported_at": "2026-10-16T10:00:00"}, "reported_at"),
        ({"hacker": True}, "hacker"),
    ],
)
def test_create_rejects_invalid_payloads(
    client: TestClient, auth_headers, override: dict, field: str
) -> None:
    payload = {
        "title": "Pneu furado",
        "category": "mechanical_failure",
        "vehicle_id": "CAM-0421",
        "location": "BR-116",
        **override,
    }

    response = client.post("/api/incidents", json=payload, headers=auth_headers("ana"))

    assert response.status_code == 422
    body = response.json()
    assert body["type"] == "/problems/validation-error"
    assert any(error["field"] == field for error in body["errors"])


def test_malformed_json_does_not_break_the_api(client: TestClient, auth_headers) -> None:
    response = client.post(
        "/api/incidents",
        content=b"{not json",
        headers={**auth_headers("ana"), "Content-Type": "application/json"},
    )

    assert response.status_code == 422


def test_list_orders_by_severity_then_status_then_age(
    client: TestClient, auth_headers, create_incident
) -> None:
    now = datetime.now(UTC)
    low = create_incident(severity="low", reported_at=(now - timedelta(hours=5)).isoformat())
    high_recent = create_incident(severity="high", reported_at=now.isoformat())
    high_old = create_incident(severity="high", reported_at=(now - timedelta(hours=2)).isoformat())

    response = client.get("/api/incidents", headers=auth_headers("ana"))

    ids = [item["id"] for item in response.json()["items"]]
    assert ids == [high_old["id"], high_recent["id"], low["id"]]


def test_list_filters_by_severity_and_category(
    client: TestClient, auth_headers, create_incident
) -> None:
    create_incident(category="road_block", severity="high")
    create_incident(category="road_block", severity="low")
    create_incident(category="mechanical_failure", severity="high")

    response = client.get(
        "/api/incidents",
        params={"severity": ["high"], "category": ["road_block"]},
        headers=auth_headers("ana"),
    )

    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["category"] == "road_block"
    assert body["items"][0]["severity"] == "high"


def test_list_filters_by_reported_period(client: TestClient, auth_headers, create_incident) -> None:
    now = datetime.now(UTC)
    create_incident(title="Há três dias", reported_at=(now - timedelta(days=3)).isoformat())
    an_hour_ago = (now - timedelta(hours=1)).isoformat()
    recent = create_incident(title="Há uma hora", reported_at=an_hour_ago)
    create_incident(title="Agora", reported_at=now.isoformat())

    response = client.get(
        "/api/incidents",
        params={
            "reported_from": (now - timedelta(hours=2)).isoformat(),
            "reported_to": (now - timedelta(minutes=30)).isoformat(),
        },
        headers=auth_headers("ana"),
    )

    assert [item["id"] for item in response.json()["items"]] == [recent["id"]]


def test_list_by_assignee_keeps_who_closed(
    client: TestClient, auth_headers, create_incident, analysts
) -> None:
    ana, bruno = auth_headers("ana"), auth_headers("bruno")
    claimed = create_incident(title="Assumido pela Ana")
    closed = create_incident(title="Concluído pela Ana")
    create_incident(title="Do Bruno")
    for incident in (claimed, closed):
        _patch_status(client, ana, incident["id"], status="investigating", version=1)
    _patch_status(client, ana, closed["id"], status="closed", version=2)
    others = client.get("/api/incidents", headers=bruno).json()["items"]
    from_bruno = next(item for item in others if item["title"] == "Do Bruno")
    _patch_status(client, bruno, from_bruno["id"], status="investigating", version=1)

    def titles(**params: object) -> list[str]:
        response = client.get(
            "/api/incidents", params={"assignee": [str(analysts["ana"].id)], **params}, headers=ana
        )
        assert response.status_code == 200
        return [item["title"] for item in response.json()["items"]]

    assert titles(status=["investigating", "inconclusive"]) == ["Assumido pela Ana"]
    assert titles(status=["closed"], sort="recent") == ["Concluído pela Ana"]


def test_recent_sort_lists_latest_closed_first(
    client: TestClient, auth_headers, create_incident
) -> None:
    headers = auth_headers("ana")
    first, second = create_incident(title="Primeiro"), create_incident(title="Segundo")
    for incident in (first, second):
        _patch_status(client, headers, incident["id"], status="investigating", version=1)
        _patch_status(client, headers, incident["id"], status="closed", version=2)

    response = client.get(
        "/api/incidents", params={"status": ["closed"], "sort": "recent"}, headers=headers
    )

    assert [item["title"] for item in response.json()["items"]] == ["Segundo", "Primeiro"]


def _patch_status(client: TestClient, headers: dict, incident_id: str, **body: object) -> None:
    response = client.patch(f"/api/incidents/{incident_id}/status", json=body, headers=headers)
    assert response.status_code == 200, response.text


@pytest.mark.parametrize(
    "params",
    [
        {"reported_from": "2026-10-16T12:00:00Z", "reported_to": "2026-10-15T12:00:00Z"},
        {"reported_from": "2026-10-16T12:00:00"},
        {"reported_to": "ontem"},
    ],
)
def test_list_rejects_invalid_periods(client: TestClient, auth_headers, params: dict) -> None:
    response = client.get("/api/incidents", params=params, headers=auth_headers("ana"))

    assert response.status_code == 422


def test_search_treats_wildcards_literally(
    client: TestClient, auth_headers, create_incident
) -> None:
    create_incident(title="Pneu furado")

    response = client.get("/api/incidents", params={"search": "%"}, headers=auth_headers("ana"))

    assert response.json()["total"] == 0


def test_list_rejects_unknown_filters_and_huge_pages(client: TestClient, auth_headers) -> None:
    headers = auth_headers("ana")
    assert client.get("/api/incidents?limit=10000", headers=headers).status_code == 422
    assert client.get("/api/incidents?severity=urgente", headers=headers).status_code == 422
    assert client.get("/api/incidents?assignee=ana", headers=headers).status_code == 422
    assert client.get("/api/incidents?sort=random", headers=headers).status_code == 422


def test_summary_counts_active_incidents(client: TestClient, auth_headers, create_incident) -> None:
    create_incident(severity="high")
    create_incident(severity="high")
    create_incident(severity="low")

    summary = client.get("/api/incidents/summary", headers=auth_headers("ana")).json()

    assert summary["active_by_severity"] == {"high": 2, "medium": 0, "low": 1}
    assert summary["by_status"]["open"] == 3


def test_get_unknown_incident_returns_404(client: TestClient, auth_headers) -> None:
    response = client.get(
        "/api/incidents/00000000-0000-0000-0000-000000000000", headers=auth_headers("ana")
    )

    assert response.status_code == 404
    assert client.get("/api/incidents/nao-e-uuid", headers=auth_headers("ana")).status_code == 422


def test_update_details_bumps_version(client: TestClient, auth_headers, create_incident) -> None:
    incident = create_incident()

    response = client.patch(
        f"/api/incidents/{incident['id']}",
        json={"version": 1, "severity": "high"},
        headers=auth_headers("bruno"),
    )

    assert response.status_code == 200
    assert response.json()["severity"] == "high"
    assert response.json()["version"] == 2


def test_update_requires_at_least_one_field(
    client: TestClient, auth_headers, create_incident
) -> None:
    incident = create_incident()

    response = client.patch(
        f"/api/incidents/{incident['id']}", json={"version": 1}, headers=auth_headers("ana")
    )

    assert response.status_code == 422


def test_delete_requires_current_version_and_open_status(
    client: TestClient, auth_headers, create_incident
) -> None:
    incident = create_incident()
    url = f"/api/incidents/{incident['id']}"
    headers = auth_headers("ana")

    assert client.delete(url, params={"version": 99}, headers=headers).status_code == 409
    assert client.delete(url, params={"version": 1}, headers=headers).status_code == 204
    assert client.get(url, headers=headers).status_code == 404


def test_cannot_delete_incident_under_investigation(
    client: TestClient, auth_headers, create_incident
) -> None:
    incident = create_incident()
    headers = auth_headers("ana")
    client.patch(
        f"/api/incidents/{incident['id']}/status",
        json={"status": "investigating", "version": 1},
        headers=headers,
    )

    response = client.delete(
        f"/api/incidents/{incident['id']}", params={"version": 2}, headers=headers
    )

    assert response.status_code == 409
    assert response.json()["type"] == "/problems/incident-not-editable"
