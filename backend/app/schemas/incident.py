import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any, Literal, Self

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

from app.domain.incident import Category, EventType, Severity, Status

# Tolerância para relógios de caminhão levemente adiantados.
MAX_CLOCK_SKEW = timedelta(minutes=5)

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=120)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]
Location = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=200)]
VehicleId = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True, to_upper=True, pattern=r"^[A-Za-z0-9-]{3,20}$", max_length=20
    ),
]
ResolutionNote = Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class IncidentCreate(StrictModel):
    title: Title
    description: Description = ""
    category: Category
    severity: Severity | None = Field(
        default=None, description="Se omitida, é derivada da categoria."
    )
    vehicle_id: VehicleId = Field(examples=["CAM-0421"])
    location: Location = Field(examples=["BR-116, km 212, Registro/SP"])
    reported_at: AwareDatetime | None = Field(
        default=None, description="Quando o incidente ocorreu. Padrão: agora."
    )

    @field_validator("reported_at")
    @classmethod
    def reject_future_dates(cls, value: datetime | None) -> datetime | None:
        if value is not None and value > datetime.now(UTC) + MAX_CLOCK_SKEW:
            raise ValueError("não pode estar no futuro")
        return value


class IncidentUpdate(StrictModel):
    version: int = Field(ge=1, description="Versão que o cliente leu por último.")
    title: Title | None = None
    description: Description | None = None
    category: Category | None = None
    severity: Severity | None = None
    location: Location | None = None

    @model_validator(mode="after")
    def require_some_change(self) -> Self:
        if not self.changes():
            raise ValueError("informe ao menos um campo para alterar")
        return self

    def changes(self) -> dict[str, object]:
        return self.model_dump(exclude={"version"}, exclude_none=True)


class StatusChange(StrictModel):
    status: Status
    version: int = Field(ge=1)
    resolution_note: ResolutionNote | None = None


class IncidentFilters(StrictModel):
    severity: list[Severity] = Field(default_factory=list)
    category: list[Category] = Field(default_factory=list)
    status: list[Status] = Field(default_factory=list)
    search: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] = ""
    reported_from: AwareDatetime | None = Field(
        default=None, description="Ocorridos a partir deste instante (ISO 8601 com fuso)."
    )
    reported_to: AwareDatetime | None = Field(
        default=None, description="Ocorridos até este instante (ISO 8601 com fuso)."
    )
    assignee: list[uuid.UUID] = Field(
        default_factory=list,
        description="Responsáveis. Fechados mantêm quem concluiu, então isto lista o histórico.",
    )
    sort: Literal["priority", "recent"] = Field(
        default="priority",
        description="priority: criticidade e idade (fila). recent: últimos concluídos/alterados.",
    )
    limit: int = Field(default=200, ge=1, le=500)
    offset: int = Field(default=0, ge=0)

    @model_validator(mode="after")
    def require_ordered_period(self) -> Self:
        if self.reported_from and self.reported_to and self.reported_from > self.reported_to:
            raise ValueError("reported_from deve ser anterior a reported_to")
        return self


class AssigneeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    display_name: str


class IncidentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str
    category: Category
    severity: Severity
    status: Status
    vehicle_id: str
    location: str
    resolution_note: str | None
    assignee: AssigneeRead | None
    version: int
    reported_at: datetime
    first_claimed_at: datetime | None
    closed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class IncidentEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    event_type: EventType
    from_status: Status | None
    to_status: Status | None
    changes: dict[str, Any] | None
    actor: AssigneeRead | None = Field(description="Ausente quando veio de um sistema da frota.")
    occurred_at: datetime


class IncidentPage(BaseModel):
    items: list[IncidentRead]
    total: int
    limit: int
    offset: int


class IncidentSummary(BaseModel):
    active_by_severity: dict[Severity, int]
    by_status: dict[Status, int]
