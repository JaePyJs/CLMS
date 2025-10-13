#!/bin/bash

# CLMS Rollback Procedures
# This script provides automated rollback capabilities for failed deployments

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/var/log/clms-rollback.log"
BACKUP_DIR="/opt/clms/backups"
TERRAFORM_DIR="$PROJECT_ROOT/infrastructure/terraform"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE"
}

log_info() {
    log "INFO" "${BLUE}$*${NC}"
}

log_warn() {
    log "WARN" "${YELLOW}$*${NC}"
}

log_error() {
    log "ERROR" "${RED}$*${NC}"
}

log_success() {
    log "SUCCESS" "${GREEN}$*${NC}"
}

# Function to display usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS] COMMAND

COMMANDS:
    rollback-to-last        Rollback to the last known good deployment
    rollback-to-version     Rollback to a specific version
    database-rollback       Rollback database to a specific backup
    full-rollback           Perform complete system rollback
    list-backups            List available backups
    validate-rollback       Validate rollback procedures
    emergency-stop          Emergency stop of all services

OPTIONS:
    --environment ENV      Target environment (production, staging, development)
    --version VERSION      Target version for rollback
    --backup-id ID         Specific backup ID to use
    --dry-run              Simulate rollback without making changes
    --force                Force rollback without confirmation
    --component COMP       Specific component to rollback (backend, frontend, database, all)
    --backup-type TYPE     Type of backup to use (database, full, config)
    --skip-health-check    Skip post-rollback health checks

EXAMPLES:
    $0 rollback-to-last --environment production
    $0 rollback-to-version --version v1.2.3 --environment production
    $0 database-rollback --backup-id 20231201_020000 --environment production
    $0 full-rollback --environment staging --dry-run
    $0 list-backups --environment production --backup-type database

EOF
}

# Function to parse command line arguments
parse_args() {
    ENVIRONMENT=""
    VERSION=""
    BACKUP_ID=""
    DRY_RUN=false
    FORCE=false
    COMPONENT="all"
    BACKUP_TYPE="database"
    SKIP_HEALTH_CHECK=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            --version)
                VERSION="$2"
                shift 2
                ;;
            --backup-id)
                BACKUP_ID="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --force)
                FORCE=true
                shift
                ;;
            --component)
                COMPONENT="$2"
                shift 2
                ;;
            --backup-type)
                BACKUP_TYPE="$2"
                shift 2
                ;;
            --skip-health-check)
                SKIP_HEALTH_CHECK=true
                shift
                ;;
            *)
                COMMAND="$1"
                shift
                ;;
        esac
    done

    # Validate required arguments
    if [[ -z "$ENVIRONMENT" ]]; then
        log_error "Environment is required. Use --environment flag."
        exit 1
    fi

    if [[ ! "$ENVIRONMENT" =~ ^(production|staging|development)$ ]]; then
        log_error "Invalid environment: $ENVIRONMENT. Must be one of: production, staging, development"
        exit 1
    fi
}

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking rollback prerequisites..."

    # Check if running as root or with sudo
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root or with sudo"
        exit 1
    fi

    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running"
        exit 1
    fi

    # Check if Terraform is installed
    if ! command -v terraform >/dev/null 2>&1; then
        log_error "Terraform is not installed"
        exit 1
    fi

    # Check if AWS CLI is installed
    if ! command -v aws >/dev/null 2>&1; then
        log_error "AWS CLI is not installed"
        exit 1
    fi

    # Check if backup directory exists
    if [[ ! -d "$BACKUP_DIR" ]]; then
        log_error "Backup directory $BACKUP_DIR does not exist"
        exit 1
    }

    # Check if we have necessary permissions
    if [[ ! -w "$BACKUP_DIR" ]]; then
        log_error "No write permission to backup directory $BACKUP_DIR"
        exit 1
    fi

    log_success "Prerequisites check passed"
}

