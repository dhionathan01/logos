import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import analytics, auth, chat, handovers, health, incidents, stream, users
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.realtime.broadcaster import Broadcaster


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    app.state.broadcaster = Broadcaster(settings.database_url)
    if settings.realtime_enabled:
        await app.state.broadcaster.start()
    try:
        yield
    finally:
        await app.state.broadcaster.stop()


def create_app() -> FastAPI:
    settings = get_settings()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

    is_production = settings.environment == "production"
    app = FastAPI(
        title="Logos API",
        version="0.1.0",
        description="Central de Resposta a Incidentes: ingestão, priorização e ciclo de vida.",
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[] if is_production else settings.cors_origins,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "Idempotency-Key",
            "X-API-Key",
            "Last-Event-ID",
        ],
    )
    register_error_handlers(app)

    api = APIRouter(prefix="/api")
    for module in (health, auth, incidents, handovers, analytics, chat, users, stream):
        api.include_router(module.router)
    app.include_router(api)
    return app


app = create_app()
