"""Cria analistas de demonstração e uma carga realista de incidentes.

Gera a fila atual (o que está acontecendo agora) e 30 dias de histórico resolvido, com
marcos de SLA e trilha de eventos coerentes, para que os indicadores tenham o que mostrar.

Idempotente: não duplica usuários e só gera incidentes se a tabela estiver vazia.
Uso: python -m app.scripts.seed
"""

import logging
import random
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.db import SessionFactory
from app.core.security import hash_password
from app.domain.incident import Category, EventType, Severity, Status, default_severity_for
from app.models import Incident, IncidentEvent, User
from app.repositories.user_repository import UserRepository

logger = logging.getLogger("seed")

DEMO_PASSWORD = "logos2026"  # noqa: S105  senha pública de demonstração, exibida no login
HISTORY_DAYS = 30
ARRIVALS_PER_DAY = 160
INCIDENT_COUNT = ARRIVALS_PER_DAY * HISTORY_DAYS
BACKLOG_WINDOW = timedelta(hours=4)


@dataclass(frozen=True)
class AnalystProfile:
    username: str
    display_name: str
    affinity: dict[Category, int]  # peso de cada categoria na escolha de quem assume
    speed: float  # multiplicador dos tempos de resposta e resolução (menor = mais rápido)


ANALYSTS = [
    AnalystProfile(
        "ana",
        "Ana Souza",
        {
            Category.ACCIDENT_WITH_VICTIMS: 6,
            Category.VEHICLE_ACCIDENT: 5,
            Category.ROAD_BLOCK: 2,
            Category.ADVERSE_WEATHER: 1,
            Category.MECHANICAL_FAILURE: 2,
        },
        speed=0.7,
    ),
    AnalystProfile(
        "bruno",
        "Bruno Lima",
        {
            Category.ACCIDENT_WITH_VICTIMS: 2,
            Category.VEHICLE_ACCIDENT: 2,
            Category.ROAD_BLOCK: 4,
            Category.ADVERSE_WEATHER: 2,
            Category.MECHANICAL_FAILURE: 6,
        },
        speed=1.0,
    ),
    AnalystProfile(
        "carla",
        "Carla Mendes",
        {
            Category.ACCIDENT_WITH_VICTIMS: 1,
            Category.VEHICLE_ACCIDENT: 2,
            Category.ROAD_BLOCK: 4,
            Category.ADVERSE_WEATHER: 6,
            Category.MECHANICAL_FAILURE: 3,
        },
        speed=1.4,
    ),
]

CATEGORY_FREQUENCY = {
    Category.MECHANICAL_FAILURE: 35,
    Category.ROAD_BLOCK: 20,
    Category.VEHICLE_ACCIDENT: 20,
    Category.ADVERSE_WEATHER: 15,
    Category.ACCIDENT_WITH_VICTIMS: 10,
}

# Tempos típicos em minutos (antes do perfil do analista e da variação aleatória).
TYPICAL_RESPONSE = {Severity.HIGH: 9, Severity.MEDIUM: 22, Severity.LOW: 70}
TYPICAL_RESOLUTION = {Severity.HIGH: 85, Severity.MEDIUM: 320, Severity.LOW: 900}

TITLES: dict[Category, list[str]] = {
    Category.VEHICLE_ACCIDENT: [
        "Colisão traseira em baixa velocidade",
        "Caminhão tombado no acostamento",
        "Engavetamento com três veículos",
    ],
    Category.ACCIDENT_WITH_VICTIMS: [
        "Colisão frontal com feridos",
        "Atropelamento próximo ao posto",
        "Motorista ferido após saída de pista",
    ],
    Category.ADVERSE_WEATHER: [
        "Neblina densa, visibilidade abaixo de 50 m",
        "Alagamento parcial da pista",
        "Chuva de granizo no trecho de serra",
    ],
    Category.MECHANICAL_FAILURE: [
        "Pneu furado no eixo traseiro",
        "Superaquecimento do motor",
        "Falha no sistema de freios",
        "Bateria descarregada",
    ],
    Category.ROAD_BLOCK: [
        "Pista interditada por manifestação",
        "Bloqueio por obra não sinalizada",
        "Queda de barreira bloqueando a via",
    ],
}

LOCATIONS = [
    "BR-116, km 212, Registro/SP",
    "BR-101, km 87, Joinville/SC",
    "Rod. Anhanguera, km 103, Campinas/SP",
    "BR-381, km 450, Betim/MG",
    "BR-040, km 12, Petrópolis/RJ",
    "BR-153, km 330, Goiânia/GO",
    "Rod. dos Bandeirantes, km 55, Jundiaí/SP",
    "BR-277, km 120, Ponta Grossa/PR",
    "BR-364, km 8, Cuiabá/MT",
    "BR-232, km 40, Recife/PE",
]


def seed_users() -> dict[str, User]:
    with SessionFactory.begin() as session:
        users = UserRepository(session)
        analysts = {}
        for profile in ANALYSTS:
            user = users.find_by_username(profile.username)
            if user is None:
                user = users.add(
                    User(
                        username=profile.username,
                        display_name=profile.display_name,
                        password_hash=hash_password(DEMO_PASSWORD),
                    )
                )
            analysts[profile.username] = user
        return analysts


def seed_incidents(users: dict[str, User]) -> int:
    rng = random.Random(42)  # noqa: S311  dados fictícios, não é uso criptográfico
    now = datetime.now(UTC)
    with SessionFactory.begin() as session:
        if session.scalar(select(func.count(Incident.id))):
            return 0
        generator = _Generator(session, rng, now, users)
        for _ in range(INCIDENT_COUNT):
            generator.incident()
    return INCIDENT_COUNT


