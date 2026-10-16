from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.db import get_session

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live", summary="O processo está de pé")
def liveness() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready", summary="A API consegue falar com o banco")
def readiness(session: Session = Depends(get_session)) -> dict[str, str]:
    session.execute(text("SELECT 1"))
    return {"status": "ok", "database": "ok"}
