#!/usr/bin/env bash
# ==============================================================================
# PostgreSQL Database Restoration Script for Vani/Sandesh Travels CRM
# Location: /var/www/crm.sandeshtravels.in/deploy/restore_db.sh
# Usage: ./restore_db.sh /var/backups/sandeshtravels/db_backup_YYYY-MM-DD_HH-MM-SS.sql.gz
# ==============================================================================

set -eo pipefail

APP_DIR="${APP_DIR:-/var/www/crm.sandeshtravels.in}"
BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
  echo "❌ Error: Please specify the backup file to restore."
  echo "Usage: $0 /var/backups/sandeshtravels/db_backup_YYYY-MM-DD_HH-MM-SS.sql.gz"
  echo ""
  echo "Available backups in /var/backups/sandeshtravels:"
  ls -lh /var/backups/sandeshtravels/*.sql.gz 2>/dev/null || echo "No backups found."
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Extract DB connection string
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

if [ -z "$DB_URL" ]; then
  DB_URL="postgresql://postgres:postgres@localhost:5432/postgres"
fi

echo "⚠️  WARNING: You are about to restore the database from:"
echo "   $BACKUP_FILE"
echo "   Target DB: ${DB_URL%%\?*}"
echo ""
read -p "Are you sure you want to proceed? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Restoration cancelled."
  exit 0
fi

echo "⏳ Restoring database..."
gunzip -c "$BACKUP_FILE" | psql "$DB_URL"

echo "✅ Database restored successfully from $BACKUP_FILE!"
