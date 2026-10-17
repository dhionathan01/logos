"""Metas de atendimento por criticidade (ADR-0013), medidas a partir da ocorrência."""

from dataclasses import dataclass
from datetime import datetime, timedelta

from app.domain.incident import Severity


@dataclass(frozen=True, slots=True)
class SlaTarget:
    response: timedelta  # até alguém assumir
    resolution: timedelta  # até fechar


SLA_TARGETS: dict[Severity, SlaTarget] = {
    Severity.HIGH: SlaTarget(response=timedelta(minutes=15), resolution=timedelta(hours=2)),
    Severity.MEDIUM: SlaTarget(response=timedelta(minutes=30), resolution=timedelta(hours=8)),
    Severity.LOW: SlaTarget(response=timedelta(hours=2), resolution=timedelta(hours=24)),
}


def met_resolution_sla(severity: Severity, reported_at: datetime, closed_at: datetime) -> bool:
    return closed_at - reported_at <= SLA_TARGETS[severity].resolution


def is_breaching_resolution(severity: Severity, reported_at: datetime, now: datetime) -> bool:
    """Ainda aberto e já além do prazo de resolução: precisa de atenção do supervisor."""
    return now - reported_at > SLA_TARGETS[severity].resolution
