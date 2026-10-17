import pytest
from fastapi.testclient import TestClient


def post(client: TestClient, headers: dict, **body):
    return client.post("/api/chat/messages", json=body, headers=headers)


def test_message_is_stored_and_returned_in_history(
    client: TestClient, auth_headers, create_incident
) -> None:
    incident = create_incident(title="Pneu furado")

    created = post(client, auth_headers("ana"), body="  Alguém perto da BR-116?  ")
    linked = post(client, auth_headers("bruno"), body="Eu vejo esse", incident_id=incident["id"])

    assert created.status_code == 201
    assert created.json()["body"] == "Alguém perto da BR-116?"
    assert created.json()["author"]["display_name"] == "Ana Souza"
    assert linked.json()["incident"]["title"] == "Pneu furado"

    history = client.get("/api/chat/messages", headers=auth_headers("ana")).json()
    bodies = [item["body"] for item in history["items"] if item["kind"] == "user"]
    assert bodies == ["Alguém perto da BR-116?", "Eu vejo esse"]


def test_history_pages_backwards(client: TestClient, auth_headers, analysts) -> None:
    headers = auth_headers("ana")
    for index in range(5):
        post(client, headers, body=f"mensagem {index}")

    latest = client.get("/api/chat/messages", params={"limit": 2}, headers=headers).json()
    older = client.get(
        "/api/chat/messages",
        params={"limit": 2, "before_id": latest["items"][0]["id"]},
        headers=headers,
    ).json()

    assert [m["body"] for m in latest["items"]] == ["mensagem 3", "mensagem 4"]
    assert latest["has_more"] is True
    assert [m["body"] for m in older["items"]] == ["mensagem 1", "mensagem 2"]


@pytest.mark.parametrize(
    "body",
    [{"body": "   "}, {"body": "x" * 1001}, {"body": "oi", "autor": "admin"}, {}],
)
def test_rejects_invalid_messages(client: TestClient, auth_headers, body: dict) -> None:
    response = client.post("/api/chat/messages", json=body, headers=auth_headers("ana"))

    assert response.status_code == 422


def test_rejects_mention_of_unknown_incident(client: TestClient, auth_headers) -> None:
    response = post(
        client,
        auth_headers("ana"),
        body="olhem esse",
        incident_id="00000000-0000-0000-0000-000000000000",
    )

    assert response.status_code == 404


def test_chat_requires_authentication(client: TestClient) -> None:
    assert client.get("/api/chat/messages").status_code == 401
    assert client.post("/api/chat/messages", json={"body": "oi"}).status_code == 401
