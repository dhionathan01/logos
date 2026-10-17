from datetime import UTC, datetime, timedelta

from app.domain.incident import Severity
from app.domain.sla import SLA_TARGETS, is_breaching_resolution, met_resolution_sla

REPORTED = datetime(2026, 10, 16, 12, 0, tzinfo=UTC)


def test_every_severity_has_targets_with_response_before_resolution() -> None:
    assert set(SLA_TARGETS) == set(Severity)
    for target in SLA_TARGETS.values():
        assert target.response < target.resolution


def test_high_severity_closed_within_two_hours_meets_sla() -> None:
    assert met_resolution_sla(Severity.HIGH, REPORTED, REPORTED + timedelta(hours=2))
    assert not met_resolution_sla(Severity.HIGH, REPORTED, REPORTED + timedelta(hours=2, minutes=1))


def test_low_severity_has_a_full_day() -> None:
    assert met_resolution_sla(Severity.LOW, REPORTED, REPORTED + timedelta(hours=20))


def test_open_incident_breaches_after_resolution_target() -> None:
    assert not is_breaching_resolution(Severity.MEDIUM, REPORTED, REPORTED + timedelta(hours=7))
    assert is_breaching_resolution(Severity.MEDIUM, REPORTED, REPORTED + timedelta(hours=9))
