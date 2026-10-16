import hmac
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from app.core.config import get_settings
from app.core.errors import AuthenticationError

JWT_ALGORITHM = "HS256"

# Hash usado quando o usuário não existe, para que login com usuário inválido
# leve o mesmo tempo que senha errada (evita enumerar usuários pelo tempo de resposta).
_DUMMY_PASSWORD_HASH = bcrypt.hashpw(b"timing-equalizer", bcrypt.gensalt()).decode()


@dataclass(frozen=True, slots=True)
class AuthenticatedUser:
    id: uuid.UUID
    username: str
    display_name: str


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str | None) -> bool:
    candidate_hash = password_hash or _DUMMY_PASSWORD_HASH
    matches = bcrypt.checkpw(password.encode(), candidate_hash.encode())
    return matches and password_hash is not None


def create_access_token(user: AuthenticatedUser) -> tuple[str, int]:
    settings = get_settings()
    expires_in = settings.jwt_expiration_minutes * 60
    now = datetime.now(UTC)
    claims = {
        "sub": str(user.id),
        "username": user.username,
        "name": user.display_name,
        "iat": now,
        "exp": now + timedelta(seconds=expires_in),
    }
    token = jwt.encode(claims, settings.jwt_secret.get_secret_value(), algorithm=JWT_ALGORITHM)
    return token, expires_in


def decode_access_token(token: str) -> AuthenticatedUser:
    try:
        claims = jwt.decode(
            token,
            get_settings().jwt_secret.get_secret_value(),
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "exp"]},
        )
        return AuthenticatedUser(
            id=uuid.UUID(claims["sub"]),
            username=str(claims["username"]),
            display_name=str(claims["name"]),
        )
    except jwt.ExpiredSignatureError as error:
        raise AuthenticationError("Sessão expirada. Entre novamente.") from error
    except (jwt.InvalidTokenError, KeyError, ValueError) as error:
        raise AuthenticationError("Token de acesso inválido.") from error


def is_valid_ingestion_key(candidate: str) -> bool:
    expected = get_settings().ingestion_api_key.get_secret_value()
    return hmac.compare_digest(candidate.encode(), expected.encode())
