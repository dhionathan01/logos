"""Erros de domínio e sua tradução para Problem Details (RFC 9457)."""

import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.db import is_transient_db_error

logger = logging.getLogger(__name__)

PROBLEM_CONTENT_TYPE = "application/problem+json"


class DomainError(Exception):
    status_code = status.HTTP_400_BAD_REQUEST
    problem_type = "about:blank"
    title = "Requisição inválida"

    def __init__(self, detail: str, **extensions: Any) -> None:
        super().__init__(detail)
        self.detail = detail
        self.extensions = extensions


class NotFoundError(DomainError):
    status_code = status.HTTP_404_NOT_FOUND
    problem_type = "/problems/not-found"
    title = "Recurso não encontrado"


class VersionConflictError(DomainError):
    status_code = status.HTTP_409_CONFLICT
    problem_type = "/problems/version-conflict"
    title = "O incidente foi alterado por outra pessoa"


class InvalidTransitionError(DomainError):
    status_code = status.HTTP_409_CONFLICT
    problem_type = "/problems/invalid-transition"
    title = "Mudança de status não permitida"


class NotAssigneeError(DomainError):
    status_code = status.HTTP_403_FORBIDDEN
    problem_type = "/problems/not-assignee"
    title = "Incidente sob responsabilidade de outro analista"


class IncidentNotEditableError(DomainError):
    status_code = status.HTTP_409_CONFLICT
    problem_type = "/problems/incident-not-editable"
    title = "O incidente não pode ser alterado no status atual"


class HandoverNotAllowedError(DomainError):
    status_code = status.HTTP_409_CONFLICT
    problem_type = "/problems/handover-not-allowed"
    title = "Passagem do incidente não permitida"


class DuplicateHandoverError(DomainError):
    status_code = status.HTTP_409_CONFLICT
    problem_type = "/problems/handover-already-pending"
    title = "Já existe um pedido pendente para este incidente"


class DuplicateIncidentError(DomainError):
    status_code = status.HTTP_409_CONFLICT
    problem_type = "/problems/duplicate-idempotency-key"
    title = "Chave de idempotência já usada com outro conteúdo"


class AuthenticationError(DomainError):
    status_code = status.HTTP_401_UNAUTHORIZED
    problem_type = "/problems/unauthorized"
    title = "Não autenticado"


def problem_response(
    *,
    status_code: int,
    title: str,
    detail: str,
    problem_type: str = "about:blank",
    instance: str | None = None,
    headers: dict[str, str] | None = None,
    **extensions: Any,
) -> JSONResponse:
    body: dict[str, Any] = {
        "type": problem_type,
        "title": title,
        "status": status_code,
        "detail": detail,
        **extensions,
    }
    if instance:
        body["instance"] = instance
    return JSONResponse(
        status_code=status_code,
        content=body,
        media_type=PROBLEM_CONTENT_TYPE,
        headers=headers,
    )


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def handle_domain_error(request: Request, error: DomainError) -> JSONResponse:
        headers = {"WWW-Authenticate": "Bearer"} if isinstance(error, AuthenticationError) else None
        return problem_response(
            status_code=error.status_code,
            title=error.title,
            detail=error.detail,
            problem_type=error.problem_type,
            instance=request.url.path,
            headers=headers,
            **error.extensions,
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, error: RequestValidationError
    ) -> JSONResponse:
        errors = [
            {
                "field": ".".join(str(part) for part in item["loc"] if part != "body"),
                "message": item["msg"],
            }
            for item in error.errors()
        ]
        return problem_response(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            title="Dados inválidos",
            detail="Um ou mais campos não passaram na validação.",
            problem_type="/problems/validation-error",
            instance=request.url.path,
            errors=errors,
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(request: Request, error: StarletteHTTPException) -> JSONResponse:
        return problem_response(
            status_code=error.status_code,
            title=str(error.detail),
            detail=str(error.detail),
            instance=request.url.path,
        )

    @app.exception_handler(SQLAlchemyError)
    async def handle_database_error(request: Request, error: SQLAlchemyError) -> JSONResponse:
        if is_transient_db_error(error):
            logger.warning("Banco indisponível após novas tentativas: %s", error)
            return problem_response(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                title="Serviço temporariamente indisponível",
                detail="O banco de dados não respondeu a tempo. Tente novamente em instantes.",
                problem_type="/problems/database-unavailable",
                instance=request.url.path,
                headers={"Retry-After": "5"},
            )
        logger.exception("Erro inesperado de banco de dados")
        return _internal_error(request)

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, error: Exception) -> JSONResponse:
        logger.exception("Erro não tratado")
        return _internal_error(request)


def _internal_error(request: Request) -> JSONResponse:
    return problem_response(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        title="Erro interno",
        detail="Ocorreu um erro inesperado. A equipe foi notificada.",
        instance=request.url.path,
    )
