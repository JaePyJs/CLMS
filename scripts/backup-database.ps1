# Backup CLMS Database
$date = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = "backups"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}
$backupFile = "$backupDir\clms_backup_$date.sql"

Write-Host "Backing up database to $backupFile..."
docker exec clms-mysql-dev mysqldump -u clms_user -pclms_password clms_database > $backupFile

if ($?) {
    Write-Host "Backup successful!" -ForegroundColor Green
} else {
    Write-Host "Backup failed!" -ForegroundColor Red
}
