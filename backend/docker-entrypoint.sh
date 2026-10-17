#!/bin/sh
# Aplica migrações (idempotente) e, se habilitado, o seed de demonstração antes de subir a API.
set -e

alembic upgrade head

if [ "${LOGOS_SEED_DEMO_DATA:-false}" = "true" ]; then
  python -m app.scripts.seed
fi

exec "$@"
