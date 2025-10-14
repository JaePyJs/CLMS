#!/bin/bash

# ============================================================================
# CLMS Security Testing Script
# ============================================================================
# Purpose: Comprehensive security testing and validation
# Usage: sudo bash security-test.sh [--full|--quick|--external|--internal]
# Network: 192.168.1.0/24 security validation
# Features: Port scanning, SSL testing, firewall validation, vulnerability checks
# ============================================================================

set -euo pipefail

# Configuration
TEST_DOMAIN="clms.local"
TEST_IP="192.168.1.100"
EXTERNAL_IP=$(curl -s ifconfig.me || echo "unknown")
LOG_FILE="/var/log/security-test.log"
REPORT_FILE="/opt/clms/security-report-$(date +%Y%m%d_%H%M%S).txt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0

# Logging function
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >> "$LOG_FILE"
    ((FAILED_TESTS++))
}

warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1" >> "$LOG_FILE"
    ((WARNINGS++))
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1" >> "$LOG_FILE"
}

# Test function
test_result() {
    local test_name="$1"
    local expected="$2"
    local actual="$3"

    ((TOTAL_TESTS++))

    if [[ "$actual" == "$expected" ]]; then
        log "✓ PASS: $test_name"
        ((PASSED_TESTS++))
        return 0
    else
        error "✗ FAIL: $test_name (Expected: $expected, Actual: $actual)"
        return 1
    fi
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root (use sudo)"
    fi
}

# Install required tools
install_tools() {
    log "Installing security testing tools..."

    # Update package list
    apt-get update

    # Install security testing tools
    apt-get install -y nmap openssl curl netcat-openbsd whois

    log "Security testing tools installed"
}

# Test firewall configuration
test_firewall() {
    log "Testing firewall configuration..."

    # Check if UFW is running
    if command -v ufw &> /dev/null; then
        local ufw_status=$(ufw status | head -1)
        test_result "UFW Status" "active" "$(echo $ufw_status | grep -o 'Status: active' | cut -d' ' -f2)"
    fi

    # Test open ports from local network
    log "Testing open ports from local network..."

    local allowed_ports=("80" "443" "3000" "3001" "3308" "6379" "51820")

    for port in "${allowed_ports[@]}"; do
        if timeout 5 bash -c "echo > /dev/tcp/localhost/$port" 2>/dev/null; then
            log "✓ Port $port is accessible (expected)"
            ((PASSED_TESTS++))
        else
            warning "Port $port is not accessible"
        fi
        ((TOTAL_TESTS++))
    done

    # Test blocked ports
    local blocked_ports=("22" "21" "23" "25" "53" "110" "143" "993" "995")

    for port in "${blocked_ports[@]}"; do
        if timeout 5 bash -c "echo > /dev/tcp/localhost/$port" 2>/dev/null; then
            warning "Port $port is accessible (should be blocked)"
            ((WARNINGS++))
        else
            log "✓ Port $port is blocked (expected)"
            ((PASSED_TESTS++))
        fi
        ((TOTAL_TESTS++))
    done

    # Test external access
    log "Testing external access blocking..."

    if [[ "$EXTERNAL_IP" != "unknown" && "$EXTERNAL_IP" =~ ^(192\.168\.|10\.|172\.) ]]; then
        log "System appears to be on private network (IP: $EXTERNAL_IP)"
    else
        warning "System has external IP: $EXTERNAL_IP - verify firewall is blocking external access"
    fi
}

# Test SSL/TLS configuration
test_ssl() {
    log "Testing SSL/TLS configuration..."

    # Check if SSL certificates exist
    if [[ -f "/etc/nginx/ssl/clms.crt" ]]; then
        test_result "SSL Certificate Exists" "exists" "exists"

        # Check certificate validity
        local cert_end_date=$(openssl x509 -in /etc/nginx/ssl/clms.crt -noout -enddate | cut -d= -f2)
        local cert_timestamp=$(date -d "$cert_end_date" +%s)
        local current_timestamp=$(date +%s)
        local days_until_expiry=$(( (cert_timestamp - current_timestamp) / 86400 ))

        if [[ $days_until_expiry -gt 30 ]]; then
            log "✓ SSL certificate valid for $days_until_expiry days"
            ((PASSED_TESTS++))
        else
            warning "SSL certificate expires in $days_until_expiry days"
            ((WARNINGS++))
        fi
        ((TOTAL_TESTS++))

        # Check certificate key size
        local key_size=$(openssl rsa -in /etc/nginx/ssl/clms.key -noout -text | grep "Private-Key" | grep -o '[0-9]*' | head -1)
        if [[ $key_size -ge 2048 ]]; then
            test_result "SSL Key Size" "2048+" "$key_size"
        else
            error "SSL key size too small: $key_size bits"
        fi

        # Test SSL configuration
        if openssl s_client -connect localhost:443 -servername "$TEST_DOMAIN" < /dev/null > /dev/null 2>&1; then
            test_result "SSL Connection" "success" "success"
        else
            error "SSL connection failed"
        fi

        # Check DH parameters
        if [[ -f "/etc/nginx/ssl/dhparam.pem" ]]; then
            test_result "DH Parameters" "exists" "exists"
        else
            warning "DH parameters not found"
        fi
    else
        error "SSL certificate not found"
    fi

    # Test SSL protocols and ciphers
    log "Testing SSL protocols and ciphers..."

    # Test TLS 1.2 support
    if openssl s_client -connect localhost:443 -tls1_2 < /dev/null > /dev/null 2>&1; then
        test_result "TLS 1.2 Support" "enabled" "enabled"
    else
        error "TLS 1.2 not supported"
    fi

    # Test TLS 1.3 support
    if openssl s_client -connect localhost:443 -tls1_3 < /dev/null > /dev/null 2>&1; then
        test_result "TLS 1.3 Support" "enabled" "enabled"
    else
        warning "TLS 1.3 not supported"
    fi

    # Test deprecated protocols
    if ! openssl s_client -connect localhost:443 -tls1 < /dev/null > /dev/null 2>&1; then
        test_result "TLS 1.0 Disabled" "disabled" "disabled"
    else
        error "TLS 1.0 is enabled (should be disabled)"
    fi

    if ! openssl s_client -connect localhost:443 -ssl3 < /dev/null > /dev/null 2>&1; then
        test_result "SSLv3 Disabled" "disabled" "disabled"
    else
        error "SSLv3 is enabled (should be disabled)"
    fi
}

