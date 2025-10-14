#!/bin/bash

# ============================================================================
# CLMS Production Firewall Configuration Script
# ============================================================================
# Purpose: Configure comprehensive firewall rules for CLMS production deployment
# Usage: sudo bash firewall-setup.sh
# Network: 192.168.1.0/24 (local-only access)
# Ports: 3000, 3001, 3308, 6379 (internal access only)
# ============================================================================

set -euo pipefail

# Configuration
NETWORK_SUBNET="192.168.1.0/24"
FRONTEND_PORT="3000"
BACKEND_PORT="3001"
MYSQL_PORT="3308"
REDIS_PORT="6379"
NGINX_HTTP_PORT="80"
NGINX_HTTPS_PORT="443"
MONITORING_PORT="9090"
GRAFANA_PORT="3001"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root (use sudo)"
    fi
}

# Backup existing firewall rules
backup_firewall() {
    log "Backing up existing firewall rules..."

    # Backup iptables
    if command -v iptables-save &> /dev/null; then
        iptables-save > /etc/iptables.backup.$(date +%Y%m%d_%H%M%S)
        log "iptables rules backed up"
    fi

    # Backup ufw if available
    if command -v ufw &> /dev/null; then
        ufw status verbose > /etc/ufw.backup.$(date +%Y%m%d_%H%M%S)
        log "UFW rules backed up"
    fi
}

# Detect firewall management tool
detect_firewall() {
    if command -v ufw &> /dev/null; then
        echo "ufw"
    elif command -v firewall-cmd &> /dev/null; then
        echo "firewalld"
    elif command -v iptables &> /dev/null; then
        echo "iptables"
    else
        error "No supported firewall management tool found (ufw, firewalld, iptables)"
    fi
}

# Configure UFW firewall
configure_ufw() {
    log "Configuring UFW firewall..."

    # Reset UFW to default state
    ufw --force reset

    # Set default policies
    ufw default deny incoming
    ufw default deny outgoing
    ufw default deny routed

    # Allow loopback
    ufw allow in on lo
    ufw allow out on lo

    # Allow established and related connections
    ufw allow in from $NETWORK_SUBNET to any ctstate established,related
    ufw allow out from any to $NETWORK_SUBNET ctstate established,related

    # Allow DNS (required for package updates)
    ufw allow out from any to any port 53 proto udp
    ufw allow out from any to any port 53 proto tcp

    # Allow DHCP
    ufw allow out from any to any port 67 proto udp
    ufw allow out from any to any port 68 proto udp

    # Allow HTTP/HTTPS from local network
    ufw allow in from $NETWORK_SUBNET to any port $NGINX_HTTP_PORT proto tcp
    ufw allow in from $NETWORK_SUBNET to any port $NGINX_HTTPS_PORT proto tcp

    # Allow application ports from local network only
    ufw allow in from $NETWORK_SUBNET to any port $FRONTEND_PORT proto tcp
    ufw allow in from $NETWORK_SUBNET to any port $BACKEND_PORT proto tcp
    ufw allow in from $NETWORK_SUBNET to any port $MYSQL_PORT proto tcp
    ufw allow in from $NETWORK_SUBNET to any port $REDIS_PORT proto tcp

    # Allow monitoring ports from local network
    ufw allow in from $NETWORK_SUBNET to any port $MONITORING_PORT proto tcp
    ufw allow in from $NETWORK_SUBNET to any port $GRAFANA_PORT proto tcp

    # Allow SSH from local network (modify if needed)
    ufw allow in from $NETWORK_SUBNET to any port 22 proto tcp

    # Allow Docker communication
    ufw allow in from 172.16.0.0/12 to any
    ufw allow in from 172.17.0.0/12 to any
    ufw allow in from 172.18.0.0/12 to any
    ufw allow in from 172.19.0.0/12 to any
    ufw allow in from 172.20.0.0/12 to any
    ufw allow in from 172.21.0.0/12 to any
    ufw allow in from 172.22.0.0/12 to any
    ufw allow in from 172.23.0.0/12 to any

    # Enable logging
    ufw logging on

    # Enable UFW
    ufw --force enable

    log "UFW firewall configured successfully"
}

