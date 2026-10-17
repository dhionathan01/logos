from datetime import date, datetime
from typing import Self
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator, model_validator

from app.domain.incident import Category, Severity
from app.schemas.incident import AssigneeRead

Rate = float  # fração entre 0 e 1; None quando não há base para calcular


class AnalyticsFilters(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reported_from: AwareDatetime | None = None
    reported_to: AwareDatetime | None = None
    tz: str = Field(
        default="America/Sao_Paulo",
        max_length=64,
        description="Fuso usado para agrupar a série diária.",
    )

    @field_validator("tz")
    @classmethod
    def require_known_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as error:
            raise ValueError("fuso horário desconhecido") from error
        return value

    @model_validator(mode="after")
    def require_ordered_period(self) -> Self:
        if self.reported_from and self.reported_to and self.reported_from > self.reported_to:
            raise ValueError("reported_from deve ser anterior a reported_to")
        return self


class Overview(BaseModel):
    total: int
    active: int
    closed: int
    inconclusive: int
    resolution_rate: Rate | None
    avg_response_minutes: float | None
    avg_resolution_minutes: float | None
    response_sla_rate: Rate | None
    resolution_sla_rate: Rate | None
    breaching_now: int = Field(description="Ativos que já passaram do prazo de resolução.")


class CategoryStats(BaseModel):
    category: Category
    total: int
    closed: int
    resolution_rate: Rate | None
    avg_resolution_minutes: float | None
    resolution_sla_rate: Rate | None


class SeverityStats(BaseModel):
    severity: Severity
    total: int
    closed: int
    response_target_minutes: int
    resolution_target_minutes: int
    avg_response_minutes: float | None
    avg_resolution_minutes: float | None
    response_sla_rate: Rate | None
    resolution_sla_rate: Rate | None
    breaching_now: int


class AnalystStats(BaseModel):
    analyst: AssigneeRead
    assigned: int = Field(description="Incidentes sob responsabilidade do analista.")
    closed: int
    resolution_rate: Rate | None
    avg_resolution_minutes: float | None
    resolution_sla_rate: Rate | None
    by_category: dict[Category, int]


class DailyPoint(BaseModel):
    day: date
    reported: int
    closed: int


class AnalyticsReport(BaseModel):
    generated_at: datetime
    overview: Overview
    by_category: list[CategoryStats]
    by_severity: list[SeverityStats]
    by_analyst: list[AnalystStats]
    daily: list[DailyPoint]
