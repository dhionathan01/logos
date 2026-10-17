from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.core.db import SessionFactory
from app.domain.incident import Category, Severity, Status
from app.models import Incident, User

NOW = datetime.now(UTC)


def insert(
    *,
    severity: Severity,
    category: Category,
    status: Status,
    hours_ago: float,
    claimed_after: timedelta | None = None,
    closed_after: timedelta | None = None,
    assignee: User | None = None,
) -> None:
    reported_at = NOW - timedelta(hours=hours_ago)
    with SessionFactory.begin() as session:
        session.add(
            Incident(
                title="Incidente de teste",
                category=category,
                severity=severity,
                status=status,
                vehicle_id="CAM-0001",
                location="BR-116",
                reported_at=reported_at,
                first_claimed_at=reported_at + claimed_after if claimed_after else None,
                closed_at=reported_at + closed_after if closed_after else None,
                assignee_id=assignee.id if assignee else None,
            )
        )


@pytest.fixture
def scenario(analysts: dict[str, User]) -> None:
    ana, bruno = analysts["ana"], analysts["bruno"]
    # Dentro do SLA: alta resolvida em 1 h, assumida em 10 min.
    insert(
        severity=Severity.HIGH,
        category=Category.ACCIDENT_WITH_VICTIMS,
        status=Status.CLOSED,
        hours_ago=3,
        claimed_after=timedelta(minutes=10),
        closed_after=timedelta(hours=1),
        assignee=ana,
    )
    # Fora do SLA nos dois marcos: assumida em 30 min, resolvida em 3 h.
    insert(
        severity=Severity.HIGH,
        category=Category.VEHICLE_ACCIDENT,
        status=Status.CLOSED,
        hours_ago=5,
        claimed_after=timedelta(minutes=30),
        closed_after=timedelta(hours=3),
        assignee=ana,
    )
    # Ainda em investigação e já além das 8 h da criticidade média: violação em aberto.
    insert(
        severity=Severity.MEDIUM,
        category=Category.MECHANICAL_FAILURE,
        status=Status.INVESTIGATING,
        hours_ago=10,
        claimed_after=timedelta(minutes=20),
        assignee=bruno,
    )
    # Aberto há pouco, sem violação.
    insert(
        severity=Severity.LOW,
        category=Category.MECHANICAL_FAILURE,
        status=Status.OPEN,
        hours_ago=1,
    )


def test_overview_computes_volume_resolution_and_sla(
    client: TestClient, auth_headers, scenario
) -> None:
    overview = client.get("/api/analytics", headers=auth_headers("ana")).json()["overview"]

    assert overview["total"] == 4
    assert overview["active"] == 2
    assert overview["closed"] == 2
    assert overview["resolution_rate"] == pytest.approx(0.5)
    assert overview["avg_resolution_minutes"] == pytest.approx(120)
    assert overview["response_sla_rate"] == pytest.approx(2 / 3, abs=1e-3)
    assert overview["resolution_sla_rate"] == pytest.approx(0.5)
    assert overview["breaching_now"] == 1


def test_breakdowns_by_category_severity_and_analyst(
    client: TestClient, auth_headers, scenario
) -> None:
    report = client.get("/api/analytics", headers=auth_headers("ana")).json()

    assert report["by_category"][0]["category"] == "mechanical_failure"
    assert len(report["by_category"]) == len(Category)

    high = next(item for item in report["by_severity"] if item["severity"] == "high")
    assert high["resolution_target_minutes"] == 120
    assert high["resolution_sla_rate"] == pytest.approx(0.5)

    ana = next(
        item for item in report["by_analyst"] if item["analyst"]["display_name"] == "Ana Souza"
    )
    assert ana["assigned"] == 2
    assert ana["closed"] == 2
    assert ana["by_category"]["accident_with_victims"] == 1
    assert ana["by_category"]["vehicle_accident"] == 1
    assert ana["by_category"]["road_block"] == 0


def test_daily_series_covers_reported_incidents(client: TestClient, auth_headers, scenario) -> None:
    daily = client.get("/api/analytics", headers=auth_headers("ana")).json()["daily"]

    assert sum(point["reported"] for point in daily) == 4
    assert sum(point["closed"] for point in daily) == 2


def test_period_filter_restricts_every_indicator(
    client: TestClient, auth_headers, scenario
) -> None:
    report = client.get(
        "/api/analytics",
        params={"reported_from": (NOW - timedelta(hours=2)).isoformat()},
        headers=auth_headers("ana"),
    ).json()

    assert report["overview"]["total"] == 1
    assert report["by_analyst"] == []


def test_empty_period_returns_zeros_not_errors(client: TestClient, auth_headers) -> None:
    report = client.get("/api/analytics", headers=auth_headers("ana")).json()

    assert report["overview"]["total"] == 0
    assert report["overview"]["resolution_rate"] is None
    assert report["daily"] == []


@pytest.mark.parametrize(
    "params",
    [{"tz": "Marte/Olympus"}, {"reported_from": "2026-10-16T00:00:00"}, {"extra": "1"}],
)
def test_rejects_invalid_parameters(client: TestClient, auth_headers, params: dict) -> None:
    response = client.get("/api/analytics", params=params, headers=auth_headers("ana"))

    assert response.status_code == 422


def test_requires_authentication(client: TestClient) -> None:
    assert client.get("/api/analytics").status_code == 401
