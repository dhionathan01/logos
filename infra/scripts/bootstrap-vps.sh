#!/usr/bin/env bash
# Prepara a VPS para receber deploys do Logos. Executar UMA vez, como usuário com sudo:
#   bash bootstrap-vps.sh <dominio> <usuario/repositorio> "<chave pública ssh do deploy>"
# Idempotente: rodar de novo não recria segredos nem duplica configurações.
set -euo pipefail

DOMAIN="${1:?informe o domínio (ex.: logos-autou.duckdns.org)}"
REPOSITORY="${2:?informe o repositório (ex.: usuario/logos)}"
DEPLOY_PUBLIC_KEY="${3:?informe a chave pública SSH usada pelo GitHub Actions}"
APP_DIR=/opt/logos
DEPLOY_USER=deploy

echo "==> Swap de 2 GB (a VM tem 1 GB de RAM e nenhuma swap)"
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-logos-swap.conf >/dev/null
  sudo sysctl -p /etc/sysctl.d/99-logos-swap.conf
fi

echo "==> Docker Engine + Compose (pacotes do Ubuntu)"
if ! command -v docker >/dev/null; then
  sudo apt-get update -y
  sudo apt-get install -y docker.io docker-compose-v2
  sudo systemctl enable --now docker
fi

echo "==> Usuário '${DEPLOY_USER}' para o pipeline (sem sudo, só docker)"
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  sudo useradd --create-home --shell /bin/bash "$DEPLOY_USER"
fi
sudo usermod -aG docker "$DEPLOY_USER"
sudo install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/${DEPLOY_USER}/.ssh"
AUTHORIZED_KEYS="/home/${DEPLOY_USER}/.ssh/authorized_keys"
sudo touch "$AUTHORIZED_KEYS"
if ! sudo grep -qF "$DEPLOY_PUBLIC_KEY" "$AUTHORIZED_KEYS"; then
  echo "$DEPLOY_PUBLIC_KEY" | sudo tee -a "$AUTHORIZED_KEYS" >/dev/null
fi
sudo chown "$DEPLOY_USER:$DEPLOY_USER" "$AUTHORIZED_KEYS"
sudo chmod 600 "$AUTHORIZED_KEYS"

echo "==> Diretório da aplicação e segredos"
sudo install -d -m 750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_DIR"
if ! sudo test -f "${APP_DIR}/.env"; then
  sudo -u "$DEPLOY_USER" tee "${APP_DIR}/.env" >/dev/null <<EOF
GITHUB_REPOSITORY=${REPOSITORY,,}
IMAGE_TAG=latest
WEB_PORT=8080
POSTGRES_PASSWORD=$(openssl rand -hex 24)
LOGOS_JWT_SECRET=$(openssl rand -hex 32)
LOGOS_INGESTION_API_KEY=$(openssl rand -hex 24)
EOF
  sudo chmod 600 "${APP_DIR}/.env"
fi

echo "==> Server block do nginx do host (sem tocar nos sites existentes)"
SITE=/etc/nginx/sites-available/logos
sudo cp "$(dirname "$0")/../nginx/logos.conf" "$SITE"
sudo sed -i "s/LOGOS_DOMAIN/${DOMAIN}/" "$SITE"
sudo ln -sf "$SITE" /etc/nginx/sites-enabled/logos
sudo nginx -t
sudo systemctl reload nginx

cat <<EOF

Pronto. Próximos passos:
  1. Faça o primeiro deploy pelo GitHub Actions (push na main ou "Run workflow").
  2. Ative HTTPS (porta 443 liberada na Security List da OCI e no iptables):
       sudo apt-get install -y certbot python3-certbot-nginx
       sudo certbot --nginx -d ${DOMAIN} --redirect
EOF
