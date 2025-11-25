# CLMS Backup & Recovery Strategy

## Overview

This document outlines the backup and recovery procedures for the Centralized Library Management System (CLMS).

---

## 📦 What to Backup

### 1. Database (MySQL)

**Critical Data**:

- Users and authentication data
- Student records
- Book catalog
- Checkout/return history
- Fines and transactions
- Equipment tracking
- Attendance records
- System settings

**Frequency**: Daily at 3 AM (automated)

### 2. Uploaded Files

**Locations**:

- `Backend/uploads/` - Student photos, documents
- `Backend/barcodes/` - Generated barcodes
- `Backend/qr-codes/` - Generated QR codes

**Frequency**: Daily at 4 AM (automated)

### 3. Configuration Files

**Files**:

- `Backend/.env`
- `Frontend/.env`
- `docker-compose.yml`
- `google-credentials.json` (if used)

**Frequency**: On changes, manual backup

---

## 🔄 Automated Backup Procedures

### Database Backup

**Linux/Mac**:

```bash
#!/bin/bash
# backup-database.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/path/to/backups/database"
DB_NAME="clms"
DB_USER="root"
DB_PASSWORD="your_password"

mkdir -p "$BACKUP_DIR"

mysqldump -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" | gzip > "$BACKUP_DIR/clms_$TIMESTAMP.sql.gz"

# Keep only last 30 days
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete

echo "Database backup completed: clms_$TIMESTAMP.sql.gz"
```

**Windows (PowerShell)**:

```powershell
# backup-database.ps1

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = "C:\Backups\CLMS\Database"
$dbName = "clms"
$dbUser = "root"
$dbPassword = "your_password"

if (!(Test-Path $backupDir)) {
    New-Item -Path $backupDir -ItemType Directory
}

$backupFile = "$backupDir\clms_$timestamp.sql"
mysqldump -u $dbUser -p$dbPassword $dbName > $backupFile

# Compress
Compress-Archive -Path $backupFile -DestinationPath "$backupFile.zip"
Remove-Item $backupFile

# Keep only last 30 days
Get-ChildItem $backupDir -Filter "*.zip" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | Remove-Item

Write-Host "Database backup completed: clms_$timestamp.sql.zip"
```

### File Backup

**Linux/Mac**:

```bash
#!/bin/bash
# backup-files.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/path/to/backups/files"
SOURCE_DIR="/path/to/CLMS/Backend"

mkdir -p "$BACKUP_DIR"

tar -czf "$BACKUP_DIR/files_$TIMESTAMP.tar.gz" \
  "$SOURCE_DIR/uploads" \
  "$SOURCE_DIR/barcodes" \
  "$SOURCE_DIR/qr-codes"

# Keep only last 30 days
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete

echo "File backup completed: files_$TIMESTAMP.tar.gz"
```

**Windows (PowerShell)**:

```powershell
# backup-files.ps1

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = "C:\Backups\CLMS\Files"
$sourceDir = "C:\Path\To\CLMS\Backend"

if (!(Test-Path $backupDir)) {
    New-Item -Path $backupDir -ItemType Directory
}

$backupFile = "$backupDir\files_$timestamp.zip"

Compress-Archive -Path @(
    "$sourceDir\uploads",
    "$sourceDir\barcodes",
    "$sourceDir\qr-codes"
) -DestinationPath $backupFile

# Keep only last 30 days
Get-ChildItem $backupDir -Filter "*.zip" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | Remove-Item

Write-Host "File backup completed: files_$timestamp.zip"
```

---

## 📋 Backup Schedule

### Using Cron (Linux/Mac)

```bash
# Edit crontab
crontab -e

# Add these lines:
0 3 * * * /path/to/backup-database.sh >> /var/log/clms-backup.log 2>&1
0 4 * * * /path/to/backup-files.sh >> /var/log/clms-backup.log 2>&1
```

### Using Task Scheduler (Windows)

