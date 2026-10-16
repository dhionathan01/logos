from collections.abc import Callable, Iterator
from functools import wraps
from typing import ParamSpec, TypeVar

from sqlalchemy import Engine, create_engine
from sqlalchemy.exc import DBAPIError, OperationalError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential_jitter

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


def build_engine(database_url: str | None = None) -> Engine:
    settings = get_settings()
    return create_engine(
        database_url or settings.database_url,
        pool_size=settings.db_pool_size,
        pool_pre_ping=True,
        pool_timeout=settings.db_connect_timeout_seconds,
        connect_args={
            "connect_timeout": settings.db_connect_timeout_seconds,
            "options": f"-c statement_timeout={settings.db_statement_timeout_ms}",
        },
    )


engine = build_engine()
SessionFactory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_session() -> Iterator[Session]:
    with SessionFactory() as session:
        yield session


def is_transient_db_error(error: BaseException) -> bool:
    """Falhas que tendem a se resolver sozinhas: conexão caída, timeout, failover."""
    if isinstance(error, OperationalError):
        return True
    return isinstance(error, DBAPIError) and error.connection_invalidated


P = ParamSpec("P")
R = TypeVar("R")


def retry_transient_db_errors(func: Callable[P, R]) -> Callable[P, R]:
    """Reexecuta a operação inteira com backoff exponencial + jitter.

    A função decorada deve abrir a própria transação (`session.begin()`), para que
    cada tentativa comece limpa. Só é seguro em operações idempotentes ou
    protegidas por versão: se o commit aconteceu e apenas a resposta se perdeu,
    a nova tentativa resulta em conflito de versão em vez de aplicar a mudança
    duas vezes.
    """
    decorated = retry(
        retry=retry_if_exception(is_transient_db_error),
        stop=stop_after_attempt(get_settings().db_retry_attempts),
        wait=wait_exponential_jitter(initial=0.2, max=2),
        reraise=True,
    )(func)

    @wraps(func)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        return decorated(*args, **kwargs)

    return wrapper
