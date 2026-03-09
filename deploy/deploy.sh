#!/usr/bin/env bash
# ============================================================
# TJPE Archive Assist — Script de Deploy
# Uso: ./deploy.sh [--pull]
#   --pull  força novo pull da imagem antes de subir
# ============================================================
set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env"
IMAGE="tjpe-archive-assist:latest"

# ── Verificações ──────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "❌  Arquivo .env não encontrado. Copie .env.example e preencha os valores."
  exit 1
fi

if ! docker info &>/dev/null; then
  echo "❌  Docker não está em execução."
  exit 1
fi

# ── Pull opcional da imagem ───────────────────────────────
if [[ "${1:-}" == "--pull" ]]; then
  echo "📥  Baixando imagem $IMAGE..."
  docker pull "$IMAGE"
fi

# ── Subir serviços ────────────────────────────────────────
echo "🚀  Iniciando serviços..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --remove-orphans

# ── Aguardar healthcheck da app ───────────────────────────
echo "⏳  Aguardando aplicação ficar saudável..."
for i in $(seq 1 12); do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' tjpe_app 2>/dev/null || echo "missing")
  if [ "$STATUS" == "healthy" ]; then
    echo "✅  Aplicação saudável."
    break
  fi
  if [ "$i" -eq 12 ]; then
    echo "❌  Timeout: aplicação não ficou saudável em 60s."
    docker compose -f "$COMPOSE_FILE" logs app --tail=50
    exit 1
  fi
  sleep 5
done

echo ""
echo "🎉  Deploy concluído!"
echo "    Containers em execução:"
docker compose -f "$COMPOSE_FILE" ps
