"""Regras puras do incidente: sem FastAPI, sem SQLAlchemy."""

from enum import StrEnum


class Category(StrEnum):
    VEHICLE_ACCIDENT = "vehicle_accident"
    ACCIDENT_WITH_VICTIMS = "accident_with_victims"
    ADVERSE_WEATHER = "adverse_weather"
    MECHANICAL_FAILURE = "mechanical_failure"
    ROAD_BLOCK = "road_block"


class Severity(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class Status(StrEnum):
    OPEN = "open"
    INVESTIGATING = "investigating"
    INCONCLUSIVE = "inconclusive"
    CLOSED = "closed"


class EventType(StrEnum):
    CREATED = "created"
    STATUS_CHANGED = "status_changed"
    DETAILS_UPDATED = "details_updated"


DEFAULT_SEVERITY_BY_CATEGORY: dict[Category, Severity] = {
    Category.ACCIDENT_WITH_VICTIMS: Severity.HIGH,
    Category.VEHICLE_ACCIDENT: Severity.HIGH,
    Category.ROAD_BLOCK: Severity.MEDIUM,
    Category.ADVERSE_WEATHER: Severity.MEDIUM,
    Category.MECHANICAL_FAILURE: Severity.LOW,
}

# Ciclo de vida: só quem assume a investigação pode concluí-la.
#   open ──► investigating ──► closed
#              │   ▲  │
#              ▼   │  └──► inconclusive ──► closed
#            open  └─────────────┘
ALLOWED_TRANSITIONS: dict[Status, frozenset[Status]] = {
    Status.OPEN: frozenset({Status.INVESTIGATING}),
    Status.INVESTIGATING: frozenset({Status.OPEN, Status.CLOSED, Status.INCONCLUSIVE}),
    Status.INCONCLUSIVE: frozenset({Status.INVESTIGATING, Status.CLOSED}),
    Status.CLOSED: frozenset(),
}

# Ordem de prioridade usada na listagem: o que exige ação vem primeiro.
SEVERITY_RANK: dict[Severity, int] = {Severity.HIGH: 0, Severity.MEDIUM: 1, Severity.LOW: 2}
STATUS_RANK: dict[Status, int] = {
    Status.OPEN: 0,
    Status.INVESTIGATING: 1,
    Status.INCONCLUSIVE: 2,
    Status.CLOSED: 3,
}


def default_severity_for(category: Category) -> Severity:
    return DEFAULT_SEVERITY_BY_CATEGORY[category]


def can_transition(current: Status, target: Status) -> bool:
    return target in ALLOWED_TRANSITIONS[current]


def requires_assignee(target: Status) -> bool:
    """Ao entrar em investigação, o incidente passa a ter um responsável."""
    return target == Status.INVESTIGATING


def is_restricted_to_assignee(current: Status) -> bool:
    """Enquanto em investigação, só o responsável pode mudar o status."""
    return current == Status.INVESTIGATING
