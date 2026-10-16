from fastapi import APIRouter

from app.api.deps import CurrentUser, SessionDep
from app.schemas.auth import LoginRequest, TokenResponse, UserRead
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", summary="Autentica um analista e devolve um token JWT")
def login(payload: LoginRequest, session: SessionDep) -> TokenResponse:
    user, token, expires_in = AuthService(session).login(payload.username, payload.password)
    return TokenResponse(
        access_token=token,
        expires_in=expires_in,
        user=UserRead(id=user.id, username=user.username, display_name=user.display_name),
    )


@router.get("/me", summary="Dados do analista autenticado")
def me(user: CurrentUser) -> UserRead:
    return UserRead(id=user.id, username=user.username, display_name=user.display_name)
