#!/bin/bash

# ============================================================================
# CLMS VPN Configuration Script
# ============================================================================
# Purpose: Set up secure VPN for remote administration access
# Usage: sudo bash vpn-setup.sh [--install|--configure|--client|--test]
# Network: 192.168.1.0/24 local network + VPN subnet 10.8.0.0/24
# Features: WireGuard VPN, secure key management, access control
# ============================================================================

set -euo pipefail

# Configuration
VPN_INTERFACE="wg0"
VPN_PORT="51820"
VPN_SUBNET="10.8.0.0/24"
VPN_SERVER_IP="10.8.0.1"
VPN_DOMAIN="vpn.clms.local"
LOCAL_NETWORK="192.168.1.0/24"
DNS_SERVERS="1.1.1.1,8.8.8.8"
VPN_CONFIG_DIR="/etc/wireguard"
VPN_KEYS_DIR="/opt/clms/vpn/keys"
VPN_USERS_DIR="/opt/clms/vpn/users"
LOG_FILE="/var/log/vpn-setup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >> "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1" >> "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1" >> "$LOG_FILE"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root (use sudo)"
    fi
}

# Install WireGuard
install_wireguard() {
    log "Installing WireGuard..."

    # Update package list
    apt-get update

    # Install WireGuard and required packages
    apt-get install -y wireguard wireguard-tools qrencode iptables-persistent

    # Enable IP forwarding
    sed -i 's/#net.ipv4.ip_forward=1/net.ipv4.ip_forward=1/' /etc/sysctl.conf
    sysctl -p

    log "WireGuard installed successfully"
}

# Create VPN directories
create_directories() {
    log "Creating VPN directories..."

    mkdir -p "$VPN_CONFIG_DIR"
    mkdir -p "$VPN_KEYS_DIR"
    mkdir -p "$VPN_USERS_DIR"
    mkdir -p /opt/clms/backups/vpn

    # Set secure permissions
    chmod 700 "$VPN_KEYS_DIR"
    chmod 755 "$VPN_CONFIG_DIR"
    chmod 755 "$VPN_USERS_DIR"

    log "VPN directories created"
}

# Generate server keys
generate_server_keys() {
    log "Generating server keys..."

    # Generate private key
    wg genkey | tee "$VPN_KEYS_DIR/server_private.key" | wg pubkey > "$VPN_KEYS_DIR/server_public.key"

    # Set secure permissions
    chmod 600 "$VPN_KEYS_DIR/server_private.key"
    chmod 644 "$VPN_KEYS_DIR/server_public.key"

    log "Server keys generated"
}

# Create server configuration
create_server_config() {
    log "Creating server configuration..."

    # Read server private key
    SERVER_PRIVATE_KEY=$(cat "$VPN_KEYS_DIR/server_private.key")

    # Create server configuration
    cat > "$VPN_CONFIG_DIR/$VPN_INTERFACE.conf" << EOF
# ============================================================================
# CLMS WireGuard Server Configuration
# ============================================================================
# Purpose: Secure VPN access for remote administration
# Network: $VPN_SUBNET
# Port: $VPN_PORT/UDP
# ============================================================================

[Interface]
Address = $VPN_SERVER_IP/24
ListenPort = $VPN_PORT
PrivateKey = $SERVER_PRIVATE_KEY

# DNS configuration for VPN clients
DNS = $DNS_SERVERS

# Enable connection tracking
Table = off
PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE; ip6tables -A FORWARD -i %i -j ACCEPT; ip6tables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE; ip6tables -D FORWARD -i %i -j ACCEPT; ip6tables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

# MTU configuration
MTU = 1420

# Keepalive interval
PersistentKeepalive = 25

# Client configurations will be added here
# Format:
# [Peer]
# PublicKey = <client_public_key>
# AllowedIPs = <client_vpn_ip>/32
# Comment = <client_description>

EOF

    # Set secure permissions
    chmod 600 "$VPN_CONFIG_DIR/$VPN_INTERFACE.conf"

    log "Server configuration created"
}

