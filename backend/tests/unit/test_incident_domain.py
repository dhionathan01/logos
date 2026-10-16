import pytest

from app.domain.incident import (
    ALLOWED_TRANSITIONS,
    Category,
    Severity,
    Status,
    can_transition,
    default_severity_for,
    is_restricted_to_assignee,
    requires_assignee,
)


@pytest.mark.parametrize(
    ("current", "target"),
    [
        (Status.OPEN, Status.INVESTIGATING),
        (Status.INVESTIGATING, Status.CLOSED),
        (Status.INVESTIGATING, Status.INCONCLUSIVE),
        (Status.INVESTIGATING, Status.OPEN),
        (Status.INCONCLUSIVE, Status.INVESTIGATING),
        (Status.INCONCLUSIVE, Status.CLOSED),
    ],
)
def test_allowed_transitions(current: Status, target: Status) -> None:
    assert can_transition(current, target)


@pytest.mark.parametrize(
    ("current", "target"),
    [
        (Status.OPEN, Status.CLOSED),
        (Status.OPEN, Status.INCONCLUSIVE),
        (Status.OPEN, Status.OPEN),
        (Status.CLOSED, Status.OPEN),
        (Status.CLOSED, Status.INVESTIGATING),
        (Status.INCONCLUSIVE, Status.OPEN),
    ],
)
def test_forbidden_transitions(current: Status, target: Status) -> None:
    assert not can_transition(current, target)


def test_every_status_has_transition_rules() -> None:
    assert set(ALLOWED_TRANSITIONS) == set(Status)


def test_victims_are_always_high_severity_by_default() -> None:
    assert default_severity_for(Category.ACCIDENT_WITH_VICTIMS) is Severity.HIGH


def test_every_category_has_default_severity() -> None:
    for category in Category:
        assert default_severity_for(category) in Severity


def test_investigation_assigns_and_locks_to_assignee() -> None:
    assert requires_assignee(Status.INVESTIGATING)
    assert is_restricted_to_assignee(Status.INVESTIGATING)
    assert not is_restricted_to_assignee(Status.OPEN)
