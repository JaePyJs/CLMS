#!/bin/bash

# Backup scheduler for CLMS
# This script runs scheduled backups based on environment configuration

set -euo pipefail

# Configuration
BACKUP_DIR="/backups"
LOG_DIR="/logs"
BACKUP_SCHEDULE="${BACKUP_SCHEDULE:-0 2 * * *}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
MYSQL_HOST="${MYSQL_HOST:-mysql-primary}"
MYSQL_USER="${MYSQL_USER:-clms_user}"
MYSQL_PASSWORD_FILE="${MYSQL_PASSWORD_FILE:-/run/secrets/mysql_password}"
S3_BUCKET="${S3_BUCKET:-}"
AWS_ACCESS_KEY_ID_FILE="${AWS_ACCESS_KEY_ID_FILE:-/run/secrets/aws_access_key}"
AWS_SECRET_ACCESS_KEY_FILE="${AWS_SECRET_ACCESS_KEY_FILE:-/run/secrets/aws_secret_key}"
HEALTH_PORT="${HEALTH_PORT:-8080}"

# Setup logging
LOG_FILE="$LOG_DIR/backup-scheduler.log"
exec 1> >(tee -a "$LOG_FILE")
exec 2>&1

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# Function to check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    # Check MySQL connection
    if ! mysqladmin ping -h"$MYSQL_HOST" -u"$MYSQL_USER" -p"$(cat $MYSQL_PASSWORD_FILE)" --silent; then
        log "ERROR: Cannot connect to MySQL server"
        exit 1
    fi

    # Check S3 configuration if provided
    if [[ -n "$S3_BUCKET" ]]; then
        if [[ ! -f "$AWS_ACCESS_KEY_ID_FILE" ]] || [[ ! -f "$AWS_SECRET_ACCESS_KEY_FILE" ]]; then
            log "ERROR: AWS credentials not found"
            exit 1
        fi

        export AWS_ACCESS_KEY_ID=$(cat "$AWS_ACCESS_KEY_ID_FILE")
        export AWS_SECRET_ACCESS_KEY=$(cat "$AWS_SECRET_ACCESS_KEY_FILE")

        if ! aws s3 ls "$S3_BUCKET" >/dev/null 2>&1; then
            log "ERROR: Cannot access S3 bucket $S3_BUCKET"
            exit 1
        fi
    fi

    log "Prerequisites check passed"
}

# Function to perform backup
perform_backup() {
    local backup_type="$1"
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local backup_file="clms_${backup_type}_${timestamp}.sql.gz"
    local backup_path="$BACKUP_DIR/$backup_file"

    log "Starting ${backup_type} backup..."

    # Create backup
    if mysqldump \
        -h"$MYSQL_HOST" \
        -u"$MYSQL_USER" \
        -p"$(cat $MYSQL_PASSWORD_FILE)" \
        --single-transaction \
        --routines \
        --triggers \
        --events \
        --hex-blob \
        --default-character-set=utf8mb4 \
        clms_database | gzip > "$backup_path"; then

        log "Backup created: $backup_file"

        # Verify backup file
        if [[ -f "$backup_path" ]] && [[ -s "$backup_path" ]]; then
            local backup_size=$(du -h "$backup_path" | cut -f1)
            log "Backup verified. Size: $backup_size"

            # Upload to S3 if configured
            if [[ -n "$S3_BUCKET" ]]; then
                log "Uploading backup to S3..."
                if aws s3 cp "$backup_path" "s3://$S3_BUCKET/backups/database/"; then
                    log "Backup uploaded to S3 successfully"
                else
                    log "WARNING: Failed to upload backup to S3"
                fi
            fi

            # Clean old backups
            clean_old_backups "$backup_type"

            return 0
        else
            log "ERROR: Backup file is empty or missing"
            return 1
        fi
    else
        log "ERROR: Backup creation failed"
        return 1
    fi
}

# Function to clean old backups
clean_old_backups() {
    local backup_type="$1"

    log "Cleaning old ${backup_type} backups (retention: $BACKUP_RETENTION_DAYS days)..."

    # Clean local backups
    find "$BACKUP_DIR" -name "clms_${backup_type}_*.sql.gz" -mtime "+$BACKUP_RETENTION_DAYS" -delete -print | while read -r file; do
        log "Deleted old backup: $file"
    done

    # Clean S3 backups if configured
    if [[ -n "$S3_BUCKET" ]]; then
        local cutoff_date=$(date -d "$BACKUP_RETENTION_DAYS days ago" '+%Y%m%d')
        aws s3 ls "s3://$S3_BUCKET/backups/database/" | \
            grep "clms_${backup_type}_" | \
            awk -v cutoff="$cutoff_date" '$1 < cutoff {print $4}' | \
            while read -r file; do
                if aws s3 rm "s3://$S3_BUCKET/backups/database/$file"; then
                    log "Deleted old S3 backup: $file"
                else
                    log "WARNING: Failed to delete old S3 backup: $file"
                fi
            done
    fi
}