# Test web application security
test_web_security() {
    log "Testing web application security..."

    # Test HTTP to HTTPS redirect
    local http_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost 2>/dev/null || echo "000")
    if [[ "$http_response" == "301" || "$http_response" == "302" ]]; then
        test_result "HTTP to HTTPS Redirect" "redirect" "redirect"
    else
        error "HTTP to HTTPS redirect not working (HTTP $http_response)"
    fi

    # Test security headers
    log "Testing security headers..."

    # Get headers from HTTPS request
    local headers=$(curl -s -I https://localhost 2>/dev/null || echo "")

    # Check for security headers
    local security_headers=(
        "x-frame-options"
        "x-content-type-options"
        "x-xss-protection"
        "strict-transport-security"
        "content-security-policy"
    )

    for header in "${security_headers[@]}"; do
        if echo "$headers" | grep -qi "$header"; then
            log "✓ Security header $header present"
            ((PASSED_TESTS++))
        else
            warning "Security header $header missing"
            ((WARNINGS++))
        fi
        ((TOTAL_TESTS++))
    done

    # Test application endpoints
    local endpoints=(
        "https://localhost/"
        "https://localhost/health"
        "https://localhost/api/health"
    )

    for endpoint in "${endpoints[@]}"; do
        local response_code=$(curl -s -o /dev/null -w "%{http_code}" "$endpoint" 2>/dev/null || echo "000")
        if [[ "$response_code" =~ ^[23] ]]; then
            log "✓ Endpoint $endpoint accessible (HTTP $response_code)"
            ((PASSED_TESTS++))
        else
            error "Endpoint $endpoint not accessible (HTTP $response_code)"
        fi
        ((TOTAL_TESTS++))
    done
}

# Test network security
test_network_security() {
    log "Testing network security..."

    # Test port scanning protection
    log "Testing port scanning protection..."

    # Quick nmap scan
    if command -v nmap &> /dev/null; then
        local open_ports=$(nmap -p 1-1000 localhost 2>/dev/null | grep -c "open" || echo "0")
        if [[ $open_ports -le 10 ]]; then
            test_result "Open Ports Count" "10 or fewer" "$open_ports"
        else
            warning "Too many open ports: $open_ports"
        fi

        # Check for specific services
        local ssh_open=$(nmap -p 22 localhost 2>/dev/null | grep -c "open" || echo "0")
        if [[ $ssh_open -eq 1 ]]; then
            warning "SSH port 22 is open - ensure strong authentication"
        else
            log "✓ SSH port not exposed"
        fi
    fi

    # Test network isolation
    log "Testing network isolation..."

    # Check if Docker networks are isolated
    local frontend_network=$(docker network ls | grep -c "clms_frontend" || echo "0")
    local backend_network=$(docker network ls | grep -c "clms_backend" || echo "0")
    local monitoring_network=$(docker network ls | grep -c "clms_monitoring" || echo "0")

    if [[ $frontend_network -gt 0 && $backend_network -gt 0 && $monitoring_network -gt 0 ]]; then
        test_result "Docker Network Isolation" "configured" "configured"
    else
        error "Docker networks not properly isolated"
    fi
}

