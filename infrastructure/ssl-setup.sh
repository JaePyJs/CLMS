#!/bin/bash

# ============================================================================
# CLMS SSL/TLS Configuration and Certificate Management Script
# ============================================================================
# Purpose: Configure SSL/TLS with automated certificate management
# Usage: sudo bash ssl-setup.sh [--renew|--install|--test]
# Network: 192.168.1.0/24 (local deployment with self-signed certs)
# Features: Self-signed certificates, Let's Encrypt support, SSL hardening
# ============================================================================

set -euo pipefail

# Configuration
DOMAIN="clms.local"
ALT_DOMAINS="www.clms.local,192.168.1.100"
CERT_DIR="/etc/nginx/ssl"
CERTBOT_DIR="/etc/letsencrypt"
BACKUP_DIR="/opt/clms/backups/ssl"
COUNTRY="US"
STATE="State"
CITY="City"
ORGANIZATION="School Library"
ORGANIZATIONAL_UNIT="IT Department"
EMAIL="admin@clms.local"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root (use sudo)"
    fi
}

# Create directories
create_directories() {
    log "Creating SSL directories..."

    mkdir -p "$CERT_DIR"
    mkdir -p "$CERTBOT_DIR"
    mkdir -p "$BACKUP_DIR"
    mkdir -p /var/www/certbot

    # Set permissions
    chmod 755 "$CERT_DIR"
    chmod 755 "$CERTBOT_DIR"
    chmod 700 "$BACKUP_DIR"
    chmod 755 /var/www/certbot

    log "SSL directories created"
}