# Function to confirm rollback
confirm_rollback() {
    if [[ "$FORCE" == "true" ]]; then
        return 0
    fi

    echo
    log_warn "WARNING: This will rollback the $ENVIRONMENT environment"
    log_warn "This action cannot be undone without another deployment"
    echo
    read -p "Are you sure you want to continue? (yes/no): " -r
    echo

    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log_info "Rollback cancelled by user"
        exit 0
    fi
}

# Function to create rollback checkpoint
create_rollback_checkpoint() {
    local checkpoint_name="rollback-checkpoint-$(date +%Y%m%d_%H%M%S)"
    local checkpoint_dir="$BACKUP_DIR/checkpoints/$checkpoint_name"

    log_info "Creating rollback checkpoint: $checkpoint_name"

    mkdir -p "$checkpoint_dir"

    # Save current container states
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" ps > "$checkpoint_dir/containers.txt"

    # Save current images
    docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}" > "$checkpoint_dir/images.txt"

    # Save current configuration
    cp -r "$PROJECT_ROOT/docker-compose.prod.yml" "$checkpoint_dir/"

    # Save database schema (if accessible)
    if docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "SHOW DATABASES;" >/dev/null 2>&1; then
        log_info "Creating database schema backup"
        docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T mysql mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --no-data clms_database > "$checkpoint_dir/schema.sql"
    fi

    log_success "Rollback checkpoint created: $checkpoint_name"
}

# Function to perform application rollback
rollback_application() {
    local target_version="$1"

    log_info "Rolling back application to version: $target_version"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would rollback application to version $target_version"
        return 0
    fi

    # Stop current services
    log_info "Stopping current services..."
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" down

    # Pull target version images
    log_info "Pulling target version images..."
    if [[ -n "$target_version" ]]; then
        docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" pull backend:"$target_version" frontend:"$target_version"
    else
        docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" pull
    fi

    # Update docker-compose.yml to use target version
    if [[ -n "$target_version" ]]; then
        log_info "Updating docker-compose.yml for version $target_version"
        sed -i.bak "s/:latest/:$target_version/g" "$PROJECT_ROOT/docker-compose.prod.yml"
    fi

    # Start services with target version
    log_info "Starting services with rollback version..."
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" up -d

    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 30

    log_success "Application rollback completed"
}

