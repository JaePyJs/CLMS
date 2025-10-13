#!/bin/bash

# Backup verification script for CLMS
# Validates backup integrity and performs test restores

set -euo pipefail

# Configuration
BACKUP_DIR="/backups"
LOG_DIR="/logs"
MYSQL_HOST="${MYSQL_HOST:-mysql-primary}"
MYSQL_USER="${MYSQL_USER:-clms_user}"
MYSQL_PASSWORD_FILE="${MYSQL_PASSWORD_FILE:-/run/secrets/mysql_password}"
TEST_DATABASE="${TEST_DATABASE:-clms_test_backup}"
S3_BUCKET="${S3_BUCKET:-}"
AWS_ACCESS_KEY_ID_FILE="${AWS_ACCESS_KEY_ID_FILE:-/run/secrets/aws_access_key}"
AWS_SECRET_ACCESS_KEY_FILE="${AWS_SECRET_ACCESS_KEY_FILE:-/run/secrets/aws_secret_key}"

# Setup logging
LOG_FILE="$LOG_DIR/backup-verification.log"
exec 1> >(tee -a "$LOG_FILE")
exec 2>&1

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# Function to verify backup file integrity
verify_backup_integrity() {
    local backup_file="$1"

    log "Verifying backup integrity: $backup_file"

    if [[ ! -f "$backup_file" ]]; then
        log "ERROR: Backup file not found: $backup_file"
        return 1
    fi

    # Check file size
    local file_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)
    if [[ $file_size -eq 0 ]]; then
        log "ERROR: Backup file is empty: $backup_file"
        return 1
    fi

    # Verify gzip integrity
    if [[ "$backup_file" == *.gz ]]; then
        if ! gzip -t "$backup_file" 2>/dev/null; then
            log "ERROR: Gzip integrity check failed: $backup_file"
            return 1
        fi
    fi

    # Verify SQL structure (quick check)
    local temp_file=$(mktemp)
    if gunzip -c "$backup_file" > "$temp_file" 2>/dev/null; then
        # Check for essential SQL statements
        if grep -q "CREATE TABLE\|INSERT INTO" "$temp_file"; then
            log "Backup integrity verified: $backup_file"
            rm -f "$temp_file"
            return 0
        else
            log "ERROR: Backup file does not contain expected SQL structure: $backup_file"
            rm -f "$temp_file"
            return 1
        fi
    else
        log "ERROR: Failed to decompress backup file: $backup_file"
        rm -f "$temp_file"
        return 1
    fi
}

# Function to create test database
create_test_database() {
    log "Creating test database: $TEST_DATABASE"

    mysql -h"$MYSQL_HOST" -u"$MYSQL_USER" -p"$(cat $MYSQL_PASSWORD_FILE)" -e "DROP DATABASE IF EXISTS $TEST_DATABASE;" || true
    mysql -h"$MYSQL_HOST" -u"$MYSQL_USER" -p"$(cat $MYSQL_PASSWORD_FILE)" -e "CREATE DATABASE $TEST_DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
}

# Function to perform test restore
perform_test_restore() {
    local backup_file="$1"

    log "Performing test restore from: $backup_file"

    # Create test database
    create_test_database

    # Restore backup to test database
    if gunzip -c "$backup_file" | mysql -h"$MYSQL_HOST" -u"$MYSQL_USER" -p"$(cat $MYSQL_PASSWORD_FILE)" "$TEST_DATABASE"; then
        log "Test restore completed successfully"

        # Verify restored data
        verify_restored_data

        # Clean up test database
        mysql -h"$MYSQL_HOST" -u"$MYSQL_USER" -p"$(cat $MYSQL_PASSWORD_FILE)" -e "DROP DATABASE $TEST_DATABASE;" || true

        return 0
    else
        log "ERROR: Test restore failed"
        mysql -h"$MYSQL_HOST" -u"$MYSQL_USER" -p"$(cat $MYSQL_PASSWORD_FILE)" -e "DROP DATABASE $TEST_DATABASE;" || true
        return 1
    fi
}