# Add VPN client
add_client() {
    local client_name=${1:-}
    local client_email=${2:-}

    if [[ -z "$client_name" ]]; then
        error "Client name is required. Usage: $0 --client <client_name> [email]"
    fi

    log "Adding VPN client: $client_name"

    # Check if client already exists
    if [[ -f "$VPN_USERS_DIR/${client_name}.conf" ]]; then
        error "Client $client_name already exists"
    fi

    # Generate client keys
    CLIENT_PRIVATE_KEY=$(wg genkey)
    CLIENT_PUBLIC_KEY=$(echo "$CLIENT_PRIVATE_KEY" | wg pubkey)

    # Assign client IP
    CLIENT_IP="10.8.0.$(( $(grep -c "AllowedIPs" "$VPN_CONFIG_DIR/$VPN_INTERFACE.conf") + 2 ))"

    # Save client private key
    echo "$CLIENT_PRIVATE_KEY" > "$VPN_KEYS_DIR/${client_name}_private.key"
    chmod 600 "$VPN_KEYS_DIR/${client_name}_private.key"

    # Add client to server configuration
    cat >> "$VPN_CONFIG_DIR/$VPN_INTERFACE.conf" << EOF

[Peer]
# Client: $client_name
# Email: $client_email
# Created: $(date)
PublicKey = $CLIENT_PUBLIC_KEY
AllowedIPs = $CLIENT_IP/32
Comment = $client_name

EOF

    # Create client configuration
    cat > "$VPN_USERS_DIR/${client_name}.conf" << EOF
# ============================================================================
# CLMS VPN Client Configuration
# ============================================================================
# Client: $client_name
# Email: $client_email
# Created: $(date)
# Server: $VPN_DOMAIN:$VPN_PORT
# ============================================================================

[Interface]
PrivateKey = $CLIENT_PRIVATE_KEY
Address = $CLIENT_IP/24
DNS = $DNS_SERVERS

[Peer]
# CLMS VPN Server
PublicKey = $(cat "$VPN_KEYS_DIR/server_public.key")
AllowedIPs = $VPN_SUBNET, $LOCAL_NETWORK, 0.0.0.0/0
Endpoint = $VPN_DOMAIN:$VPN_PORT

# Keepalive for NAT traversal
PersistentKeepalive = 25

EOF

    # Set secure permissions
    chmod 600 "$VPN_USERS_DIR/${client_name}.conf"

    # Generate QR code for mobile clients
    qrencode -t PNG -o "$VPN_USERS_DIR/${client_name}.png" < "$VPN_USERS_DIR/${client_name}.conf"

    log "Client $client_name added successfully"
    log "Client IP: $CLIENT_IP"
    log "Config file: $VPN_USERS_DIR/${client_name}.conf"
    log "QR code: $VPN_USERS_DIR/${client_name}.png"

    # Restart WireGuard to apply changes
    systemctl restart wg-quick@$VPN_INTERFACE

    log "VPN server restarted with new client configuration"
}

# Remove VPN client
remove_client() {
    local client_name=${1:-}

    if [[ -z "$client_name" ]]; then
        error "Client name is required. Usage: $0 --remove-client <client_name>"
    fi

    log "Removing VPN client: $client_name"

    # Check if client exists
    if [[ ! -f "$VPN_USERS_DIR/${client_name}.conf" ]]; then
        error "Client $client_name does not exist"
    fi

    # Get client public key
    CLIENT_PUBLIC_KEY=$(echo "$CLIENT_PRIVATE_KEY" | wg pubkey)

    # Remove client from server configuration
    sed -i "/# Client: $client_name/,/^$/d" "$VPN_CONFIG_DIR/$VPN_INTERFACE.conf"

    # Remove client files
    rm -f "$VPN_USERS_DIR/${client_name}.conf"
    rm -f "$VPN_USERS_DIR/${client_name}.png"
    rm -f "$VPN_KEYS_DIR/${client_name}_private.key"

    log "Client $client_name removed successfully"

    # Restart WireGuard to apply changes
    systemctl restart wg-quick@$VPN_INTERFACE

    log "VPN server restarted"
}

# Configure firewall rules for VPN
configure_firewall() {
    log "Configuring firewall rules for VPN..."

    # Allow WireGuard port
    if command -v ufw &> /dev/null; then
        ufw allow $VPN_PORT/udp comment "WireGuard VPN"
        log "UFW firewall configured for WireGuard"
    elif command -v firewall-cmd &> /dev/null; then
        firewall-cmd --permanent --add-port=$VPN_PORT/udp
        firewall-cmd --reload
        log "firewalld configured for WireGuard"
    else
        # Configure iptables directly
        iptables -A INPUT -p udp --dport $VPN_PORT -j ACCEPT
        iptables -A INPUT -i $VPN_INTERFACE -j ACCEPT
        iptables -A FORWARD -i $VPN_INTERFACE -j ACCEPT
        log "iptables configured for WireGuard"
    fi

    log "Firewall rules configured"
}