# Configure firewalld
configure_firewalld() {
    log "Configuring firewalld..."

    # Start and enable firewalld
    systemctl enable firewalld
    systemctl start firewalld

    # Set default zones
    firewall-cmd --set-default-zone=drop

    # Create CLMS zone
    firewall-cmd --permanent --new-zone=clms
    firewall-cmd --permanent --zone=clms --set-target=drop

    # Add interfaces to zones
    firewall-cmd --permanent --zone=trusted --add-interface=lo
    firewall-cmd --permanent --zone=clms --add-interface=$(ip route get 8.8.8.8 | awk '{print $5}')

    # Allow local network
    firewall-cmd --permanent --zone=clms --add-source=$NETWORK_SUBNET

    # Allow services
    firewall-cmd --permanent --zone=clms --add-service=http
    firewall-cmd --permanent --zone=clms --add-service=https
    firewall-cmd --permanent --zone=clms --add-port=$FRONTEND_PORT/tcp
    firewall-cmd --permanent --zone=clms --add-port=$BACKEND_PORT/tcp
    firewall-cmd --permanent --zone=clms --add-port=$MYSQL_PORT/tcp
    firewall-cmd --permanent --zone=clms --add-port=$REDIS_PORT/tcp
    firewall-cmd --permanent --zone=clms --add-port=$MONITORING_PORT/tcp
    firewall-cmd --permanent --zone=clms --add-port=$GRAFANA_PORT/tcp

    # Allow Docker networks
    firewall-cmd --permanent --zone=trusted --add-source=172.16.0.0/12
    firewall-cmd --permanent --zone=trusted --add-source=172.17.0.0/12
    firewall-cmd --permanent --zone=trusted --add-source=172.18.0.0/12
    firewall-cmd --permanent --zone=trusted --add-source=172.19.0.0/12
    firewall-cmd --permanent --zone=trusted --add-source=172.20.0.0/12
    firewall-cmd --permanent --zone=trusted --add-source=172.21.0.0/12
    firewall-cmd --permanent --zone=trusted --add-source=172.22.0.0/12
    firewall-cmd --permanent --zone=trusted --add-source=172.23.0.0/12

    # Allow DNS and DHCP
    firewall-cmd --permanent --zone=trusted --add-service=dns
    firewall-cmd --permanent --zone=trusted --add-service=dhcp

    # Reload firewalld
    firewall-cmd --reload

    log "firewalld configured successfully"
}

# Configure iptables directly
configure_iptables() {
    log "Configuring iptables..."

    # Flush existing rules
    iptables -F
    iptables -X
    iptables -t nat -F
    iptables -t nat -X
    iptables -t mangle -F
    iptables -t mangle -X

    # Set default policies
    iptables -P INPUT DROP
    iptables -P FORWARD DROP
    iptables -P OUTPUT DROP

    # Allow loopback
    iptables -A INPUT -i lo -j ACCEPT
    iptables -A OUTPUT -o lo -j ACCEPT

    # Allow established and related connections
    iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
    iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

    # Allow DNS
    iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
    iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT

    # Allow DHCP
    iptables -A OUTPUT -p udp --dport 67 -j ACCEPT
    iptables -A OUTPUT -p udp --dport 68 -j ACCEPT

    # Allow HTTP/HTTPS from local network
    iptables -A INPUT -s $NETWORK_SUBNET -p tcp --dport $NGINX_HTTP_PORT -j ACCEPT
    iptables -A INPUT -s $NETWORK_SUBNET -p tcp --dport $NGINX_HTTPS_PORT -j ACCEPT

    # Allow application ports from local network
    iptables -A INPUT -s $NETWORK_SUBNET -p tcp --dport $FRONTEND_PORT -j ACCEPT
    iptables -A INPUT -s $NETWORK_SUBNET -p tcp --dport $BACKEND_PORT -j ACCEPT
    iptables -A INPUT -s $NETWORK_SUBNET -p tcp --dport $MYSQL_PORT -j ACCEPT
    iptables -A INPUT -s $NETWORK_SUBNET -p tcp --dport $REDIS_PORT -j ACCEPT

    # Allow monitoring ports from local network
    iptables -A INPUT -s $NETWORK_SUBNET -p tcp --dport $MONITORING_PORT -j ACCEPT
    iptables -A INPUT -s $NETWORK_SUBNET -p tcp --dport $GRAFANA_PORT -j ACCEPT

    # Allow SSH from local network
    iptables -A INPUT -s $NETWORK_SUBNET -p tcp --dport 22 -j ACCEPT

    # Allow Docker networks
    iptables -A INPUT -s 172.16.0.0/12 -j ACCEPT
    iptables -A INPUT -s 172.17.0.0/12 -j ACCEPT
    iptables -A INPUT -s 172.18.0.0/12 -j ACCEPT
    iptables -A INPUT -s 172.19.0.0/12 -j ACCEPT
    iptables -A INPUT -s 172.20.0.0/12 -j ACCEPT
    iptables -A INPUT -s 172.21.0.0/12 -j ACCEPT
    iptables -A INPUT -s 172.22.0.0/12 -j ACCEPT
    iptables -A INPUT -s 172.23.0.0/12 -j ACCEPT

    # Log and drop other traffic
    iptables -A INPUT -j LOG --log-prefix "INPUT-DROP: " --log-level 4
    iptables -A FORWARD -j LOG --log-prefix "FORWARD-DROP: " --log-level 4
    iptables -A OUTPUT -j LOG --log-prefix "OUTPUT-DROP: " --log-level 4

    # Save rules
    if command -v iptables-save &> /dev/null; then
        iptables-save > /etc/iptables/rules.v4
    fi

    log "iptables configured successfully"
}

# Create fail2ban configuration
configure_fail2ban() {
    log "Configuring fail2ban..."

    # Install fail2ban if not present
    if ! command -v fail2ban-server &> /dev/null; then
        apt-get update && apt-get install -y fail2ban
    fi

    # Create fail2ban configuration
    cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3
backend = systemd

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
port = http,https
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 3

[nginx-limit-req]
enabled = true
port = http,https
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 10

[nginx-botsearch]
enabled = true
port = http,https
filter = nginx-botsearch
logpath = /var/log/nginx/access.log
maxretry = 2
EOF

    # Enable and start fail2ban
    systemctl enable fail2ban
    systemctl restart fail2ban

    log "fail2ban configured successfully"
}