# Function to verify restored data
verify_restored_data() {
    log "Verifying restored data..."

    # Check if essential tables exist
    local tables=$(mysql -h"$MYSQL_HOST" -u"$MYSQL_USER" -p"$(cat $MYSQL_PASSWORD_FILE)" "$TEST_DATABASE" -e "SHOW TABLES;" | grep -v "Tables_in_")

    local essential_tables=("students" "books" "equipment" "users" "audit_logs")
    local missing_tables=()

    for table in "${essential_tables[@]}"; do
        if ! echo "$tables" | grep -q "^$table$"; then
            missing_tables+=("$table")
        fi
    done

    if [[ ${#missing_tables[@]} -gt 0 ]]; then
        log "WARNING: Missing essential tables: ${missing_tables[*]}"
    else
        log "All essential tables present"
    fi

    # Check data counts
    local student_count=$(mysql -h"$MYSQL_HOST" -u"$MYSQL_USER" -p"$(cat $MYSQL_PASSWORD_FILE)" "$TEST_DATABASE" -e "SELECT COUNT(*) FROM students;" | tail -1)
    local book_count=$(mysql -h"$MYSQL_HOST" -u"$MYSQL_USER" -p"$(cat $MYSQL_PASSWORD_FILE)" "$TEST_DATABASE" -e "SELECT COUNT(*) FROM books;" | tail -1)
    local user_count=$(mysql -h"$MYSQL_HOST" -u"$MYSQL_USER" -p"$(cat $MYSQL_PASSWORD_FILE)" "$TEST_DATABASE" -e "SELECT COUNT(*) FROM users;" | tail -1)

    log "Data verification - Students: $student_count, Books: $book_count, Users: $user_count"

    if [[ $student_count -eq 0 ]] || [[ $book_count -eq 0 ]] || [[ $user_count -eq 0 ]]; then
        log "WARNING: Some tables appear to be empty"
    fi
}

# Function to verify S3 backups
verify_s3_backups() {
    if [[ -z "$S3_BUCKET" ]]; then
        log "S3 not configured, skipping S3 backup verification"
        return 0
    fi

    log "Verifying S3 backups..."

    export AWS_ACCESS_KEY_ID=$(cat "$AWS_ACCESS_KEY_ID_FILE")
    export AWS_SECRET_ACCESS_KEY=$(cat "$AWS_SECRET_ACCESS_KEY_FILE")

    # List recent backups
    local recent_backups=$(aws s3 ls "s3://$S3_BUCKET/backups/database/" --recursive | sort | tail -5)

    if [[ -z "$recent_backups" ]]; then
        log "WARNING: No backups found in S3"
        return 1
    fi

    log "Found recent S3 backups:"
    echo "$recent_backups"

    # Download and verify most recent backup
    local latest_backup=$(echo "$recent_backups" | tail -1 | awk '{print $4}')
    local temp_file=$(mktemp)

    log "Downloading latest S3 backup: $latest_backup"
    if aws s3 cp "s3://$S3_BUCKET/$latest_backup" "$temp_file"; then
        if verify_backup_integrity "$temp_file"; then
            log "S3 backup verification successful"
            rm -f "$temp_file"
            return 0
        else
            log "ERROR: S3 backup verification failed"
            rm -f "$temp_file"
            return 1
        fi
    else
        log "ERROR: Failed to download S3 backup"
        rm -f "$temp_file"
        return 1
    fi
}

# Function to verify local backups
verify_local_backups() {
    log "Verifying local backups..."

    # Find recent backups
    local recent_backups=$(find "$BACKUP_DIR" -name "clms_database_*.sql.gz" -mtime -7 | sort -r | head -5)

    if [[ -z "$recent_backups" ]]; then
        log "WARNING: No recent local backups found"
        return 1
    fi

    log "Found recent local backups:"
    echo "$recent_backups"

    local failed_backups=0
    local total_backups=0

    while IFS= read -r backup_file; do
        if [[ -n "$backup_file" ]]; then
            total_backups=$((total_backups + 1))
            if ! verify_backup_integrity "$backup_file"; then
                failed_backups=$((failed_backups + 1))
                log "FAILED: $backup_file"
            else
                log "PASSED: $backup_file"
            fi
        fi
    done <<< "$recent_backups"

    log "Local backup verification: $((total_backups - failed_backups))/$total_backups passed"

    if [[ $failed_backups -eq 0 ]]; then
        return 0
    else
        return 1
    fi
}

# Function to generate verification report
generate_report() {
    local report_file="$LOG_DIR/backup-verification-report-$(date '+%Y%m%d_%H%M%S').html"

    log "Generating verification report: $report_file"

    cat > "$report_file" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>CLMS Backup Verification Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .success { background: #d4edda; border-color: #c3e6cb; }
        .warning { background: #fff3cd; border-color: #ffeaa7; }
        .error { background: #f8d7da; border-color: #f5c6cb; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f8f9fa; }
    </style>
</head>
<body>
    <div class="header">
        <h1>CLMS Backup Verification Report</h1>
        <p>Generated on: $(date)</p>
    </div>

    <div class="section">
        <h2>Summary</h2>
        <p>This report contains the results of backup verification checks performed on $(date).</p>
    </div>

    <div class="section">
        <h2>Verification Results</h2>
        <!-- Results will be populated here -->
    </div>

    <div class="section">
        <h2>Recommendations</h2>
        <ul>
            <li>Regularly monitor backup verification results</li>
            <li>Test restore procedures on a schedule</li>
            <li>Monitor storage capacity for backups</li>
            <li>Review retention policies periodically</li>
        </ul>
    </div>
</body>
</html>
EOF

    log "Verification report generated: $report_file"
}

# Main verification function
run_verification() {
    log "Starting backup verification..."

    local verification_success=true

    # Verify local backups
    if ! verify_local_backups; then
        verification_success=false
    fi

    # Verify S3 backups if configured
    if [[ -n "$S3_BUCKET" ]]; then
        if ! verify_s3_backups; then
            verification_success=false
        fi
    fi

    # Perform test restore on most recent backup
    local latest_backup=$(find "$BACKUP_DIR" -name "clms_database_*.sql.gz" -mtime -1 | sort -r | head -1)
    if [[ -n "$latest_backup" ]]; then
        log "Performing test restore on latest backup: $latest_backup"
        if ! perform_test_restore "$latest_backup"; then
            verification_success=false
        fi
    else
        log "WARNING: No recent backup found for test restore"
        verification_success=false
    fi

    # Generate report
    generate_report

    if $verification_success; then
        log "Backup verification completed successfully"
        return 0
    else
        log "Backup verification completed with issues"
        return 1
    fi
}

# Main execution
main() {
    case "${1:-}" in
        "integrity")
            if [[ -n "${2:-}" ]]; then
                verify_backup_integrity "$2"
            else
                log "ERROR: Backup file path required for integrity check"
                exit 1
            fi
            ;;
        "restore")
            if [[ -n "${2:-}" ]]; then
                perform_test_restore "$2"
            else
                log "ERROR: Backup file path required for test restore"
                exit 1
            fi
            ;;
        "local")
            verify_local_backups
            ;;
        "s3")
            verify_s3_backups
            ;;
        "report")
            generate_report
            ;;
        *)
            run_verification
            ;;
    esac
}

# Execute main function
main "$@"