"""Cria analistas de demonstração e uma carga realista de incidentes.

Idempotente: não duplica usuários e só gera incidentes se a tabela estiver vazia.
Uso: python -m app.scripts.seed
"""

import logging
import random
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select

from app.core.db import SessionFactory
from app.core.security import hash_password
from app.domain.incident import Category, Severity, Status, default_severity_for
from app.models import Incident, User
from app.repositories.user_repository import UserRepository

logger = logging.getLogger("seed")

DEMO_PASSWORD = "logos2026"  # noqa: S105  senha pública de demonstração, exibida no login
DEMO_ANALYSTS = [("ana", "Ana Souza"), ("bruno", "Bruno Lima")]
INCIDENT_COUNT = 100

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


def seed_users() -> list[User]:
    with SessionFactory.begin() as session:
        users = UserRepository(session)
        analysts = []
        for username, display_name in DEMO_ANALYSTS:
            user = users.find_by_username(username)
            if user is None:
                user = users.add(
                    User(
                        username=username,
                        display_name=display_name,
                        password_hash=hash_password(DEMO_PASSWORD),
                    )
                )
            analysts.append(user)
        return analysts


def seed_incidents(analysts: list[User], count: int = INCIDENT_COUNT) -> int:
    rng = random.Random(42)  # noqa: S311  dados fictícios, não é uso criptográfico
    now = datetime.now(UTC)
    with SessionFactory.begin() as session:
        if session.scalar(select(func.count(Incident.id))):
            return 0
        for _ in range(count):
            category = rng.choice(list(Category))
            status = rng.choices(
                [Status.OPEN, Status.INVESTIGATING, Status.INCONCLUSIVE, Status.CLOSED],
                weights=[55, 25, 8, 12],
            )[0]
            session.add(
                Incident(
                    title=rng.choice(TITLES[category]),
                    description="Relato recebido da central de rastreamento.",
                    category=category,
                    severity=_vary_severity(rng, category),
                    status=status,
                    vehicle_id=f"CAM-{rng.randint(1, 5000):04d}",
                    location=rng.choice(LOCATIONS),
                    assignee_id=None if status == Status.OPEN else rng.choice(analysts).id,
                    reported_at=now - timedelta(minutes=_minutes_ago(rng, status)),
                )
            )
    return count


def _minutes_ago(rng: random.Random, status: Status) -> int:
    """Abertos são recentes (a central reage rápido); concluídos podem ser de horas atrás."""
    if status == Status.OPEN:
        return int(rng.triangular(1, 90, 8))
    return rng.randint(20, 480)


def _vary_severity(rng: random.Random, category: Category) -> Severity:
    """Na maioria dos casos usa a criticidade padrão; às vezes o analista a ajustou."""
    default = default_severity_for(category)
    if category == Category.ACCIDENT_WITH_VICTIMS or rng.random() > 0.25:
        return default
    return rng.choice(list(Severity))


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    analysts = seed_users()
    created = seed_incidents(analysts)
    logger.info("Seed concluído: %d analistas, %d incidentes novos", len(analysts), created)


if __name__ == "__main__":
    main()
