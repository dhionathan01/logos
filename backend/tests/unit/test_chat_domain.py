import pytest

from app.domain.chat import (
    Notice,
    can_be_transferred,
    ends_assignment,
    notice_for_transition,
)
from app.domain.incident import Status


@pytest.mark.parametrize(
    ("previous", "target", "expected"),
    [
        (Status.OPEN, Status.INVESTIGATING, Notice.CLAIMED),
        (Status.INCONCLUSIVE, Status.INVESTIGATING, Notice.RESUMED),
        (Status.INVESTIGATING, Status.OPEN, Notice.RELEASED),
        (Status.INVESTIGATING, Status.CLOSED, Notice.CLOSED),
        (Status.INVESTIGATING, Status.INCONCLUSIVE, Notice.MARKED_INCONCLUSIVE),
    ],
)
def test_each_transition_has_its_chat_notice(
    previous: Status, target: Status, expected: Notice
) -> None:
    assert notice_for_transition(previous, target) is expected


def test_only_assigned_incidents_can_change_hands() -> None:
    assert can_be_transferred(Status.INVESTIGATING)
    assert can_be_transferred(Status.INCONCLUSIVE)
    assert not can_be_transferred(Status.OPEN)
    assert not can_be_transferred(Status.CLOSED)


def test_releasing_or_closing_ends_the_assignment() -> None:
    assert ends_assignment(Status.OPEN)
    assert ends_assignment(Status.CLOSED)
    assert not ends_assignment(Status.INCONCLUSIVE)
