#!/bin/sh
# Aplica migrações (idempotente) e, se habilitado, o seed de demonstração antes de subir a API.
# No deploy, isso já roda num container avulso enquanto a versão antiga ainda atende;
# LOGOS_SKIP_PREPARE=true pula esta etapa e encurta a troca de versão.
set -e

if [ "${LOGOS_SKIP_PREPARE:-false}" != "true" ]; then
  alembic upgrade head

  if [ "${LOGOS_SEED_DEMO_DATA:-false}" = "true" ]; then
    python -m app.scripts.seed
  fi
fi

exec "$@"
