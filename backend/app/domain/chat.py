"""Regras puras do chat da central e da passagem de incidentes (ADR-0015)."""

from enum import StrEnum

from app.domain.incident import Status

MAX_MESSAGE_LENGTH = 1000


class MessageKind(StrEnum):
    USER = "user"
    SYSTEM = "system"
    HANDOVER = "handover"


class Notice(StrEnum):
    """Tipo do aviso automático, para o cliente escolher ícone e destaque."""

    NEW_HIGH_SEVERITY = "new_high_severity"
    CLAIMED = "claimed"
    RESUMED = "resumed"
    RELEASED = "released"
    CLOSED = "closed"
    MARKED_INCONCLUSIVE = "marked_inconclusive"
    CLAIM_CONFLICT = "claim_conflict"
    HANDOVER_REQUESTED = "handover_requested"
    HANDOVER_ACCEPTED = "handover_accepted"
    HANDOVER_DECLINED = "handover_declined"
    HANDOVER_CANCELLED = "handover_cancelled"
    DELEGATED = "delegated"


class HandoverStatus(StrEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    CANCELLED = "cancelled"


# Só faz sentido pedir ou delegar enquanto alguém é responsável pelo incidente.
TRANSFERABLE_STATUSES = frozenset({Status.INVESTIGATING, Status.INCONCLUSIVE})


def notice_for_transition(previous: Status, target: Status) -> Notice:
    if target == Status.INVESTIGATING:
        return Notice.RESUMED if previous == Status.INCONCLUSIVE else Notice.CLAIMED
    if target == Status.OPEN:
        return Notice.RELEASED
    if target == Status.CLOSED:
        return Notice.CLOSED
    return Notice.MARKED_INCONCLUSIVE


def can_be_transferred(status: Status) -> bool:
    return status in TRANSFERABLE_STATUSES


def ends_assignment(target: Status) -> bool:
    """Devolver ou fechar encerra a responsabilidade: pedidos pendentes perdem o sentido."""
    return target in (Status.OPEN, Status.CLOSED)
