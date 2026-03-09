#!/usr/bin/env bash
# ============================================================
# TJPE Archive Assist — Backup do Banco de Dados
# Uso: ./backup.sh
# Recomendado: agendar via cron diariamente
#   0 2 * * * /opt/tjpe/deploy/backup.sh >> /var/log/tjpe-backup.log 2>&1
# ============================================================
set -euo pipefail

ENV_FILE=".env"
BACKUP_DIR="/opt/tjpe/backups"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="tjpe_archive_${DATE}.sql.gz"

# Carrega variáveis do .env
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Iniciando backup: $FILENAME"

docker exec tjpe_db pg_dump \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --no-password \
  | gzip > "$BACKUP_DIR/$FILENAME"

echo "[$(date)] Backup salvo em: $BACKUP_DIR/$FILENAME"

# Remove backups com mais de 30 dias
find "$BACKUP_DIR" -name "tjpe_archive_*.sql.gz" -mtime +30 -delete
echo "[$(date)] Backups antigos removidos."
