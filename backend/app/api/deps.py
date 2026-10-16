from typing import Annotated

from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.db import get_session
from app.core.errors import AuthenticationError
from app.core.security import AuthenticatedUser, decode_access_token, is_valid_ingestion_key

_bearer = HTTPBearer(auto_error=False, description="Token JWT obtido em /api/auth/login")

SessionDep = Annotated[Session, Depends(get_session)]


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> AuthenticatedUser:
    if credentials is None:
        raise AuthenticationError("Faça login para continuar.")
    return decode_access_token(credentials.credentials)


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]


def get_ingestion_source(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> AuthenticatedUser | None:
    """Incidentes podem chegar de um analista (JWT) ou de um sistema da frota (API key)."""
    if api_key is not None:
        if not is_valid_ingestion_key(api_key):
            raise AuthenticationError("Chave de ingestão inválida.")
        return None
    return get_current_user(credentials)


IngestionSource = Annotated[AuthenticatedUser | None, Depends(get_ingestion_source)]