class _Generator:
    def __init__(
        self, session: Session, rng: random.Random, now: datetime, users: dict[str, User]
    ) -> None:
        self._session = session
        self._rng = rng
        self._now = now
        self._users = users

    def incident(self) -> None:
        """Um incidente num processo de chegadas uniformes: o status decorre da idade.

        Ainda não deu tempo de alguém assumir → aberto; já assumido, mas ainda não deu
        tempo de resolver → em investigação; senão → fechado. Assim a fila atual e o
        histórico são o mesmo fenômeno, e a série diária não tem degraus artificiais.
        """
        reported_at = self._now - timedelta(minutes=self._rng.uniform(1, HISTORY_DAYS * 1440))
        category, severity = self._category_and_severity()
        profile = self._pick_analyst(category)
        claimed_at = reported_at + self._duration(TYPICAL_RESPONSE[severity], profile.speed)
        closed_at = claimed_at + self._duration(TYPICAL_RESOLUTION[severity], profile.speed)
        assignee = self._users[profile.username]

        # A premissa do case: a central está sobrecarregada agora, parte do recente espera.
        is_backlog = self._now - reported_at < BACKLOG_WINDOW and self._rng.random() < 0.75
        if is_backlog or claimed_at > self._now:
            self._add(category, severity, reported_at, status=Status.OPEN)
        elif closed_at > self._now:
            stalled = self._rng.random() < 0.08
            self._add(
                category,
                severity,
                reported_at,
                status=Status.INCONCLUSIVE if stalled else Status.INVESTIGATING,
                assignee=assignee,
                claimed_at=claimed_at,
                finished_at=claimed_at + (self._now - claimed_at) / 2 if stalled else None,
            )
        else:
            went_inconclusive = self._rng.random() < 0.14
            self._add(
                category,
                severity,
                reported_at,
                status=Status.CLOSED,
                assignee=assignee,
                claimed_at=claimed_at,
                finished_at=closed_at,
                inconclusive_at=claimed_at + (closed_at - claimed_at) / 2
                if went_inconclusive
                else None,
            )

    def _add(
        self,
        category: Category,
        severity: Severity,
        reported_at: datetime,
        *,
        status: Status,
        assignee: User | None = None,
        claimed_at: datetime | None = None,
        finished_at: datetime | None = None,
        inconclusive_at: datetime | None = None,
    ) -> None:
        incident = Incident(
            id=uuid.uuid4(),
            title=self._rng.choice(TITLES[category]),
            description="Relato recebido da central de rastreamento.",
            category=category,
            severity=severity,
            status=status,
            vehicle_id=f"CAM-{self._rng.randint(1, 5000):04d}",
            location=self._rng.choice(LOCATIONS),
            assignee_id=assignee.id if assignee else None,
            reported_at=reported_at,
            first_claimed_at=claimed_at,
            closed_at=finished_at if status == Status.CLOSED else None,
            resolution_note="Situação normalizada; veículo seguiu viagem."
            if status == Status.CLOSED
            else None,
        )
        self._session.add(incident)
        # 70% dos incidentes chegam pela telemetria da frota (sem autor humano).
        reporter = None if self._rng.random() < 0.7 else assignee
        self._event(incident, EventType.CREATED, reporter, None, Status.OPEN, reported_at)
        if claimed_at and assignee:
            self._event(
                incident,
                EventType.STATUS_CHANGED,
                assignee,
                Status.OPEN,
                Status.INVESTIGATING,
                claimed_at,
            )
        if inconclusive_at and assignee:
            # Investigação inconclusiva, retomada e depois fechada.
            for from_status, to_status, offset in (
                (Status.INVESTIGATING, Status.INCONCLUSIVE, timedelta(0)),
                (Status.INCONCLUSIVE, Status.INVESTIGATING, timedelta(minutes=5)),
            ):
                self._event(
                    incident,
                    EventType.STATUS_CHANGED,
                    assignee,
                    from_status,
                    to_status,
                    inconclusive_at + offset,
                )
        if finished_at and assignee and status in (Status.CLOSED, Status.INCONCLUSIVE):
            self._event(
                incident,
                EventType.STATUS_CHANGED,
                assignee,
                Status.INVESTIGATING,
                status,
                finished_at,
            )

    def _event(
        self,
        incident: Incident,
        event_type: EventType,
        actor: User | None,
        from_status: Status | None,
        to_status: Status,
        occurred_at: datetime,
    ) -> None:
        self._session.add(
            IncidentEvent(
                incident_id=incident.id,
                event_type=event_type,
                actor_id=actor.id if actor else None,
                from_status=from_status,
                to_status=to_status,
                occurred_at=occurred_at,
            )
        )

    def _category_and_severity(self) -> tuple[Category, Severity]:
        category = self._rng.choices(
            list(CATEGORY_FREQUENCY), weights=list(CATEGORY_FREQUENCY.values())
        )[0]
        default = default_severity_for(category)
        if category == Category.ACCIDENT_WITH_VICTIMS or self._rng.random() > 0.25:
            return category, default
        return category, self._rng.choice(list(Severity))

    def _pick_analyst(self, category: Category) -> AnalystProfile:
        return self._rng.choices(ANALYSTS, weights=[p.affinity[category] for p in ANALYSTS])[0]

    def _duration(self, typical_minutes: int, speed: float) -> timedelta:
        return timedelta(minutes=typical_minutes * speed * self._rng.uniform(0.35, 2.0))


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    users = seed_users()
    created = seed_incidents(users)
    logger.info("Seed concluído: %d analistas, %d incidentes novos", len(users), created)


if __name__ == "__main__":
    main()