# Test container security
test_container_security() {
    log "Testing container security..."

    # Check if containers are running with non-root users
    log "Testing container user security..."

    local containers=("clms-nginx-prod" "clms-backend-prod" "clms-frontend-prod" "clms-mysql-prod" "clms-redis-prod")

    for container in "${containers[@]}"; do
        if docker ps --format "table {{.Names}}" | grep -q "$container"; then
            local user_id=$(docker exec "$container" id -u 2>/dev/null || echo "0")
            if [[ "$user_id" != "0" ]]; then
                log "✓ Container $container running as non-root user (UID: $user_id)"
                ((PASSED_TESTS++))
            else
                warning "Container $container running as root user"
                ((WARNINGS++))
            fi
            ((TOTAL_TESTS++))
        else
            warning "Container $container not running"
        fi
    done

    # Check container resource limits
    log "Testing container resource limits..."

    local nginx_memory=$(docker inspect clms-nginx-prod --format='{{.HostConfig.Memory}}' 2>/dev/null || echo "0")
    if [[ $nginx_memory -gt 0 ]]; then
        test_result "Nginx Memory Limit" "set" "set"
    else
        warning "Nginx container has no memory limit"
    fi
}

# Test monitoring and logging
test_monitoring() {
    log "Testing monitoring and logging..."

    # Check if monitoring services are running
    local monitoring_services=("clms-prometheus" "clms-grafana")

    for service in "${monitoring_services[@]}"; do
        if docker ps --format "table {{.Names}}" | grep -q "$service"; then
            log "✓ Monitoring service $service is running"
            ((PASSED_TESTS++))
        else
            warning "Monitoring service $service not running"
            ((WARNINGS++))
        fi
        ((TOTAL_TESTS++))
    done

    # Check log files
    local log_files=(
        "/var/log/nginx/access.log"
        "/var/log/nginx/error.log"
        "/var/log/ssl-monitor.log"
        "/var/log/vpn-monitor.log"
    )

    for log_file in "${log_files[@]}"; do
        if [[ -f "$log_file" ]]; then
            test_result "Log File Exists: $(basename $log_file)" "exists" "exists"
        else
            warning "Log file missing: $log_file"
        fi
    done
}

# Test VPN configuration (if enabled)
test_vpn() {
    log "Testing VPN configuration..."

    # Check if WireGuard is installed and configured
    if command -v wg &> /dev/null; then
        if systemctl is-active --quiet wg-quick@wg0; then
            test_result "WireGuard Service" "running" "running"

            # Check VPN interface
            if ip link show wg0 &> /dev/null; then
                test_result "VPN Interface" "up" "up"
            else
                error "VPN interface not found"
            fi

            # Check VPN configuration
            local peer_count=$(wg show wg0 2>/dev/null | grep -c "peer:" || echo "0")
            log "VPN peers configured: $peer_count"

        else
            warning "WireGuard service not running"
        fi
    else
        info "WireGuard not installed - VPN not available"
    fi
}

# Generate security report
generate_report() {
    log "Generating security report..."

    {
        echo "CLMS Security Test Report"
        echo "========================"
        echo "Test Date: $(date)"
        echo "System: $(hostname)"
        echo "IP Address: $TEST_IP"
        echo "External IP: $EXTERNAL_IP"
        echo ""
        echo "Test Results:"
        echo "-------------"
        echo "Total Tests: $TOTAL_TESTS"
        echo "Passed: $PASSED_TESTS"
        echo "Failed: $FAILED_TESTS"
        echo "Warnings: $WARNINGS"
        echo ""
        echo "Success Rate: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%"
        echo ""
        echo "Detailed Results:"
        echo "----------------"
        tail -n 50 "$LOG_FILE"
    } > "$REPORT_FILE"

    log "Security report generated: $REPORT_FILE"

    # Display summary
    echo ""
    echo "=== SECURITY TEST SUMMARY ==="
    echo "Total Tests: $TOTAL_TESTS"
    echo "Passed: $PASSED_TESTS"
    echo "Failed: $FAILED_TESTS"
    echo "Warnings: $WARNINGS"
    echo "Success Rate: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%"
    echo ""
    echo "Full report: $REPORT_FILE"

    if [[ $FAILED_TESTS -gt 0 ]]; then
        echo "⚠️  CRITICAL: $FAILED_TESTS security tests failed!"
        exit 1
    elif [[ $WARNINGS -gt 0 ]]; then
        echo "⚠️  WARNING: $WARNINGS security warnings detected"
    else
        echo "✅ All security tests passed!"
    fi
}

# Main execution
main() {
    local test_type=${1:-full}

    echo "CLMS Security Testing Script"
    echo "============================"
    echo "Test Type: $test_type"
    echo "Target: $TEST_DOMAIN ($TEST_IP)"
    echo ""

    check_root

    case $test_type in
        "full")
            log "Running full security test suite..."
            install_tools
            test_firewall
            test_ssl
            test_web_security
            test_network_security
            test_container_security
            test_monitoring
            test_vpn
            ;;

        "quick")
            log "Running quick security tests..."
            test_firewall
            test_ssl
            test_web_security
            ;;

        "external")
            log "Running external security tests..."
            test_firewall
            test_ssl
            test_network_security
            ;;

        "internal")
            log "Running internal security tests..."
            test_container_security
            test_monitoring
            test_vpn
            ;;

        *)
            echo "Usage: $0 {full|quick|external|internal}"
            exit 1
            ;;
    esac

    generate_report
}

# Run main function
main "$@"