from fastapi import APIRouter

from app.api.deps import CurrentUser, SessionDep
from app.schemas.chat import AnalystRead
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", summary="Analistas da central (para delegar incidentes)")
def list_analysts(session: SessionDep, _: CurrentUser) -> list[AnalystRead]:
    return [AnalystRead.model_validate(user) for user in UserService(session).analysts()]