# Start and enable WireGuard service
start_wireguard() {
    log "Starting WireGuard service..."

    # Enable and start WireGuard
    systemctl enable wg-quick@$VPN_INTERFACE
    systemctl start wg-quick@$VPN_INTERFACE

    # Check status
    if systemctl is-active --quiet wg-quick@$VPN_INTERFACE; then
        log "WireGuard service started successfully"
    else
        error "Failed to start WireGuard service"
    fi
}

# Test VPN connection
test_vpn() {
    log "Testing VPN configuration..."

    # Check if WireGuard is running
    if systemctl is-active --quiet wg-quick@$VPN_INTERFACE; then
        log "✓ WireGuard service is running"
    else
        error "✗ WireGuard service is not running"
    fi

    # Check if interface is up
    if ip link show $VPN_INTERFACE &> /dev/null; then
        log "✓ VPN interface $VPN_INTERFACE is up"
    else
        error "✗ VPN interface $VPN_INTERFACE is not found"
    fi

    # Check interface IP
    INTERFACE_IP=$(ip addr show $VPN_INTERFACE | grep "inet $VPN_SERVER_IP" | wc -l)
    if [[ $INTERFACE_IP -gt 0 ]]; then
        log "✓ VPN interface has correct IP: $VPN_SERVER_IP"
    else
        error "✗ VPN interface does not have correct IP"
    fi

    # Check listening port
    if netstat -uln | grep ":$VPN_PORT" &> /dev/null; then
        log "✓ WireGuard is listening on port $VPN_PORT/UDP"
    else
        error "✗ WireGuard is not listening on port $VPN_PORT/UDP"
    fi

    # Display connected clients
    CLIENT_COUNT=$(wg show $VPN_INTERFACE 2>/dev/null | grep -c "peer:" || echo "0")
    log "✓ Connected clients: $CLIENT_COUNT"

    if [[ $CLIENT_COUNT -gt 0 ]]; then
        wg show $VPN_INTERFACE
    fi

    log "VPN test completed"
}

