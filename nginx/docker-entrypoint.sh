#!/bin/sh
# Nginx custom entrypoint script

set -e

# Function to create SSL certificates if they don't exist
create_ssl_certs() {
    if [ ! -f /etc/nginx/ssl/clms.crt ] || [ ! -f /etc/nginx/ssl/clms.key ]; then
        echo "Generating self-signed SSL certificate..."
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout /etc/nginx/ssl/clms.key \
            -out /etc/nginx/ssl/clms.crt \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=clms.local"
        echo "SSL certificate generated successfully"
    fi
}

# Function to create nginx configuration from environment variables
create_config() {
    # Replace placeholders with actual values
    if [ -n "$BACKEND_SERVERS" ]; then
        sed -i "s|server backend1:3001.*|$BACKEND_SERVERS|g" /etc/nginx/nginx.conf
    fi

    if [ -n "$FRONTEND_SERVERS" ]; then
        sed -i "s|server frontend1:3000.*|$FRONTEND_SERVERS|g" /etc/nginx/nginx.conf
    fi

    if [ -n "$SERVER_NAME" ]; then
        sed -i "s|server_name clms.local.*|server_name $SERVER_NAME;|g" /etc/nginx/nginx.conf
    fi
}

# Function to setup log rotation
setup_log_rotation() {
    cat > /etc/logrotate.d/nginx << EOF
/var/log/nginx/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 nginx nginx
    postrotate
        docker-compose exec nginx nginx -s reload
    endscript
}
EOF
}

# Function to tune kernel parameters
tune_kernel() {
    # Increase file descriptor limit
    ulimit -n 65535

    # Set kernel parameters for high performance
    sysctl -w net.core.somaxconn=65535
    sysctl -w net.ipv4.tcp_max_syn_backlog=65535
    sysctl -w net.core.netdev_max_backlog=5000
    sysctl -w net.ipv4.tcp_fin_timeout=15
    sysctl -w net.ipv4.tcp_keepalive_time=600
    sysctl -w net.ipv4.tcp_keepalive_probes=3
    sysctl -w net.ipv4.tcp_keepalive_intvl=15
}

# Function to validate configuration
validate_config() {
    echo "Validating Nginx configuration..."
    nginx -t
    if [ $? -ne 0 ]; then
        echo "Nginx configuration validation failed!"
        exit 1
    fi
    echo "Nginx configuration is valid"
}

# Function to start nginx in background
start_nginx() {
    echo "Starting Nginx..."
    nginx -g "daemon off;"
}

# Main execution
echo "Initializing Nginx load balancer..."

# Create SSL certificates
create_ssl_certs

# Create configuration from environment variables
create_config

# Setup log rotation
setup_log_rotation

# Tune kernel parameters
tune_kernel

# Validate configuration
validate_config

# Start Nginx
start_nginx