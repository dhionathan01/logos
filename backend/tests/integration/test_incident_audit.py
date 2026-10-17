from fastapi.testclient import TestClient

from app.core.config import get_settings


def change_status(client: TestClient, headers: dict, incident_id: str, **body):
    return client.patch(f"/api/incidents/{incident_id}/status", json=body, headers=headers)


def events_of(client: TestClient, headers: dict, incident_id: str) -> list[dict]:
    response = client.get(f"/api/incidents/{incident_id}/events", headers=headers)
    assert response.status_code == 200
    return list(response.json())


def test_lifecycle_is_recorded_with_actor_and_timestamps(
    client: TestClient, auth_headers, create_incident
) -> None:
    incident = create_incident()
    ana = auth_headers("ana")

    claimed = change_status(client, ana, incident["id"], status="investigating", version=1).json()
    closed = change_status(
        client, ana, incident["id"], status="closed", version=2, resolution_note="Pneu trocado"
    ).json()

    assert claimed["first_claimed_at"] is not None
    assert closed["closed_at"] is not None
    events = events_of(client, ana, incident["id"])
    assert [(e["event_type"], e["from_status"], e["to_status"]) for e in events] == [
        ("created", None, "open"),
        ("status_changed", "open", "investigating"),
        ("status_changed", "investigating", "closed"),
    ]
    assert {e["actor"]["display_name"] for e in events} == {"Ana Souza"}
    assert events[-1]["changes"] == {"resolution_note": "Pneu trocado"}


def test_first_claim_time_survives_release_and_reclaim(
    client: TestClient, auth_headers, create_incident
) -> None:
    incident = create_incident()
    first = change_status(
        client, auth_headers("ana"), incident["id"], status="investigating", version=1
    ).json()
    change_status(client, auth_headers("ana"), incident["id"], status="open", version=2)

    reclaimed = change_status(
        client, auth_headers("bruno"), incident["id"], status="investigating", version=3
    ).json()

    assert reclaimed["first_claimed_at"] == first["first_claimed_at"]
    assert reclaimed["assignee"]["display_name"] == "Bruno Lima"


def test_rejected_change_leaves_no_audit_trail(
    client: TestClient, auth_headers, create_incident
) -> None:
    incident = create_incident()
    change_status(client, auth_headers("ana"), incident["id"], status="investigating", version=1)

    stale = change_status(
        client, auth_headers("bruno"), incident["id"], status="investigating", version=1
    )

    assert stale.status_code == 409
    assert len(events_of(client, auth_headers("ana"), incident["id"])) == 2


def test_detail_edits_record_what_changed(
    client: TestClient, auth_headers, create_incident
) -> None:
    incident = create_incident(severity="low")
    headers = auth_headers("bruno")

    client.patch(
        f"/api/incidents/{incident['id']}",
        json={"version": 1, "severity": "high", "title": "Pneu furado no eixo traseiro"},
        headers=headers,
    )

    last = events_of(client, headers, incident["id"])[-1]
    assert last["event_type"] == "details_updated"
    assert last["changes"] == {"severity": {"from": "low", "to": "high"}}
    assert last["actor"]["display_name"] == "Bruno Lima"


def test_fleet_reports_have_no_human_actor(client: TestClient, auth_headers) -> None:
    created = client.post(
        "/api/incidents",
        json={
            "title": "Neblina densa",
            "category": "adverse_weather",
            "vehicle_id": "CAM-0009",
            "location": "BR-376",
        },
        headers={"X-API-Key": get_settings().ingestion_api_key.get_secret_value()},
    ).json()

    events = events_of(client, auth_headers("ana"), created["id"])

    assert events[0]["actor"] is None


def test_events_of_unknown_incident_return_404(client: TestClient, auth_headers) -> None:
    response = client.get(
        "/api/incidents/00000000-0000-0000-0000-000000000000/events", headers=auth_headers("ana")
    )

    assert response.status_code == 404
