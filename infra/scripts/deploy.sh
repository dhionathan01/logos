#!/usr/bin/env bash
# Executado na VPS pelo pipeline: troca para a nova versão e volta à anterior se ela não ficar saudável.
#   bash deploy.sh <image_tag>
set -euo pipefail

NEW_TAG="${1:?informe a tag da imagem}"
APP_DIR=/opt/logos
HEALTH_URL="http://127.0.0.1:8080/api/health/ready"
HEALTH_TIMEOUT_SECONDS=90

cd "$APP_DIR"
compose() { docker compose --env-file .env -f docker-compose.prod.yml "$@"; }

PREVIOUS_TAG="$(grep -E '^IMAGE_TAG=' .env | cut -d= -f2)"
set_tag() { sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$1/" .env; }

wait_until_healthy() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
  until curl -fsS --max-time 3 "$HEALTH_URL" >/dev/null; do
    if ((SECONDS >= deadline)); then return 1; fi
    sleep 3
  done
}

echo "==> Deploy ${PREVIOUS_TAG} → ${NEW_TAG}"
set_tag "$NEW_TAG"
compose pull --quiet
compose up -d --remove-orphans

if wait_until_healthy; then
  echo "==> Versão ${NEW_TAG} saudável"
  docker image prune -f --filter "until=168h" >/dev/null
  exit 0
fi

echo "!!  ${NEW_TAG} não ficou saudável em ${HEALTH_TIMEOUT_SECONDS}s; voltando para ${PREVIOUS_TAG}" >&2
compose logs --tail=80 api >&2 || true
set_tag "$PREVIOUS_TAG"
compose up -d --remove-orphans
wait_until_healthy && echo "==> Rollback para ${PREVIOUS_TAG} concluído" >&2
exit 1