# Function to perform full backup (database + files)
perform_full_backup() {
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local backup_dir="clms_full_backup_$timestamp"
    local backup_path="$BACKUP_DIR/$backup_dir"
    local archive_file="$backup_dir.tar.gz"

    log "Starting full backup..."

    # Create backup directory
    mkdir -p "$backup_path"/{database,uploads,generated,logs}

    # Database backup
    if perform_backup "database"; then
        mv "$BACKUP_DIR/clms_database_$(date '+%Y%m%d_%H%M%S').sql.gz" "$backup_path/database/"
    fi

    # Backup uploaded files (if they exist)
    if [[ -d "/app/uploads" ]]; then
        log "Backing up uploaded files..."
        cp -r /app/uploads/* "$backup_path/uploads/" 2>/dev/null || true
    fi

    # Backup generated files (if they exist)
    if [[ -d "/app/generated" ]]; then
        log "Backing up generated files..."
        cp -r /app/generated/* "$backup_path/generated/" 2>/dev/null || true
    fi

    # Create archive
    log "Creating full backup archive..."
    tar -czf "$BACKUP_DIR/$archive_file" -C "$BACKUP_DIR" "$backup_dir"

    # Verify archive
    if [[ -f "$BACKUP_DIR/$archive_file" ]] && [[ -s "$BACKUP_DIR/$archive_file" ]]; then
        local archive_size=$(du -h "$BACKUP_DIR/$archive_file" | cut -f1)
        log "Full backup archive created: $archive_file (Size: $archive_size)"

        # Upload to S3 if configured
        if [[ -n "$S3_BUCKET" ]]; then
            log "Uploading full backup to S3..."
            if aws s3 cp "$BACKUP_DIR/$archive_file" "s3://$S3_BUCKET/backups/full/"; then
                log "Full backup uploaded to S3 successfully"
            else
                log "WARNING: Failed to upload full backup to S3"
            fi
        fi

        # Cleanup temporary directory
        rm -rf "$backup_path"

        # Clean old full backups
        find "$BACKUP_DIR" -name "clms_full_backup_*.tar.gz" -mtime "+$BACKUP_RETENTION_DAYS" -delete -print | while read -r file; do
            log "Deleted old full backup: $file"
        done
    else
        log "ERROR: Full backup archive creation failed"
        rm -rf "$backup_path"
        return 1
    fi
}

# Function to restore backup
restore_backup() {
    local backup_file="$1"

    log "Starting restore from backup: $backup_file"

    if [[ ! -f "$backup_file" ]]; then
        log "ERROR: Backup file not found: $backup_file"
        return 1
    fi

    # Extract backup if it's a full backup archive
    if [[ "$backup_file" == *.tar.gz ]]; then
        log "Extracting full backup archive..."
        local temp_dir=$(mktemp -d)
        tar -xzf "$backup_file" -C "$temp_dir"

        local database_backup=$(find "$temp_dir" -name "*.sql.gz" | head -1)
        if [[ -n "$database_backup" ]]; then
            log "Restoring database..."
            gunzip -c "$database_backup" | mysql -h"$MYSQL_HOST" -u"$MYSQL_USER" -p"$(cat $MYSQL_PASSWORD_FILE)" clms_database
        fi

        # Restore files if needed
        # Add file restoration logic here

        rm -rf "$temp_dir"
    else
        # Database only backup
        log "Restoring database..."
        gunzip -c "$backup_file" | mysql -h"$MYSQL_HOST" -u"$MYSQL_USER" -p"$(cat $MYSQL_PASSWORD_FILE)" clms_database
    fi

    log "Restore completed successfully"
}

# Health check endpoint
start_health_server() {
    while true; do
        echo -e "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\nhealthy" | nc -l -p "$HEALTH_PORT" -q 1 &
        sleep 30
    done
}

# Main execution
main() {
    log "CLMS Backup Scheduler Started"
    log "Schedule: $BACKUP_SCHEDULE"
    log "Retention: $BACKUP_RETENTION_DAYS days"

    # Check prerequisites
    check_prerequisites

    # Start health check server in background
    start_health_server &

    # Perform initial backup
    log "Performing initial backup..."
    perform_backup "database"

    # Setup cron schedule
    log "Setting up cron schedule..."
    echo "$BACKUP_SCHEDULE /scripts/backup-scheduler.sh run" | crontab -

    # Keep the container running
    while true; do
        sleep 3600  # Sleep for 1 hour
    done
}

# Handle command line arguments
case "${1:-}" in
    "run")
        perform_backup "database"
        ;;
    "full")
        perform_full_backup
        ;;
    "restore")
        if [[ -n "${2:-}" ]]; then
            restore_backup "$2"
        else
            log "ERROR: Backup file path required for restore"
            exit 1
        fi
        ;;
    "check")
        check_prerequisites
        ;;
    *)
        main
        ;;
esac