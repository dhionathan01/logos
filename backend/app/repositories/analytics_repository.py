"""Agregações dos indicadores (ADR-0013). Todo cálculo acontece no PostgreSQL."""

import uuid
from datetime import date
from typing import Any, Literal

from sqlalchemy import ColumnElement, Row, case, func, select
from sqlalchemy.orm import InstrumentedAttribute, Session

from app.domain.incident import Category, Severity, Status
from app.domain.sla import SLA_TARGETS
from app.models import Incident, User
from app.schemas.analytics import AnalyticsFilters


def _seconds_between(later: Any, earlier: Any) -> ColumnElement[Any]:
    return func.extract("epoch", later - earlier)


def _target_seconds(kind: Literal["response", "resolution"]) -> ColumnElement[int]:
    return case(
        {
            severity.value: int(getattr(SLA_TARGETS[severity], kind).total_seconds())
            for severity in Severity
        },
        value=Incident.severity,
    )


_response_seconds = _seconds_between(Incident.first_claimed_at, Incident.reported_at)
_resolution_seconds = _seconds_between(Incident.closed_at, Incident.reported_at)


def _metric_columns() -> list[ColumnElement[Any]]:
    """Métricas comuns a todos os recortes (geral, categoria, criticidade, analista)."""
    return [
        func.count().label("total"),
        func.count().filter(Incident.status != Status.CLOSED).label("active"),
        func.count().filter(Incident.status == Status.CLOSED).label("closed"),
        func.count().filter(Incident.status == Status.INCONCLUSIVE).label("inconclusive"),
        (func.avg(_response_seconds) / 60).label("avg_response_minutes"),
        (func.avg(_resolution_seconds) / 60).label("avg_resolution_minutes"),
        func.avg(case((_response_seconds <= _target_seconds("response"), 1.0), else_=0.0))
        .filter(Incident.first_claimed_at.is_not(None))
        .label("response_sla_rate"),
        func.avg(case((_resolution_seconds <= _target_seconds("resolution"), 1.0), else_=0.0))
        .filter(Incident.closed_at.is_not(None))
        .label("resolution_sla_rate"),
        func.count()
        .filter(
            Incident.status != Status.CLOSED,
            _seconds_between(func.now(), Incident.reported_at) > _target_seconds("resolution"),
        )
        .label("breaching_now"),
    ]


class AnalyticsRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def overview(self, filters: AnalyticsFilters) -> Row[Any]:
        query = select(*_metric_columns()).where(*_period(filters))
        return self._session.execute(query).one()

    def grouped_by(
        self, column: InstrumentedAttribute[Any], filters: AnalyticsFilters
    ) -> list[Row[Any]]:
        query = (
            select(column.label("key"), *_metric_columns())
            .where(*_period(filters))
            .group_by(column)
        )
        return list(self._session.execute(query))

    def by_analyst(self, filters: AnalyticsFilters) -> list[Row[Any]]:
        query = (
            select(User.id, User.display_name, *_metric_columns())
            .join(User, Incident.assignee_id == User.id)
            .where(*_period(filters))
            .group_by(User.id, User.display_name)
            .order_by(func.count().desc(), User.display_name)
        )
        return list(self._session.execute(query))

    def analyst_categories(self, filters: AnalyticsFilters) -> dict[uuid.UUID, dict[Category, int]]:
        query = (
            select(Incident.assignee_id, Incident.category, func.count())
            .where(Incident.assignee_id.is_not(None), *_period(filters))
            .group_by(Incident.assignee_id, Incident.category)
        )
        matrix: dict[uuid.UUID, dict[Category, int]] = {}
        for assignee_id, category, count in self._session.execute(query).tuples():
            if assignee_id is not None:
                matrix.setdefault(assignee_id, {})[category] = count
        return matrix

    def daily_counts(
        self, column: InstrumentedAttribute[Any], filters: AnalyticsFilters
    ) -> dict[date, int]:
        """Contagem por dia no fuso do usuário (um incidente das 23h não "vira" o dia em UTC)."""
        day = func.date(func.timezone(filters.tz, column))
        query = (
            select(day, func.count()).where(column.is_not(None), *_period(filters)).group_by(day)
        )
        return {row_day: count for row_day, count in self._session.execute(query).tuples()}

    def first_reported_at_day(self, filters: AnalyticsFilters) -> date | None:
        query = select(func.min(func.date(func.timezone(filters.tz, Incident.reported_at))))
        first_day = self._session.scalar(query.where(*_period(filters)))
        return first_day if isinstance(first_day, date) else None


def _period(filters: AnalyticsFilters) -> list[ColumnElement[bool]]:
    conditions: list[ColumnElement[bool]] = []
    if filters.reported_from:
        conditions.append(Incident.reported_at >= filters.reported_from)
    if filters.reported_to:
        conditions.append(Incident.reported_at <= filters.reported_to)
    return conditions