# Backup existing certificates
backup_certificates() {
    log "Backing up existing certificates..."

    if [[ -d "$CERT_DIR" && $(ls -A "$CERT_DIR") ]]; then
        BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        BACKUP_PATH="$BACKUP_DIR/backup_$BACKUP_TIMESTAMP"
        mkdir -p "$BACKUP_PATH"
        cp -r "$CERT_DIR"/* "$BACKUP_PATH/" 2>/dev/null || true
        log "Certificates backed up to $BACKUP_PATH"
    fi
}

# Generate Diffie-Hellman parameters
generate_dh_params() {
    log "Generating Diffie-Hellman parameters..."

    DH_PARAMS_FILE="$CERT_DIR/dhparam.pem"

    if [[ ! -f "$DH_PARAMS_FILE" ]]; then
        log "Generating 2048-bit DH parameters (this may take a few minutes)..."
        openssl dhparam -out "$DH_PARAMS_FILE" 2048
        chmod 600 "$DH_PARAMS_FILE"
        log "DH parameters generated"
    else
        log "DH parameters already exist"
    fi
}

# Generate self-signed certificate
generate_self_signed_cert() {
    log "Generating self-signed certificate..."

    # Generate private key
    openssl genrsa -out "$CERT_DIR/clms.key" 4096
    chmod 600 "$CERT_DIR/clms.key"

    # Create certificate signing request
    openssl req -new -key "$CERT_DIR/clms.key" -out "$CERT_DIR/clms.csr" -subj "/C=$COUNTRY/ST=$STATE/L=$CITY/O=$ORGANIZATION/OU=$ORGANIZATIONAL_UNIT/CN=$DOMAIN/emailAddress=$EMAIL"

    # Create configuration file for certificate
    cat > "$CERT_DIR/clms.conf" << EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = $COUNTRY
ST = $STATE
L = $CITY
O = $ORGANIZATION
OU = $ORGANIZATIONAL_UNIT
CN = $DOMAIN
emailAddress = $EMAIL

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = $DOMAIN
DNS.2 = www.$DOMAIN
IP.1 = 192.168.1.100
IP.2 = 127.0.0.1
EOF

    # Generate self-signed certificate
    openssl x509 -req -days 365 -in "$CERT_DIR/clms.csr" -signkey "$CERT_DIR/clms.key" -out "$CERT_DIR/clms.crt" -extensions v3_req -extfile "$CERT_DIR/clms.conf"

    # Create certificate chain file
    cp "$CERT_DIR/clms.crt" "$CERT_DIR/clms-chain.pem"

    # Set permissions
    chmod 644 "$CERT_DIR/clms.crt"
    chmod 644 "$CERT_DIR/clms-chain.pem"
    chmod 600 "$CERT_DIR/clms.csr"

    # Cleanup
    rm "$CERT_DIR/clms.conf"

    log "Self-signed certificate generated"
}

# Install Certbot for Let's Encrypt
install_certbot() {
    log "Installing Certbot for Let's Encrypt..."

    # Update package list
    apt-get update

    # Install certbot and nginx plugin
    apt-get install -y certbot python3-certbot-nginx

    log "Certbot installed"
}

# Configure Let's Encrypt certificate
configure_lets_encrypt() {
    log "Configuring Let's Encrypt certificate..."

    # Check if domain is reachable
    if ! curl -s "http://$DOMAIN" > /dev/null; then
        warning "Domain $DOMAIN is not reachable from internet. Using self-signed certificate."
        return 1
    fi

    # Request certificate
    certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --email "$EMAIL" --redirect --hsts --staple-ocsp --must-staple

    log "Let's Encrypt certificate configured"
}

# Create SSL monitoring script
create_ssl_monitoring() {
    log "Creating SSL monitoring script..."

    cat > /usr/local/bin/ssl-monitor.sh << 'EOF'
#!/bin/bash

# SSL certificate monitoring script
CERT_DIR="/etc/nginx/ssl"
CERTBOT_DIR="/etc/letsencrypt"
LOG_FILE="/var/log/ssl-monitor.log"
ALERT_DAYS=30

# Function to check certificate expiry
check_cert_expiry() {
    local cert_file=$1
    local cert_name=$2

    if [[ -f "$cert_file" ]]; then
        expiry_date=$(openssl x509 -in "$cert_file" -noout -enddate | cut -d= -f2)
        expiry_timestamp=$(date -d "$expiry_date" +%s)
        current_timestamp=$(date +%s)
        days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))

        echo "$(date): $cert_name expires in $days_until_expiry days ($expiry_date)" >> $LOG_FILE

        if [[ $days_until_expiry -lt $ALERT_DAYS ]]; then
            echo "$(date): WARNING: $cert_name expires in $days_until_expiry days!" >> $LOG_FILE
            # Send alert (configure as needed)
            # echo "SSL certificate $cert_name expires in $days_until_expiry days" | mail -s "SSL Certificate Alert" admin@example.com
        fi
    fi
}

# Check self-signed certificates
check_cert_expiry "$CERT_DIR/clms.crt" "clms.local"

# Check Let's Encrypt certificates
if [[ -d "$CERTBOT_DIR/live" ]]; then
    for cert_dir in "$CERTBOT_DIR/live"/*; do
        if [[ -d "$cert_dir" && -f "$cert_dir/fullchain.pem" ]]; then
            domain=$(basename "$cert_dir")
            check_cert_expiry "$cert_dir/fullchain.pem" "$domain"
        fi
    done
fi

# Check SSL configuration
if nginx -t > /dev/null 2>&1; then
    echo "$(date): SSL configuration is valid" >> $LOG_FILE
else
    echo "$(date): ERROR: SSL configuration is invalid" >> $LOG_FILE
fi
EOF

    chmod +x /usr/local/bin/ssl-monitor.sh

    # Add to crontab
    (crontab -l 2>/dev/null; echo "0 6 * * * /usr/local/bin/ssl-monitor.sh") | crontab -

    log "SSL monitoring configured"
}

# Create certificate renewal script
create_renewal_script() {
    log "Creating certificate renewal script..."

    cat > /usr/local/bin/ssl-renew.sh << 'EOF'
#!/bin/bash

# SSL certificate renewal script
LOG_FILE="/var/log/ssl-renew.log"

echo "$(date): Starting SSL certificate renewal check" >> $LOG_FILE

# Renew Let's Encrypt certificates
if command -v certbot &> /dev/null; then
    certbot renew --quiet --no-self-upgrade >> $LOG_FILE 2>&1

    if [[ $? -eq 0 ]]; then
        echo "$(date): Certbot renewal completed" >> $LOG_FILE

        # Test nginx configuration
        if nginx -t > /dev/null 2>&1; then
            echo "$(date): Reloading nginx with new certificates" >> $LOG_FILE
            systemctl reload nginx
        else
            echo "$(date): ERROR: Nginx configuration test failed" >> $LOG_FILE
        fi
    else
        echo "$(date): ERROR: Certbot renewal failed" >> $LOG_FILE
    fi
else
    echo "$(date): Certbot not available" >> $LOG_FILE
fi

echo "$(date): SSL renewal check completed" >> $LOG_FILE
EOF

    chmod +x /usr/local/bin/ssl-renew.sh

    # Add to crontab (daily at 3 AM)
    (crontab -l 2>/dev/null; echo "0 3 * * * /usr/local/bin/ssl-renew.sh") | crontab -

    log "Certificate renewal script configured"
}

# Test SSL configuration
test_ssl_configuration() {
    log "Testing SSL configuration..."

    # Test nginx configuration
    if nginx -t; then
        log "✓ Nginx SSL configuration is valid"
    else
        error "✗ Nginx SSL configuration is invalid"
    fi

    # Test certificate validity
    if [[ -f "$CERT_DIR/clms.crt" ]]; then
        cert_end_date=$(openssl x509 -in "$CERT_DIR/clms.crt" -noout -enddate | cut -d= -f2)
        log "✓ Certificate valid until: $cert_end_date"
    fi

    # Test SSL connectivity
    if command -v openssl &> /dev/null; then
        if echo | openssl s_client -connect localhost:443 -servername "$DOMAIN" 2>/dev/null | grep -q "Verify return code: 0 (ok)"; then
            log "✓ SSL connection test passed"
        else
            warning "✗ SSL connection test failed"
        fi
    fi

    log "SSL configuration testing completed"
}

# Display certificate information
display_certificate_info() {
    log "SSL certificate information:"

    if [[ -f "$CERT_DIR/clms.crt" ]]; then
        echo "Certificate file: $CERT_DIR/clms.crt"
        echo "Key file: $CERT_DIR/clms.key"
        echo "DH parameters: $CERT_DIR/dhparam.pem"

        # Display certificate details
        openssl x509 -in "$CERT_DIR/clms.crt" -noout -text | grep -A 2 "Subject Alternative Name" || true
        openssl x509 -in "$CERT_DIR/clms.crt" -noout -dates

        # Check certificate strength
        key_size=$(openssl rsa -in "$CERT_DIR/clms.key" -noout -text | grep "Private-Key" | grep -o '[0-9]*' | head -1)
        echo "Key size: $key_size bits"
    fi

    if [[ -d "$CERTBOT_DIR/live" ]]; then
        echo ""
        echo "Let's Encrypt certificates:"
        ls -la "$CERTBOT_DIR/live"
    fi
}

# Create SSL security configuration
create_ssl_hardening() {
    log "Creating SSL security hardening configuration..."

    cat > "$CERT_DIR/ssl-security.conf" << EOF
# SSL/TLS Security Hardening Configuration
# This file contains SSL security settings for CLMS

# Strong SSL protocols
ssl_protocols TLSv1.2 TLSv1.3;

# Strong cipher suites
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;

# Prefer server ciphers
ssl_prefer_server_ciphers off;

# SSL session settings
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_session_tickets off;

# OCSP stapling
ssl_stapling on;
ssl_stapling_verify on;

# SSL security settings
ssl_ecdh_curve secp384r1;
ssl_buffer_size 8k;

# HSTS header (add to server configuration)
# add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

# Certificate files
ssl_certificate $CERT_DIR/clms.crt;
ssl_certificate_key $CERT_DIR/clms.key;
ssl_trusted_certificate $CERT_DIR/clms-chain.pem;
ssl_dhparam $CERT_DIR/dhparam.pem;
EOF

    log "SSL security configuration created"
}

# Main execution
main() {
    local action=${1:-install}

    case $action in
        "install")
            log "Starting SSL/TLS installation..."
            check_root
            create_directories
            backup_certificates
            generate_dh_params
            generate_self_signed_cert
            install_certbot
            create_ssl_hardening
            create_ssl_monitoring
            create_renewal_script

            # Try Let's Encrypt if domain is reachable
            if configure_lets_encrypt; then
                log "Let's Encrypt certificate configured successfully"
            else
                log "Using self-signed certificate"
            fi

            test_ssl_configuration
            display_certificate_info
            ;;

        "renew")
            log "Renewing SSL certificates..."
            check_root
            /usr/local/bin/ssl-renew.sh
            ;;

        "test")
            log "Testing SSL configuration..."
            test_ssl_configuration
            display_certificate_info
            ;;

        "monitor")
            log "Running SSL monitoring..."
            /usr/local/bin/ssl-monitor.sh
            ;;

        *)
            echo "Usage: $0 {install|renew|test|monitor}"
            exit 1
            ;;
    esac

    log "SSL/TLS configuration completed successfully!"
}

# Run main function
main "$@"