from datetime import UTC, datetime, timedelta

import jwt
from fastapi.testclient import TestClient

from app.core.config import get_settings
from tests.integration.conftest import TEST_PASSWORD


def test_login_returns_token_and_user(client: TestClient, analysts: dict) -> None:
    response = client.post("/api/auth/login", json={"username": "ANA ", "password": TEST_PASSWORD})

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["display_name"] == "Ana Souza"


def test_wrong_password_and_unknown_user_get_the_same_answer(
    client: TestClient, analysts: dict
) -> None:
    wrong_password = client.post("/api/auth/login", json={"username": "ana", "password": "x"})
    unknown_user = client.post("/api/auth/login", json={"username": "zeca", "password": "x"})

    assert wrong_password.status_code == unknown_user.status_code == 401
    assert wrong_password.json()["detail"] == unknown_user.json()["detail"]
    assert wrong_password.headers["content-type"] == "application/problem+json"


def test_protected_routes_require_token(client: TestClient) -> None:
    assert client.get("/api/incidents").status_code == 401
    assert client.get("/api/auth/me").status_code == 401


def test_expired_token_is_rejected(client: TestClient, analysts: dict) -> None:
    expired = jwt.encode(
        {
            "sub": str(analysts["ana"].id),
            "username": "ana",
            "name": "Ana Souza",
            "exp": datetime.now(UTC) - timedelta(minutes=1),
        },
        get_settings().jwt_secret.get_secret_value(),
        algorithm="HS256",
    )

    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired}"})

    assert response.status_code == 401
    assert "expirada" in response.json()["detail"]


def test_tampered_token_is_rejected(client: TestClient, auth_headers) -> None:
    headers = auth_headers("ana")
    headers["Authorization"] = headers["Authorization"][:-2] + "xx"

    assert client.get("/api/auth/me", headers=headers).status_code == 401
