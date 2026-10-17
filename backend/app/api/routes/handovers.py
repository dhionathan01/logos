import uuid

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, SessionDep
from app.schemas.chat import DelegateRequest, HandoverCreate, HandoverRead
from app.schemas.incident import IncidentRead
from app.services.handover_service import HandoverService

router = APIRouter(tags=["handovers"])


@router.get(
    "/incidents/{incident_id}/handover-requests",
    summary="Pedidos de passagem de um incidente (mais recentes primeiro)",
)
def list_requests(
    incident_id: uuid.UUID, session: SessionDep, _: CurrentUser
) -> list[HandoverRead]:
    requests = HandoverService(session).list_for_incident(incident_id)
    return [HandoverRead.model_validate(item) for item in requests]


@router.post(
    "/incidents/{incident_id}/handover-requests",
    status_code=status.HTTP_201_CREATED,
    summary="Pede para assumir um incidente que está com outro analista",
)
def request_handover(
    incident_id: uuid.UUID, payload: HandoverCreate, session: SessionDep, user: CurrentUser
) -> HandoverRead:
    handover = HandoverService(session).request(incident_id, user, payload)
    return HandoverRead.model_validate(handover)


@router.post("/handover-requests/{handover_id}/accept", summary="Responsável aceita o pedido")
def accept(handover_id: uuid.UUID, session: SessionDep, user: CurrentUser) -> HandoverRead:
    return HandoverRead.model_validate(HandoverService(session).accept(handover_id, user))


@router.post("/handover-requests/{handover_id}/decline", summary="Responsável recusa o pedido")
def decline(handover_id: uuid.UUID, session: SessionDep, user: CurrentUser) -> HandoverRead:
    return HandoverRead.model_validate(HandoverService(session).decline(handover_id, user))


@router.post("/handover-requests/{handover_id}/cancel", summary="Quem pediu cancela o pedido")
def cancel(handover_id: uuid.UUID, session: SessionDep, user: CurrentUser) -> HandoverRead:
    return HandoverRead.model_validate(HandoverService(session).cancel(handover_id, user))


@router.post(
    "/incidents/{incident_id}/delegate",
    summary="Responsável passa o incidente diretamente para outro analista",
)
def delegate(
    incident_id: uuid.UUID, payload: DelegateRequest, session: SessionDep, user: CurrentUser
) -> IncidentRead:
    incident = HandoverService(session).delegate(incident_id, user, payload)
    return IncidentRead.model_validate(incident)
