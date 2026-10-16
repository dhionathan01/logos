from collections.abc import Callable, Iterator
from typing import Any

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.core.db import SessionFactory, engine
from app.core.security import hash_password
from app.main import app
from app.models import User

TEST_PASSWORD = "senha-de-teste"


@pytest.fixture(scope="session", autouse=True)
def _migrated_database() -> None:
    command.upgrade(Config("alembic.ini"), "head")


@pytest.fixture(autouse=True)
def _clean_tables() -> Iterator[None]:
    yield
    with engine.begin() as connection:
        connection.execute(text("TRUNCATE incidents, users RESTART IDENTITY CASCADE"))


@pytest.fixture(scope="session")
def _password_hash() -> str:
    return hash_password(TEST_PASSWORD)


@pytest.fixture
def analysts(_password_hash: str) -> dict[str, User]:
    with SessionFactory.begin() as session:
        users = {
            "ana": User(username="ana", display_name="Ana Souza", password_hash=_password_hash),
            "bruno": User(
                username="bruno", display_name="Bruno Lima", password_hash=_password_hash
            ),
        }
        session.add_all(users.values())
    return users


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def auth_headers(client: TestClient, analysts: dict[str, User]) -> Callable[[str], dict[str, str]]:
    tokens: dict[str, str] = {}

    def headers_for(username: str) -> dict[str, str]:
        if username not in tokens:
            response = client.post(
                "/api/auth/login", json={"username": username, "password": TEST_PASSWORD}
            )
            tokens[username] = response.json()["access_token"]
        return {"Authorization": f"Bearer {tokens[username]}"}

    return headers_for


@pytest.fixture
def create_incident(
    client: TestClient, auth_headers: Callable[[str], dict[str, str]]
) -> Callable[..., dict[str, Any]]:
    def create(**overrides: Any) -> dict[str, Any]:
        payload = {
            "title": "Pneu furado no eixo traseiro",
            "category": "mechanical_failure",
            "vehicle_id": "CAM-0421",
            "location": "BR-116, km 212",
            **overrides,
        }
        response = client.post("/api/incidents", json=payload, headers=auth_headers("ana"))
        assert response.status_code == 201, response.text
        return dict(response.json())

    return create
