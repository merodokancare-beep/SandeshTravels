# 🛡️ PostgreSQL Automated Daily Backup & Recovery System

This directory contains automated backup and disaster recovery tools for **Sandesh / Vani Travels CRM** on your live VPS.

---

## 📁 Files in this directory

| File | Description |
| :--- | :--- |
| [`setup_backup.sh`](file:///d:/Bhawani%20Works/Project%20All/Website/VaniTravels/deploy/setup_backup.sh) | **One-click automated setup**. Installs `postgresql-client`, sets permissions, installs the daily 2:00 AM Cron job, and runs a test backup. |
| [`backup_db.sh`](file:///d:/Bhawani%20Works/Project%20All/Website/VaniTravels/deploy/backup_db.sh) | The daily backup script. Automatically dumps PostgreSQL, gzips the dump, logs to `/var/log/sandeshtravels_backup.log`, and prunes backups older than 30 days. |
| [`restore_db.sh`](file:///d:/Bhawani%20Works/Project%20All/Website/VaniTravels/deploy/restore_db.sh) | Disaster recovery script. Restores the database from any `.sql.gz` snapshot in 1 command. |

---

## 🚀 Quick Setup on VPS (1 Step)

Connect to your VPS via SSH and run:

```bash
cd /var/www/crm.sandeshtravels.in/deploy
sudo chmod +x setup_backup.sh backup_db.sh restore_db.sh
./setup_backup.sh
```

This single command will:
1. Ensure `postgresql-client` and `gzip` are installed.
2. Create secure backup storage directory at `/var/backups/sandeshtravels` (mode 700).
3. Add a daily Cron job to run automatically every night at **02:00 AM**.
4. Run a verification test backup immediately and display the output.

---

## 🕒 Backup Schedule & Retention

* **Schedule:** Daily at `02:00 AM` (`0 2 * * *`)
* **Storage Location:** `/var/backups/sandeshtravels/`
* **Format:** `db_backup_YYYY-MM-DD_HH-MM-SS.sql.gz` (compressed SQL dump)
* **Retention Policy:** Backups older than **30 days** are automatically cleaned up to save server disk space.
* **Logs:** Real-time timestamped log output stored at `/var/log/sandeshtravels_backup.log`.

---

## 🔍 How to Check Backups & Logs on VPS

### 1. View all saved backups:
```bash
ls -lh /var/backups/sandeshtravels
```

### 2. View backup log history:
```bash
tail -n 50 /var/log/sandeshtravels_backup.log
```

### 3. Check active Cron job:
```bash
crontab -l | grep backup_db.sh
```

### 4. Run a manual backup anytime:
```bash
/var/www/crm.sandeshtravels.in/deploy/backup_db.sh
```

---

## 🔄 Disaster Recovery (Restoring from a Backup)

If you ever need to restore your database from a backup snapshot:

```bash
cd /var/www/crm.sandeshtravels.in/deploy
./restore_db.sh /var/backups/sandeshtravels/db_backup_2026-09-11_02-00-00.sql.gz
```

Type `yes` when prompted to confirm the restoration.
