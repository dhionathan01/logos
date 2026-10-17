from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, SessionDep
from app.schemas.analytics import AnalyticsFilters, AnalyticsReport
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get(
    "",
    summary="Indicadores de volume, resolução e SLA por categoria, criticidade e analista",
)
def report(
    session: SessionDep, _: CurrentUser, filters: Annotated[AnalyticsFilters, Query()]
) -> AnalyticsReport:
    return AnalyticsService(session).report(filters)