# Function to perform database rollback
rollback_database() {
    local backup_id="$1"

    log_info "Rolling back database to backup: $backup_id"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would rollback database to backup $backup_id"
        return 0
    fi

    # Find backup file
    local backup_file=""
    if [[ -n "$backup_id" ]]; then
        backup_file="$BACKUP_DIR/database/clms_database_$backup_id.sql.gz"
    else
        # Find most recent backup
        backup_file=$(find "$BACKUP_DIR/database" -name "clms_database_*.sql.gz" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
    fi

    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file not found: $backup_file"
        return 1
    fi

    log_info "Using backup file: $backup_file"

    # Create database backup before rollback
    log_info "Creating pre-rollback database backup..."
    local pre_rollback_backup="pre-rollback-$(date +%Y%m%d_%H%M%S).sql.gz"
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T mysql mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --single-transaction clms_database | gzip > "$BACKUP_DIR/database/$pre_rollback_backup"

    # Stop application services
    log_info "Stopping application services..."
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" stop backend frontend

    # Restore database
    log_info "Restoring database from backup..."
    gunzip -c "$backup_file" | docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" clms_database

    # Start application services
    log_info "Starting application services..."
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" start backend frontend

    log_success "Database rollback completed"
}

# Function to perform infrastructure rollback
rollback_infrastructure() {
    log_info "Rolling back infrastructure changes..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would rollback infrastructure using Terraform"
        return 0
    fi

    cd "$TERRAFORM_DIR"

    # Get previous state
    if [[ -f "terraform.tfstate.backup" ]]; then
        log_info "Restoring previous Terraform state..."
        cp terraform.tfstate.backup terraform.tfstate

        # Apply previous state
        log_info "Applying previous infrastructure state..."
        terraform apply -auto-approve

        log_success "Infrastructure rollback completed"
    else
        log_warn "No previous Terraform state found, skipping infrastructure rollback"
    fi
}

# Function to perform health checks
perform_health_checks() {
    if [[ "$SKIP_HEALTH_CHECK" == "true" ]]; then
        log_info "Skipping health checks as requested"
        return 0
    fi

    log_info "Performing post-rollback health checks..."

    local max_attempts=30
    local attempt=1
    local all_healthy=false

    while [[ $attempt -le $max_attempts ]]; do
        log_info "Health check attempt $attempt/$max_attempts..."

        # Check backend health
        if curl -f http://localhost:3001/health >/dev/null 2>&1; then
            log_success "Backend health check passed"
            local backend_healthy=true
        else
            log_warn "Backend health check failed"
            local backend_healthy=false
        fi

        # Check frontend health
        if curl -f http://localhost:3000/health >/dev/null 2>&1; then
            log_success "Frontend health check passed"
            local frontend_healthy=true
        else
            log_warn "Frontend health check failed"
            local frontend_healthy=false
        fi

        # Check database health
        if docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T mysql mysqladmin ping -h localhost --silent; then
            log_success "Database health check passed"
            local database_healthy=true
        else
            log_warn "Database health check failed"
            local database_healthy=false
        fi

        if [[ "$backend_healthy" == "true" && "$frontend_healthy" == "true" && "$database_healthy" == "true" ]]; then
            all_healthy=true
            break
        fi

        sleep 10
        ((attempt++))
    done

    if [[ "$all_healthy" == "true" ]]; then
        log_success "All health checks passed"
        return 0
    else
        log_error "Health checks failed after $max_attempts attempts"
        return 1
    fi
}

# Function to list available backups
list_backups() {
    log_info "Listing available backups for environment: $ENVIRONMENT"

    echo
    echo "Database Backups:"
    echo "=================="
    if [[ -d "$BACKUP_DIR/database" ]]; then
        find "$BACKUP_DIR/database" -name "clms_database_*.sql.gz" -type f -printf '%T@ %f\n' | sort -n | while read -r timestamp filename; do
            local date=$(date -d "@${timestamp%.*}" '+%Y-%m-%d %H:%M:%S')
            local size=$(stat -f%z "$BACKUP_DIR/database/$filename" 2>/dev/null || stat -c%s "$BACKUP_DIR/database/$filename" 2>/dev/null)
            local size_mb=$((size / 1024 / 1024))
            echo "$date | $filename | ${size_mb}MB"
        done
    else
        echo "No database backups found"
    fi

    echo
    echo "Full Backups:"
    echo "============="
    if [[ -d "$BACKUP_DIR/full" ]]; then
        find "$BACKUP_DIR/full" -name "clms_full_backup_*.tar.gz" -type f -printf '%T@ %f\n' | sort -n | while read -r timestamp filename; do
            local date=$(date -d "@${timestamp%.*}" '+%Y-%m-%d %H:%M:%S')
            local size=$(stat -f%z "$BACKUP_DIR/full/$filename" 2>/dev/null || stat -c%s "$BACKUP_DIR/full/$filename" 2>/dev/null)
            local size_mb=$((size / 1024 / 1024))
            echo "$date | $filename | ${size_mb}MB"
        done
    else
        echo "No full backups found"
    fi

    echo
    echo "Rollback Checkpoints:"
    echo "===================="
    if [[ -d "$BACKUP_DIR/checkpoints" ]]; then
        find "$BACKUP_DIR/checkpoints" -maxdepth 1 -type d -name "rollback-checkpoint_*" -printf '%T@ %f\n' | sort -n | while read -r timestamp dirname; do
            local date=$(date -d "@${timestamp%.*}" '+%Y-%m-%d %H:%M:%S')
            echo "$date | $dirname"
        done
    else
        echo "No rollback checkpoints found"
    fi
}

# Function to perform emergency stop
emergency_stop() {
    log_warn "Performing emergency stop of all CLMS services..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would stop all services"
        return 0
    fi

    # Stop all services
    log_info "Stopping all services..."
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" down

    # Create emergency checkpoint
    create_rollback_checkpoint

    log_warn "Emergency stop completed"
    log_info "All services are now stopped"
    log_info "Use rollback procedures to restore services when ready"
}

# Function to validate rollback procedures
validate_rollback() {
    log_info "Validating rollback procedures..."

    # Check backup availability
    local recent_backups=$(find "$BACKUP_DIR/database" -name "clms_database_*.sql.gz" -mtime -7 | wc -l)
    if [[ $recent_backups -eq 0 ]]; then
        log_error "No recent database backups found (last 7 days)"
        return 1
    else
        log_success "Found $recent_backups recent database backups"
    fi

    # Check docker-compose file
    if [[ ! -f "$PROJECT_ROOT/docker-compose.prod.yml" ]]; then
        log_error "Production docker-compose file not found"
        return 1
    else
        log_success "Production docker-compose file found"
    fi

    # Check Terraform state
    if [[ -f "$TERRAFORM_DIR/terraform.tfstate" ]]; then
        log_success "Terraform state file found"
    else
        log_warn "Terraform state file not found"
    fi

    # Test database connection
    if docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T mysql mysqladmin ping -h localhost --silent; then
        log_success "Database connection test passed"
    else
        log_error "Database connection test failed"
        return 1
    fi

    # Test application health
    if curl -f http://localhost:3001/health >/dev/null 2>&1; then
        log_success "Backend health check passed"
    else
        log_warn "Backend health check failed"
    fi

    if curl -f http://localhost:3000/health >/dev/null 2>&1; then
        log_success "Frontend health check passed"
    else
        log_warn "Frontend health check failed"
    fi

    log_success "Rollback validation completed"
}

# Main execution function
main() {
    local COMMAND="$1"

    log_info "Starting CLMS rollback procedure"
    log_info "Environment: $ENVIRONMENT"
    log_info "Command: $COMMAND"

    # Set environment variables
    export MYSQL_ROOT_PASSWORD=$(cat /run/secrets/mysql_root_password 2>/dev/null || echo "")
    export COMPOSE_PROJECT_NAME="clms-$ENVIRONMENT"

    case "$COMMAND" in
        "rollback-to-last")
            check_prerequisites
            confirm_rollback
            create_rollback_checkpoint
            rollback_application ""
            if [[ "$COMPONENT" == "all" || "$COMPONENT" == "database" ]]; then
                rollback_database ""
            fi
            perform_health_checks
            ;;
        "rollback-to-version")
            if [[ -z "$VERSION" ]]; then
                log_error "Version is required for rollback-to-version"
                exit 1
            fi
            check_prerequisites
            confirm_rollback
            create_rollback_checkpoint
            rollback_application "$VERSION"
            perform_health_checks
            ;;
        "database-rollback")
            check_prerequisites
            confirm_rollback
            create_rollback_checkpoint
            rollback_database "$BACKUP_ID"
            perform_health_checks
            ;;
        "full-rollback")
            check_prerequisites
            confirm_rollback
            create_rollback_checkpoint
            rollback_infrastructure
            rollback_application ""
            rollback_database ""
            perform_health_checks
            ;;
        "list-backups")
            list_backups
            ;;
        "validate-rollback")
            validate_rollback
            ;;
        "emergency-stop")
            check_prerequisites
            emergency_stop
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            usage
            exit 1
            ;;
    esac

    if [[ "$DRY_RUN" != "true" ]]; then
        log_success "Rollback procedure completed successfully"
    else
        log_info "DRY RUN completed - no changes were made"
    fi
}

# Parse command line arguments
COMMAND=""
if [[ $# -eq 0 ]]; then
    usage
    exit 1
fi

# Parse arguments
parse_args "$@"

# Execute main function
main "$COMMAND"