from sqlalchemy.orm import Session

from app.core.db import retry_transient_db_errors
from app.core.errors import AuthenticationError
from app.core.security import (
    AuthenticatedUser,
    create_access_token,
    verify_password,
)
from app.repositories.user_repository import UserRepository


class AuthService:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._users = UserRepository(session)

    @retry_transient_db_errors
    def _authenticate(self, username: str, password: str) -> AuthenticatedUser:
        with self._session.begin():
            user = self._users.find_by_username(username.strip().lower())
        # A senha é verificada mesmo sem usuário, para o tempo de resposta não revelar quem existe.
        password_matches = verify_password(password, user.password_hash if user else None)
        if user is None or not password_matches:
            raise AuthenticationError("Usuário ou senha incorretos.")
        return AuthenticatedUser(id=user.id, username=user.username, display_name=user.display_name)

    def login(self, username: str, password: str) -> tuple[AuthenticatedUser, str, int]:
        user = self._authenticate(username, password)
        token, expires_in = create_access_token(user)
        return user, token, expires_in