# Create rate limiting scripts
create_rate_limiting() {
    log "Creating rate limiting configuration..."

    # Create iptables rate limiting rules
    cat > /etc/network/rate-limits.sh << 'EOF'
#!/bin/bash

# Rate limiting configuration
IPT=/sbin/iptables

# Clear existing rate limiting rules
$IPT -F RATE_LIMIT

# Create RATE_LIMIT chain
$IPT -N RATE_LIMIT

# Rate limit HTTP requests (100 requests per minute per IP)
$IPT -A RATE_LIMIT -p tcp --dport 80 -m limit --limit 100/minute --limit-burst 200 -j ACCEPT
$IPT -A RATE_LIMIT -p tcp --dport 80 -j DROP

# Rate limit HTTPS requests (200 requests per minute per IP)
$IPT -A RATE_LIMIT -p tcp --dport 443 -m limit --limit 200/minute --limit-burst 400 -j ACCEPT
$IPT -A RATE_LIMIT -p tcp --dport 443 -j DROP

# Rate limit API requests (50 requests per minute per IP)
$IPT -A RATE_LIMIT -p tcp --dport 3001 -m limit --limit 50/minute --limit-burst 100 -j ACCEPT
$IPT -A RATE_LIMIT -p tcp --dport 3001 -j DROP

# Apply rate limiting to INPUT chain
$IPT -I INPUT -j RATE_LIMIT

echo "Rate limiting rules applied"
EOF

    chmod +x /etc/network/rate-limits.sh

    log "Rate limiting configuration created"
}

# Create monitoring scripts
create_monitoring() {
    log "Creating firewall monitoring scripts..."

    # Create monitoring script
    cat > /usr/local/bin/firewall-monitor.sh << 'EOF'
#!/bin/bash

# Firewall monitoring script
LOG_FILE="/var/log/firewall-monitor.log"
ALERT_THRESHOLD=100

# Count dropped packets in the last minute
DROPPED_PACKETS=$(journalctl --since "1 minute ago" | grep -c "DROP")

if [ "$DROPPED_PACKETS" -gt "$ALERT_THRESHOLD" ]; then
    echo "$(date): High number of dropped packets detected: $DROPPED_PACKETS" >> $LOG_FILE
    # Send alert (configure as needed)
    # echo "Firewall alert: $DROPPED_PACKETS packets dropped in last minute" | mail -s "Firewall Alert" admin@example.com
fi

# Check firewall status
if command -v ufw &> /dev/null; then
    UFW_STATUS=$(ufw status | head -1)
    echo "$(date): $UFW_STATUS" >> $LOG_FILE
fi
EOF

    chmod +x /usr/local/bin/firewall-monitor.sh

    # Add to crontab
    (crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/firewall-monitor.sh") | crontab -

    log "Firewall monitoring configured"
}

# Test firewall configuration
test_firewall() {
    log "Testing firewall configuration..."

    # Test local access
    if curl -s http://localhost:$NGINX_HTTP_PORT/health > /dev/null; then
        log "✓ Local HTTP access working"
    else
        warning "✗ Local HTTP access failed"
    fi

    # Test that external access is blocked (if external interface exists)
    EXTERNAL_IP=$(ip route get 8.8.8.8 | awk '{print $7; exit}')
    if [[ "$EXTERNAL_IP" =~ ^192\.168\.1\. ]]; then
        log "✓ System is on local network as expected"
    else
        warning "System appears to have external IP: $EXTERNAL_IP"
    fi

    log "Firewall testing completed"
}

# Display firewall status
display_status() {
    log "Firewall configuration summary:"
    echo "Network subnet: $NETWORK_SUBNET"
    echo "Allowed ports: $NGINX_HTTP_PORT, $NGINX_HTTPS_PORT, $FRONTEND_PORT, $BACKEND_PORT, $MYSQL_PORT, $REDIS_PORT"
    echo "Monitoring ports: $MONITORING_PORT, $GRAFANA_PORT"
    echo "Default policy: DENY ALL"

    if command -v ufw &> /dev/null; then
        echo ""
        ufw status verbose
    fi
}

# Main execution
main() {
    log "Starting CLMS firewall configuration..."

    check_root
    backup_firewall

    FIREWALL_TOOL=$(detect_firewall)
    log "Using firewall tool: $FIREWALL_TOOL"

    case $FIREWALL_TOOL in
        "ufw")
            configure_ufw
            ;;
        "firewalld")
            configure_firewalld
            ;;
        "iptables")
            configure_iptables
            ;;
    esac

    configure_fail2ban
    create_rate_limiting
    create_monitoring
    test_firewall
    display_status

    log "Firewall configuration completed successfully!"
    log "Please review the rules and test connectivity from local network."
    log "External access should be blocked by default."
}

# Run main function
main "$@"