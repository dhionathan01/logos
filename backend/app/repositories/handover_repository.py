import uuid
from typing import Any, cast

from sqlalchemy import CursorResult, func, select, update
from sqlalchemy.orm import Session

from app.domain.chat import HandoverStatus
from app.models import HandoverRequest


class HandoverRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get(self, handover_id: uuid.UUID) -> HandoverRequest | None:
        return self._session.get(HandoverRequest, handover_id, populate_existing=True)

    def for_incident(self, incident_id: uuid.UUID) -> list[HandoverRequest]:
        query = (
            select(HandoverRequest)
            .where(HandoverRequest.incident_id == incident_id)
            .order_by(HandoverRequest.created_at.desc())
        )
        return list(self._session.scalars(query).unique())

    def add(self, handover: HandoverRequest) -> HandoverRequest:
        self._session.add(handover)
        self._session.flush()
        return handover

    def resolve(self, handover_id: uuid.UUID, outcome: HandoverStatus) -> bool:
        """Responde o pedido só se ainda estiver pendente: dois cliques não respondem duas vezes."""
        result = self._session.execute(
            update(HandoverRequest)
            .where(
                HandoverRequest.id == handover_id,
                HandoverRequest.status == HandoverStatus.PENDING,
            )
            .values(status=outcome, resolved_at=func.now())
            # Sincroniza o objeto em memória: a mensagem publicada em seguida leva o status novo.
            .execution_options(synchronize_session="fetch")
        )
        return cast(CursorResult[Any], result).rowcount == 1

    def cancel_pending_for(self, incident_id: uuid.UUID) -> list[uuid.UUID]:
        result = self._session.execute(
            update(HandoverRequest)
            .where(
                HandoverRequest.incident_id == incident_id,
                HandoverRequest.status == HandoverStatus.PENDING,
            )
            .values(status=HandoverStatus.CANCELLED, resolved_at=func.now())
            .returning(HandoverRequest.id)
            .execution_options(synchronize_session="fetch")
        )
        return list(result.scalars())