# List VPN clients
list_clients() {
    log "Listing VPN clients..."

    if [[ ! -f "$VPN_CONFIG_DIR/$VPN_INTERFACE.conf" ]]; then
        error "VPN configuration not found"
    fi

    echo ""
    echo "VPN Clients:"
    echo "============"

    # Extract client information from configuration
    awk '/^# Client:/,/AllowedIPs/' "$VPN_CONFIG_DIR/$VPN_INTERFACE.conf" | while read -r line; do
        if [[ $line =~ ^#\ Client: ]]; then
            CLIENT_NAME=$(echo "$line" | sed 's/# Client: //')
            echo "Client: $CLIENT_NAME"
        elif [[ $line =~ ^#\ Email: ]]; then
            EMAIL=$(echo "$line" | sed 's/# Email: //')
            echo "Email: $EMAIL"
        elif [[ $line =~ ^#\ Created: ]]; then
            CREATED=$(echo "$line" | sed 's/# Created: //')
            echo "Created: $CREATED"
        elif [[ $line =~ ^AllowedIPs: ]]; then
            IP=$(echo "$line" | sed 's/AllowedIPs: \([^/]*\).*/\1/')
            echo "VPN IP: $IP"
            echo "---"
        fi
    done

    echo ""
    log "Total clients: $(grep -c "# Client:" "$VPN_CONFIG_DIR/$VPN_INTERFACE.conf")"
}

# Backup VPN configuration
backup_vpn() {
    log "Backing up VPN configuration..."

    BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_DIR="/opt/clms/backups/vpn/backup_$BACKUP_TIMESTAMP"

    mkdir -p "$BACKUP_DIR"

    # Backup configuration files
    cp -r "$VPN_CONFIG_DIR" "$BACKUP_DIR/"
    cp -r "$VPN_KEYS_DIR" "$BACKUP_DIR/"
    cp -r "$VPN_USERS_DIR" "$BACKUP_DIR/"

    # Create backup info file
    cat > "$BACKUP_DIR/backup_info.txt" << EOF
VPN Configuration Backup
=========================
Backup Date: $(date)
Backup Type: Full VPN Configuration
WireGuard Interface: $VPN_INTERFACE
VPN Subnet: $VPN_SUBNET
VPN Port: $VPN_PORT

Files included:
- wireguard/: Server configuration
- keys/: All keys (public and private)
- users/: Client configurations

Restore Instructions:
1. Stop WireGuard: systemctl stop wg-quick@$VPN_INTERFACE
2. Restore files: cp -r * /etc/wireguard/ and /opt/clms/vpn/
3. Set correct permissions
4. Start WireGuard: systemctl start wg-quick@$VPN_INTERFACE
EOF

    log "VPN configuration backed up to $BACKUP_DIR"
}

# Create VPN monitoring script
create_monitoring() {
    log "Creating VPN monitoring script..."

    cat > /usr/local/bin/vpn-monitor.sh << 'EOF'
#!/bin/bash

# VPN monitoring script
VPN_INTERFACE="wg0"
LOG_FILE="/var/log/vpn-monitor.log"

# Function to log with timestamp
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S'): $1" >> $LOG_FILE
}

# Check if WireGuard is running
if systemctl is-active --quiet wg-quick@$VPN_INTERFACE; then
    log_message "VPN service is running"

    # Get connection statistics
    PEER_COUNT=$(wg show $VPN_INTERFACE 2>/dev/null | grep -c "peer:" || echo "0")
    log_message "Connected peers: $PEER_COUNT"

    # Get data transfer statistics
    if command -v wg &> /dev/null; then
        wg show $VPN_INTERFACE transfer >> $LOG_FILE 2>&1
    fi
else
    log_message "ERROR: VPN service is not running"

    # Try to restart the service
    systemctl restart wg-quick@$VPN_INTERFACE

    if systemctl is-active --quiet wg-quick@$VPN_INTERFACE; then
        log_message "VPN service restarted successfully"
    else
        log_message "ERROR: Failed to restart VPN service"
        # Send alert (configure as needed)
        # echo "VPN service is down and failed to restart" | mail -s "VPN Service Alert" admin@example.com
    fi
fi

# Check if interface is up
if ip link show $VPN_INTERFACE &> /dev/null; then
    log_message "VPN interface $VPN_INTERFACE is up"
else
    log_message "ERROR: VPN interface $VPN_INTERFACE is down"
fi
EOF

    chmod +x /usr/local/bin/vpn-monitor.sh

    # Add to crontab (every 5 minutes)
    (crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/vpn-monitor.sh") | crontab -

    log "VPN monitoring configured"
}

# Display usage information
display_usage() {
    echo "CLMS VPN Setup Script"
    echo "====================="
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  install           Install WireGuard and configure VPN server"
    echo "  add-client NAME   Add a new VPN client"
    echo "  remove-client NAME Remove a VPN client"
    echo "  list              List all VPN clients"
    echo "  test              Test VPN configuration"
    echo "  backup            Backup VPN configuration"
    echo "  status            Show VPN status"
    echo "  help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 install"
    echo "  $0 add-client admin admin@clms.local"
    echo "  $0 list"
    echo "  $0 test"
}

# Show VPN status
show_status() {
    log "VPN Status:"
    echo "============"

    # Service status
    if systemctl is-active --quiet wg-quick@$VPN_INTERFACE; then
        echo "Service: Running"
    else
        echo "Service: Stopped"
    fi

    # Interface status
    if ip link show $VPN_INTERFACE &> /dev/null; then
        echo "Interface: Up"
        echo "IP Address: $(ip addr show $VPN_INTERFACE | grep "inet " | awk '{print $2}')"
    else
        echo "Interface: Down"
    fi

    # Connected peers
    if command -v wg &> /dev/null; then
        echo ""
        wg show $VPN_INTERFACE
    fi

    echo ""
    echo "Configuration files:"
    echo "  Server config: $VPN_CONFIG_DIR/$VPN_INTERFACE.conf"
    echo "  Client configs: $VPN_USERS_DIR/"
    echo "  Keys: $VPN_KEYS_DIR/"
}

# Main execution
main() {
    local action=${1:-help}

    case $action in
        "install")
            log "Starting VPN installation..."
            check_root
            install_wireguard
            create_directories
            generate_server_keys
            create_server_config
            configure_firewall
            start_wireguard
            create_monitoring
            test_vpn
            show_status
            log "VPN installation completed successfully!"
            ;;

        "add-client")
            check_root
            add_client "$2" "$3"
            ;;

        "remove-client")
            check_root
            remove_client "$2"
            ;;

        "list")
            list_clients
            ;;

        "test")
            test_vpn
            ;;

        "backup")
            check_root
            backup_vpn
            ;;

        "status")
            show_status
            ;;

        "help"|"-h"|"--help")
            display_usage
            ;;

        *)
            error "Unknown command: $action. Use '$0 help' for usage information."
            ;;
    esac
}

# Run main function
main "$@"