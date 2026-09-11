#!/usr/bin/env bash
# ==============================================================================
# One-Command Daily Backup Setup Script for Vani / Sandesh Travels CRM
# Location: /var/www/crm.sandeshtravels.in/deploy/setup_backup.sh
# ==============================================================================

set -eo pipefail

echo "=========================================================="
echo "🚀 Setting up Daily Automated Database Backup for CRM..."
echo "=========================================================="

APP_DIR="/var/www/crm.sandeshtravels.in"
DEPLOY_DIR="${APP_DIR}/deploy"
BACKUP_SCRIPT="${DEPLOY_DIR}/backup_db.sh"
RESTORE_SCRIPT="${DEPLOY_DIR}/restore_db.sh"
BACKUP_DIR="/var/backups/sandeshtravels"
CRON_SCHEDULE="0 2 * * *" # Runs every day at 02:00 AM (server time)

# 1. Check & install prerequisites
echo ">>> [1/5] Checking required tools (postgresql-client, gzip)..."
if ! command -v pg_dump >/dev/null 2>&1; then
  echo "Installing postgresql-client..."
  sudo apt-get update -y && sudo apt-get install -y postgresql-client gzip
else
  echo "postgresql-client is already installed."
fi

# 2. Setup backup directory
echo ">>> [2/5] Creating backup directory at ${BACKUP_DIR}..."
sudo mkdir -p "$BACKUP_DIR"
sudo chmod 700 "$BACKUP_DIR"

# 3. Set executable permissions on scripts
echo ">>> [3/5] Setting executable permissions on backup & restore scripts..."
chmod +x "$BACKUP_SCRIPT" "$RESTORE_SCRIPT"

# 4. Configure Cron Job
echo ">>> [4/5] Configuring Cron Job to run daily at 2:00 AM..."
CRON_CMD="/bin/bash ${BACKUP_SCRIPT} >> /var/log/sandeshtravels_backup.log 2>&1"

# Check if cron job already exists
CURRENT_CRONTAB=$(crontab -l 2>/dev/null || true)
if echo "$CURRENT_CRONTAB" | grep -Fq "${BACKUP_SCRIPT}"; then
  echo "Cron job for backup is already installed in crontab."
else
  # Add new cron job
  (echo "$CURRENT_CRONTAB"; echo "# Daily CRM Database Backup (Sandesh Travels)"; echo "${CRON_SCHEDULE} ${CRON_CMD}") | crontab -
  echo "✅ Daily cron job registered successfully!"
fi

echo ""
echo "Active crontab schedule:"
crontab -l | grep -B 1 "${BACKUP_SCRIPT}" || true
echo ""

# 5. Run immediate test backup
echo ">>> [5/5] Running immediate test backup to verify everything works..."
/bin/bash "$BACKUP_SCRIPT"

echo ""
echo "=========================================================="
echo "🎉 Daily DB Backup is now ACTIVE & VERIFIED!"
echo "Backups stored in: ${BACKUP_DIR}"
echo "Log file: /var/log/sandeshtravels_backup.log"
echo "Schedule: Every night at 02:00 AM"
echo "=========================================================="
