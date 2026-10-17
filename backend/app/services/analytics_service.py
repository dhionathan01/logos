from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import Row
from sqlalchemy.orm import Session

from app.core.db import retry_transient_db_errors
from app.domain.incident import Category, Severity
from app.domain.sla import SLA_TARGETS
from app.models import Incident
from app.repositories.analytics_repository import AnalyticsRepository
from app.schemas.analytics import (
    AnalystStats,
    AnalyticsFilters,
    AnalyticsReport,
    CategoryStats,
    DailyPoint,
    Overview,
    SeverityStats,
)
from app.schemas.incident import AssigneeRead

# Limite da série diária: "todo o período" com anos de dados não deve gerar milhares de pontos.
MAX_DAILY_POINTS = 120


class AnalyticsService:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._analytics = AnalyticsRepository(session)

    @retry_transient_db_errors
    def report(self, filters: AnalyticsFilters) -> AnalyticsReport:
        with self._session.begin():
            overview = self._analytics.overview(filters)
            categories = {
                row.key: row for row in self._analytics.grouped_by(Incident.category, filters)
            }
            severities = {
                row.key: row for row in self._analytics.grouped_by(Incident.severity, filters)
            }
            analysts = self._analytics.by_analyst(filters)
            matrix = self._analytics.analyst_categories(filters)
            daily = self._daily_series(filters)

        return AnalyticsReport(
            generated_at=datetime.now(UTC),
            overview=Overview(
                total=overview.total,
                active=overview.active,
                closed=overview.closed,
                inconclusive=overview.inconclusive,
                resolution_rate=_ratio(overview.closed, overview.total),
                avg_response_minutes=_number(overview.avg_response_minutes),
                avg_resolution_minutes=_number(overview.avg_resolution_minutes),
                response_sla_rate=_number(overview.response_sla_rate),
                resolution_sla_rate=_number(overview.resolution_sla_rate),
                breaching_now=overview.breaching_now,
            ),
            # Todas as categorias e criticidades aparecem, mesmo sem ocorrências no período.
            by_category=sorted(
                (_category_stats(category, categories.get(category)) for category in Category),
                key=lambda stats: stats.total,
                reverse=True,
            ),
            by_severity=[
                _severity_stats(severity, severities.get(severity)) for severity in Severity
            ],
            by_analyst=[
                AnalystStats(
                    analyst=AssigneeRead(id=row.id, display_name=row.display_name),
                    assigned=row.total,
                    closed=row.closed,
                    resolution_rate=_ratio(row.closed, row.total),
                    avg_resolution_minutes=_number(row.avg_resolution_minutes),
                    resolution_sla_rate=_number(row.resolution_sla_rate),
                    by_category={
                        category: matrix.get(row.id, {}).get(category, 0) for category in Category
                    },
                )
                for row in analysts
            ],
            daily=daily,
        )

    def _daily_series(self, filters: AnalyticsFilters) -> list[DailyPoint]:
        zone = ZoneInfo(filters.tz)
        today = datetime.now(zone).date()
        end = (
            min(filters.reported_to.astimezone(zone).date(), today)
            if filters.reported_to
            else today
        )
        start = (
            filters.reported_from.astimezone(zone).date()
            if filters.reported_from
            else self._analytics.first_reported_at_day(filters)
        )
        if start is None or start > end:
            return []
        start = max(start, end - timedelta(days=MAX_DAILY_POINTS - 1))

        reported = self._analytics.daily_counts(Incident.reported_at, filters)
        closed = self._analytics.daily_counts(Incident.closed_at, filters)
        return [
            DailyPoint(day=day, reported=reported.get(day, 0), closed=closed.get(day, 0))
            for day in _days_between(start, end)
        ]


def _days_between(start: date, end: date) -> list[date]:
    return [start + timedelta(days=offset) for offset in range((end - start).days + 1)]


def _ratio(part: int, whole: int) -> float | None:
    return part / whole if whole else None


def _number(value: Decimal | float | None) -> float | None:
    return round(float(value), 4) if value is not None else None


def _category_stats(category: Category, row: Row[Any] | None) -> CategoryStats:
    if row is None:
        return CategoryStats(
            category=category,
            total=0,
            closed=0,
            resolution_rate=None,
            avg_resolution_minutes=None,
            resolution_sla_rate=None,
        )
    return CategoryStats(
        category=category,
        total=row.total,
        closed=row.closed,
        resolution_rate=_ratio(row.closed, row.total),
        avg_resolution_minutes=_number(row.avg_resolution_minutes),
        resolution_sla_rate=_number(row.resolution_sla_rate),
    )


def _severity_stats(severity: Severity, row: Row[Any] | None) -> SeverityStats:
    target = SLA_TARGETS[severity]
    return SeverityStats(
        severity=severity,
        total=row.total if row else 0,
        closed=row.closed if row else 0,
        response_target_minutes=int(target.response.total_seconds() // 60),
        resolution_target_minutes=int(target.resolution.total_seconds() // 60),
        avg_response_minutes=_number(row.avg_response_minutes) if row else None,
        avg_resolution_minutes=_number(row.avg_resolution_minutes) if row else None,
        response_sla_rate=_number(row.response_sla_rate) if row else None,
        resolution_sla_rate=_number(row.resolution_sla_rate) if row else None,
        breaching_now=row.breaching_now if row else 0,
    )