1. Open Task Scheduler
2. Create Basic Task
3. Name: "CLMS Database Backup"
4. Trigger: Daily at 3:00 AM
5. Action: Start a program
6. Program: `powershell.exe`
7. Arguments: `-File "C:\Path\To\backup-database.ps1"`
8. Repeat for file backup at 4:00 AM

---

## 🔄 Recovery Procedures

### Database Recovery

**From backup file**:

```bash
# Extract if compressed
gunzip clms_20250126_030000.sql.gz

# Restore to MySQL
mysql -u root -p clms < clms_20250126_030000.sql
```

**Windows**:

```powershell
# Extract
Expand-Archive -Path clms_20250126_030000.sql.zip -DestinationPath .

# Restore
mysql -u root -p clms < clms_20250126_030000.sql
```

### File Recovery

**Linux/Mac**:

```bash
# Extract files
tar -xzf files_20250126_040000.tar.gz -C /path/to/CLMS/Backend
```

**Windows**:

```powershell
# Extract
Expand-Archive -Path files_20250126_040000.zip -DestinationPath C:\Path\To\CLMS\Backend
```

---

## 💾 Offsite Backup

### Recommended Solutions

1. **Cloud Storage** (Recommended)
   - Google Drive
   - Dropbox
   - AWS S3
   - Azure Blob Storage

2. **Network Attached Storage (NAS)**
   - Synology
   - QNAP
   - FreeNAS

### Sync to Google Drive (Example)

```bash
# Install rclone
curl https://rclone.org/install.sh | sudo bash

# Configure Google Drive
rclone config

# Sync backups
rclone sync /path/to/backups gdrive:CLMS-Backups
```

---

## 🧪 Testing Recovery

**Monthly recovery test procedure**:

1. Create test database:

   ```sql
   CREATE DATABASE clms_test;
   ```

2. Restore latest backup:

   ```bash
   mysql -u root -p clms_test < latest_backup.sql
   ```

3. Verify data integrity:

   ```sql
   USE clms_test;
   SELECT COUNT(*) FROM students;
   SELECT COUNT(*) FROM books;
   SELECT COUNT(*) FROM borrows;
   ```

4. Drop test database:
   ```sql
   DROP DATABASE clms_test;
   ```

---

## 📊 Backup Monitoring

### Check backup status:

```bash
# List recent backups
ls -lth /path/to/backups/database | head -10

# Check backup sizes
du -sh /path/to/backups/*

# Verify latest backup
file /path/to/backups/database/$(ls -t /path/to/backups/database | head -1)
```

### Alert on backup failures:

Add to backup scripts:

```bash
if [ $? -eq 0 ]; then
    echo "Backup successful"
else
    echo "Backup FAILED" | mail -s "CLMS Backup Failed" admin@example.com
fi
```

---

## 🔐 Security

1. **Encrypt sensitive backups**:

   ```bash
   # Encrypt
   gpg --symmetric --cipher-algo AES256 backup.sql.gz

   # Decrypt
   gpg --decrypt backup.sql.gz.gpg > backup.sql.gz
   ```

2. **Secure storage permissions**:

   ```bash
   chmod 600 /path/to/backups/*
   chown backup-user:backup-group /path/to/backups/*
   ```

3. **Backup credentials separately** - Never store in same location as data

---

## 📝 Backup Checklist

- [ ] Automated database backups running daily
- [ ] Automated file backups running daily
- [ ] Offsite backup configured
- [ ] Backup monitoring in place
- [ ] Recovery tested monthly
- [ ] Backup retention policy enforced (30 days)
- [ ] Backup encryption enabled
- [ ] Documentation up to date
- [ ] Team trained on recovery procedures

---

## 📞 Emergency Recovery Contact

**System Administrator**: [Your contact]  
**Database Administrator**: [Your contact]  
**Backup Storage Location**: [Location/Service]  
**Last Tested**: [Date]

---

**Document Version**: 1.0  
**Last Updated**: November 26, 2025  
**Review Frequency**: Quarterly
