#!/bin/sh
# Nginx health check script

# Check if Nginx is running
if ! pgrep nginx > /dev/null; then
    echo "Nginx is not running"
    exit 1
fi

# Check if Nginx is listening on port 80
if ! netstat -tlnp | grep -q ":80 "; then
    echo "Nginx is not listening on port 80"
    exit 1
fi

# Check if Nginx is listening on port 443
if ! netstat -tlnp | grep -q ":443 "; then
    echo "Nginx is not listening on port 443"
    exit 1
fi

# Check if health endpoint is responding
curl -f http://localhost/health > /dev/null 2>&1 || exit 1

# Check upstream servers
curl -f http://localhost/api/health > /dev/null 2>&1 || exit 1

echo "Health check passed"
exit 0