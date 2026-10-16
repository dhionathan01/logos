import uuid
from typing import Annotated

from fastapi import APIRouter, Header, Query, Response, status

from app.api.deps import CurrentUser, IngestionSource, SessionDep
from app.schemas.incident import (
    IncidentCreate,
    IncidentFilters,
    IncidentPage,
    IncidentRead,
    IncidentSummary,
    IncidentUpdate,
    StatusChange,
)
from app.services.incident_service import IncidentService

router = APIRouter(prefix="/incidents", tags=["incidents"])

IdempotencyKey = Annotated[
    str | None,
    Header(
        alias="Idempotency-Key",
        min_length=8,
        max_length=64,
        pattern=r"^[A-Za-z0-9_-]+$",
        description="Identificador único do envio; reenvios com a mesma chave não duplicam.",
    ),
]


@router.get("", summary="Lista incidentes em ordem de prioridade")
def list_incidents(
    session: SessionDep, _: CurrentUser, filters: Annotated[IncidentFilters, Query()]
) -> IncidentPage:
    items, total = IncidentService(session).list_incidents(filters)
    return IncidentPage(
        items=[IncidentRead.model_validate(item) for item in items],
        total=total,
        limit=filters.limit,
        offset=filters.offset,
    )


@router.get("/summary", summary="Contadores para o painel de prioridades")
def summarize(session: SessionDep, _: CurrentUser) -> IncidentSummary:
    return IncidentService(session).summarize()


@router.get("/{incident_id}", summary="Detalhe de um incidente")
def get_incident(incident_id: uuid.UUID, session: SessionDep, _: CurrentUser) -> IncidentRead:
    return IncidentRead.model_validate(IncidentService(session).get_incident(incident_id))


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Registra um incidente (analista ou sistema da frota)",
    responses={200: {"description": "Reenvio idempotente: incidente já registrado"}},
)
def create_incident(
    payload: IncidentCreate,
    response: Response,
    session: SessionDep,
    _: IngestionSource,
    idempotency_key: IdempotencyKey = None,
) -> IncidentRead:
    result = IncidentService(session).create_incident(payload, idempotency_key)
    if not result.created:
        response.status_code = status.HTTP_200_OK
        response.headers["Idempotent-Replayed"] = "true"
    response.headers["Location"] = f"/api/incidents/{result.incident.id}"
    return IncidentRead.model_validate(result.incident)


@router.patch("/{incident_id}", summary="Edita dados do incidente (exige a versão lida)")
def update_incident(
    incident_id: uuid.UUID, payload: IncidentUpdate, session: SessionDep, user: CurrentUser
) -> IncidentRead:
    incident = IncidentService(session).update_details(incident_id, payload, user)
    return IncidentRead.model_validate(incident)


@router.patch("/{incident_id}/status", summary="Muda o status (assumir, devolver, concluir)")
def change_status(
    incident_id: uuid.UUID, payload: StatusChange, session: SessionDep, user: CurrentUser
) -> IncidentRead:
    incident = IncidentService(session).change_status(incident_id, payload, user)
    return IncidentRead.model_validate(incident)


@router.delete(
    "/{incident_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Exclui um incidente aberto registrado por engano",
)
def delete_incident(
    incident_id: uuid.UUID,
    session: SessionDep,
    _: CurrentUser,
    version: Annotated[int, Query(ge=1)],
) -> None:
    IncidentService(session).delete_incident(incident_id, version)
