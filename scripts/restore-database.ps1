# Restore CLMS Database
param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile
)

if (-not (Test-Path $BackupFile)) {
    Write-Error "Backup file not found: $BackupFile"
    exit 1
}

Write-Host "Restoring database from $BackupFile..."
Get-Content $BackupFile | docker exec -i clms-mysql-dev mysql -u clms_user -pclms_password clms_database

if ($?) {
    Write-Host "Restore successful!" -ForegroundColor Green
} else {
    Write-Host "Restore failed!" -ForegroundColor Red
}
