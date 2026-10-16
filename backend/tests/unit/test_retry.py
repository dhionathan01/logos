import pytest
from sqlalchemy.exc import IntegrityError, OperationalError

from app.core.db import retry_transient_db_errors


def transient_error() -> OperationalError:
    return OperationalError("SELECT 1", {}, Exception("server closed the connection"))


def test_transient_errors_are_retried_until_success() -> None:
    attempts = []

    @retry_transient_db_errors
    def flaky_query() -> str:
        attempts.append(1)
        if len(attempts) < 3:
            raise transient_error()
        return "ok"

    assert flaky_query() == "ok"
    assert len(attempts) == 3


def test_gives_up_after_max_attempts() -> None:
    attempts = []

    @retry_transient_db_errors
    def always_down() -> None:
        attempts.append(1)
        raise transient_error()

    with pytest.raises(OperationalError):
        always_down()
    assert len(attempts) == 3


def test_non_transient_errors_are_not_retried() -> None:
    attempts = []

    @retry_transient_db_errors
    def violates_constraint() -> None:
        attempts.append(1)
        raise IntegrityError("INSERT", {}, Exception("duplicate key"))

    with pytest.raises(IntegrityError):
        violates_constraint()
    assert len(attempts) == 1
