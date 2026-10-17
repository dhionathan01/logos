from sqlalchemy.orm import Session

from app.core.db import retry_transient_db_errors
from app.models import User
from app.repositories.user_repository import UserRepository


class UserService:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._users = UserRepository(session)

    @retry_transient_db_errors
    def analysts(self) -> list[User]:
        with self._session.begin():
            return self._users.all()
