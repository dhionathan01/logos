import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from fastapi.testclient import TestClient

from app.core.db import SessionFactory
from app.core.errors import DuplicateHandoverError
from app.core.security import AuthenticatedUser
from app.schemas.chat import HandoverCreate
from app.services.handover_service import HandoverService


def claim(client: TestClient, headers: dict, incident: dict, version: int = 1):
    return client.patch(
        f"/api/incidents/{incident['id']}/status",
        json={"status": "investigating", "version": version},
        headers=headers,
    )


def request_handover(client: TestClient, headers: dict, incident: dict, reason: str = ""):
    return client.post(
        f"/api/incidents/{incident['id']}/handover-requests",
        json={"reason": reason},
        headers=headers,
    )


def chat_notices(client: TestClient, headers: dict) -> list[str | None]:
    items = client.get("/api/chat/messages", headers=headers).json()["items"]
    return [item["notice"] for item in items]


def test_claim_and_conflict_are_announced_in_chat(
    client: TestClient, auth_headers, create_incident
) -> None:
    incident = create_incident()
    claim(client, auth_headers("ana"), incident)

    lost_race = claim(client, auth_headers("bruno"), incident)

    assert lost_race.status_code == 409
    items = client.get("/api/chat/messages", headers=auth_headers("ana")).json()["items"]
    conflict = items[-1]
    assert conflict["notice"] == "claim_conflict"
    assert conflict["author"]["display_name"] == "Bruno Lima"
    assert "Ana Souza já está investigando" in conflict["body"]


def test_accepted_request_transfers_the_incident(
    client: TestClient, auth_headers, create_incident
) -> None:
    incident = create_incident()
    claim(client, auth_headers("ana"), incident)

    requested = request_handover(
        client, auth_headers("bruno"), incident, "Já falei com o motorista"
    )
    accepted = client.post(
        f"/api/handover-requests/{requested.json()['id']}/accept", headers=auth_headers("ana")
    )

    assert requested.status_code == 201
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "accepted"
    current = client.get(f"/api/incidents/{incident['id']}", headers=auth_headers("ana")).json()
    assert current["assignee"]["display_name"] == "Bruno Lima"
    assert current["version"] == 3

    events = client.get(
        f"/api/incidents/{incident['id']}/events", headers=auth_headers("ana")
    ).json()
    assert events[-1]["event_type"] == "assignee_changed"
    assert events[-1]["changes"]["assignee"] == {"from": "Ana Souza", "to": "Bruno Lima"}

    notices = chat_notices(client, auth_headers("bruno"))
    assert notices[-2:] == ["handover_requested", "handover_accepted"]


def test_handover_card_reflects_current_status(
    client: TestClient, auth_headers, create_incident
) -> None:
    incident = create_incident()
    claim(client, auth_headers("ana"), incident)
    handover = request_handover(client, auth_headers("bruno"), incident).json()
    client.post(f"/api/handover-requests/{handover['id']}/decline", headers=auth_headers("ana"))

    items = client.get("/api/chat/messages", headers=auth_headers("bruno")).json()["items"]
    card = next(item for item in items if item["kind"] == "handover")

    assert card["handover"]["status"] == "declined"


def test_only_the_owner_answers_and_only_the_requester_cancels(
    client: TestClient, auth_headers, create_incident
) -> None:
    incident = create_incident()
    claim(client, auth_headers("ana"), incident)
    handover = request_handover(client, auth_headers("bruno"), incident).json()
    url = f"/api/handover-requests/{handover['id']}"

    assert client.post(f"{url}/accept", headers=auth_headers("bruno")).status_code == 403
    assert client.post(f"{url}/cancel", headers=auth_headers("ana")).status_code == 403
    assert client.post(f"{url}/cancel", headers=auth_headers("bruno")).status_code == 200
    assert client.post(f"{url}/accept", headers=auth_headers("ana")).status_code == 409


def test_cannot_request_open_or_own_incident(
    client: TestClient, auth_headers, create_incident
) -> None:
    incident = create_incident()

    open_incident = request_handover(client, auth_headers("bruno"), incident)
    claim(client, auth_headers("ana"), incident)
    own_incident = request_handover(client, auth_headers("ana"), incident)

    assert open_incident.status_code == 409
    assert open_incident.json()["type"] == "/problems/handover-not-allowed"
    assert own_incident.status_code == 409


def test_only_one_pending_request_per_incident(
    client: TestClient, auth_headers, create_incident
) -> None:
    incident = create_incident()
    claim(client, auth_headers("ana"), incident)
    request_handover(client, auth_headers("bruno"), incident)

    again = request_handover(client, auth_headers("bruno"), incident)

    assert again.status_code == 409
    assert again.json()["type"] == "/problems/handover-already-pending"


def test_simultaneous_requests_create_a_single_pending_one(
    client: TestClient, auth_headers, create_incident, analysts
) -> None:
    incident = create_incident()
    claim(client, auth_headers("ana"), incident)
    bruno = analysts["bruno"]
    requester = AuthenticatedUser(id=bruno.id, username=bruno.username, display_name="Bruno Lima")
    start_together = Barrier(2)

    def ask() -> str:
        with SessionFactory() as session:
            start_together.wait()
            try:
                HandoverService(session).request(
                    uuid.UUID(incident["id"]), requester, HandoverCreate()
                )
                return "created"
            except DuplicateHandoverError:
                return "duplicate"

    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = sorted(pool.map(lambda _: ask(), range(2)))

    assert outcomes == ["created", "duplicate"]


def test_releasing_the_incident_cancels_pending_requests(
    client: TestClient, auth_headers, create_incident
) -> None:
    incident = create_incident()
    claim(client, auth_headers("ana"), incident)
    handover = request_handover(client, auth_headers("bruno"), incident).json()

    client.patch(
        f"/api/incidents/{incident['id']}/status",
        json={"status": "open", "version": 2},
        headers=auth_headers("ana"),
    )

    requests = client.get(
        f"/api/incidents/{incident['id']}/handover-requests", headers=auth_headers("ana")
    ).json()
    assert requests[0]["id"] == handover["id"]
    assert requests[0]["status"] == "cancelled"


def test_owner_can_delegate_directly(
    client: TestClient, auth_headers, create_incident, analysts
) -> None:
    incident = create_incident()
    claim(client, auth_headers("ana"), incident)
    url = f"/api/incidents/{incident['id']}/delegate"
    bruno_id = str(analysts["bruno"].id)

    by_other = client.post(
        url, json={"to_user_id": bruno_id, "version": 2}, headers=auth_headers("bruno")
    )
    stale = client.post(
        url, json={"to_user_id": bruno_id, "version": 1}, headers=auth_headers("ana")
    )
    delegated = client.post(
        url, json={"to_user_id": bruno_id, "version": 2}, headers=auth_headers("ana")
    )

    assert by_other.status_code == 403
    assert stale.status_code == 409
    assert delegated.status_code == 200
    assert delegated.json()["assignee"]["display_name"] == "Bruno Lima"
    assert chat_notices(client, auth_headers("ana"))[-1] == "delegated"


def test_lists_analysts_for_delegation(client: TestClient, auth_headers) -> None:
    analysts = client.get("/api/users", headers=auth_headers("ana")).json()

    assert [analyst["display_name"] for analyst in analysts] == ["Ana Souza", "Bruno Lima"]
