#!/usr/bin/env bash
# ==============================================================================
# Automated Daily PostgreSQL Database Backup Script for Vani/Sandesh Travels CRM
# Location: /var/www/crm.sandeshtravels.in/deploy/backup_db.sh
# ==============================================================================

set -eo pipefail

# Configuration
APP_DIR="${APP_DIR:-/var/www/crm.sandeshtravels.in}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/sandeshtravels}"
LOG_FILE="${LOG_FILE:-/var/log/sandeshtravels_backup.log}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILENAME="db_backup_${TIMESTAMP}.sql.gz"
BACKUP_FILEPATH="${BACKUP_DIR}/${BACKUP_FILENAME}"

log() {
  local level="$1"
  shift
  local message="$*"
  local log_line="[$(date +"%Y-%m-%d %H:%M:%S")] [${level}] ${message}"
  echo "${log_line}"
  if [ -w "$(dirname "$LOG_FILE")" ] || [ ! -f "$LOG_FILE" ]; then
    echo "${log_line}" >> "$LOG_FILE" 2>/dev/null || true
  fi
}

log "INFO" "=================================================="
log "INFO" "Starting PostgreSQL database backup..."

# 1. Ensure backup directory exists with restricted permissions
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# 2. Extract database connection string
DB_URL=""

if [ -n "$POSTGRES_URL" ]; then
  DB_URL="$POSTGRES_URL"
elif [ -n "$DATABASE_URL" ]; then
  DB_URL="$DATABASE_URL"
elif [ -f "${APP_DIR}/.env.local" ]; then
  DB_URL=$(grep -E '^(POSTGRES_URL|DATABASE_URL)=' "${APP_DIR}/.env.local" | head -n 1 | cut -d '=' -f2- | tr -d '"' | tr -d "'")
elif [ -f "${APP_DIR}/.env" ]; then
  DB_URL=$(grep -E '^(POSTGRES_URL|DATABASE_URL)=' "${APP_DIR}/.env" | head -n 1 | cut -d '=' -f2- | tr -d '"' | tr -d "'")
fi

# Fallback to local default if not specified
if [ -z "$DB_URL" ]; then
  log "WARN" "Database URL not found in environment or .env files. Using default localhost connection."
  DB_URL="postgresql://postgres:postgres@localhost:5432/postgres"
fi

# 3. Check for pg_dump tool
if ! command -v pg_dump >/dev/null 2>&1; then
  log "ERROR" "pg_dump is not installed or not in PATH. Please run: sudo apt-get install -y postgresql-client"
  exit 1
fi

# 4. Perform database dump and gzip compression
START_TIME=$(date +%s)
log "INFO" "Exporting database to ${BACKUP_FILEPATH}..."

# Export database (using --clean --if-exists for safe schema restoration)
if pg_dump --dbname="$DB_URL" --clean --if-exists | gzip > "$BACKUP_FILEPATH"; then
  END_TIME=$(date +%s)
  DURATION=$((END_TIME - START_TIME))
  FILE_SIZE=$(du -h "$BACKUP_FILEPATH" | cut -f1)

  # Check that the backup file is not empty
  if [ -s "$BACKUP_FILEPATH" ]; then
    log "INFO" "Database backup created successfully in ${DURATION}s (${FILE_SIZE})"
    chmod 600 "$BACKUP_FILEPATH"
  else
    log "ERROR" "Backup file was created but is empty (0 bytes)!"
    rm -f "$BACKUP_FILEPATH"
    exit 1
  fi
else
  log "ERROR" "pg_dump failed during execution!"
  rm -f "$BACKUP_FILEPATH"
  exit 1
fi

# 5. Prune backups older than retention period (default: 30 days)
log "INFO" "Checking for old backups (> ${RETENTION_DAYS} days)..."
OLD_BACKUPS=$(find "$BACKUP_DIR" -type f -name "db_backup_*.sql.gz" -mtime +"$RETENTION_DAYS")

if [ -n "$OLD_BACKUPS" ]; then
  OLD_COUNT=$(echo "$OLD_BACKUPS" | wc -l)
  find "$BACKUP_DIR" -type f -name "db_backup_*.sql.gz" -mtime +"$RETENTION_DAYS" -exec rm -f {} \;
  log "INFO" "Deleted ${OLD_COUNT} old backup file(s)."
else
  log "INFO" "No old backups need deletion."
fi

# 6. Summary
CURRENT_BACKUP_COUNT=$(find "$BACKUP_DIR" -type f -name "db_backup_*.sql.gz" | wc -l)
TOTAL_STORAGE=$(du -sh "$BACKUP_DIR" | cut -f1)
log "INFO" "Total backups stored: ${CURRENT_BACKUP_COUNT} (Total space: ${TOTAL_STORAGE})"
log "INFO" "Backup process finished successfully."
log "INFO" "=================================================="
exit 0
