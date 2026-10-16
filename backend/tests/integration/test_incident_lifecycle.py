import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from fastapi.testclient import TestClient

from app.core.db import SessionFactory
from app.core.errors import NotAssigneeError, VersionConflictError
from app.core.security import AuthenticatedUser
from app.domain.incident import Status
from app.schemas.incident import StatusChange
from app.services.incident_service import IncidentService


def change_status(client: TestClient, headers: dict, incident_id: str, **body):
    return client.patch(f"/api/incidents/{incident_id}/status", json=body, headers=headers)


def test_claiming_assigns_incident_to_analyst(
    client: TestClient, auth_headers, create_incident
) -> None:
    incident = create_incident()

    response = change_status(
        client, auth_headers("ana"), incident["id"], status="investigating", version=1
    )

    assert response.status_code == 200
    assert response.json()["assignee"]["display_name"] == "Ana Souza"
    assert response.json()["version"] == 2


def test_stale_version_gets_conflict_with_current_state(
    client: TestClient, auth_headers, create_incident
) -> None:
    incident = create_incident()
    change_status(client, auth_headers("ana"), incident["id"], status="investigating", version=1)

    response = change_status(
        client, auth_headers("bruno"), incident["id"], status="investigating", version=1
    )

    assert response.status_code == 409
    body = response.json()
    assert body["type"] == "/problems/version-conflict"
    assert body["current"]["assignee"]["display_name"] == "Ana Souza"
    assert body["current"]["version"] == 2


def test_only_assignee_can_conclude_investigation(
    client: TestClient, auth_headers, create_incident
) -> None:
    incident = create_incident()
    change_status(client, auth_headers("ana"), incident["id"], status="investigating", version=1)

    by_bruno = change_status(
        client, auth_headers("bruno"), incident["id"], status="closed", version=2
    )
    by_ana = change_status(
        client,
        auth_headers("ana"),
        incident["id"],
        status="closed",
        version=2,
        resolution_note="Pneu trocado, veículo seguiu viagem.",
    )

    assert by_bruno.status_code == 403
    assert "Ana Souza" in by_bruno.json()["detail"]
    assert by_ana.status_code == 200
    assert by_ana.json()["resolution_note"] == "Pneu trocado, veículo seguiu viagem."


def test_invalid_transition_is_rejected(client: TestClient, auth_headers, create_incident) -> None:
    incident = create_incident()

    response = change_status(
        client, auth_headers("ana"), incident["id"], status="closed", version=1
    )

    assert response.status_code == 409
    assert response.json()["type"] == "/problems/invalid-transition"


def test_releasing_returns_incident_to_queue(
    client: TestClient, auth_headers, create_incident
) -> None:
    incident = create_incident()
    change_status(client, auth_headers("ana"), incident["id"], status="investigating", version=1)

    released = change_status(client, auth_headers("ana"), incident["id"], status="open", version=2)
    claimed_by_bruno = change_status(
        client, auth_headers("bruno"), incident["id"], status="investigating", version=3
    )

    assert released.json()["assignee"] is None
    assert claimed_by_bruno.json()["assignee"]["display_name"] == "Bruno Lima"


def test_closed_incident_cannot_be_edited(
    client: TestClient, auth_headers, create_incident
) -> None:
    incident = create_incident()
    headers = auth_headers("ana")
    change_status(client, headers, incident["id"], status="investigating", version=1)
    change_status(client, headers, incident["id"], status="closed", version=2)

    response = client.patch(
        f"/api/incidents/{incident['id']}", json={"version": 3, "title": "Novo"}, headers=headers
    )

    assert response.status_code == 409


def test_simultaneous_claims_have_exactly_one_winner(create_incident, analysts) -> None:
    """Dois analistas assumem o mesmo incidente no mesmo instante, em conexões diferentes."""
    incident = create_incident()
    contenders = [
        AuthenticatedUser(id=user.id, username=user.username, display_name=user.display_name)
        for user in analysts.values()
    ]
    start_together = Barrier(len(contenders))

    def claim(actor: AuthenticatedUser) -> str:
        with SessionFactory() as session:
            start_together.wait()
            try:
                IncidentService(session).change_status(
                    uuid.UUID(incident["id"]),
                    StatusChange(status=Status.INVESTIGATING, version=1),
                    actor,
                )
                return "won"
            except (VersionConflictError, NotAssigneeError):
                return "conflict"

    with ThreadPoolExecutor(max_workers=len(contenders)) as pool:
        outcomes = sorted(pool.map(claim, contenders))

    assert outcomes == ["conflict", "won"]
