# CLMS Nginx Load Balancer Dockerfile
# Optimized for high-performance production deployment

FROM nginx:1.25-alpine

# Set environment variables
ENV NGINX_VERSION=1.25.3
ENV NJS_VERSION=0.8.2

# Install additional packages
RUN apk add --no-cache \
    curl \
    openssl \
    openssl-dev \
    pcre-dev \
    zlib-dev \
    linux-headers \
    gcc \
    musl-dev \
    make \
    && apk add --no-cache --repository http://dl-cdn.alpinelinux.org/alpine/edge/main \
    nginx-module-image-filter \
    nginx-module-geoip \
    nginx-module-perl \
    nginx-module-xslt

# Install additional Nginx modules
RUN apk add --no-cache \
    nginx-module-vts \
    nginx-module-sts \
    nginx-module-http-substitutions-filter

# Create directories
RUN mkdir -p /var/cache/nginx/api \
    && mkdir -p /var/cache/nginx/static \
    && mkdir -p /var/log/nginx \
    && mkdir -p /etc/nginx/ssl

# Copy custom configuration
COPY nginx.conf /etc/nginx/nginx.conf
COPY conf.d/ /etc/nginx/conf.d/
COPY ssl/ /etc/nginx/ssl/

# Create log directories with proper permissions
RUN touch /var/log/nginx/access.log \
    && touch /var/log/nginx/error.log \
    && chmod 644 /var/log/nginx/*.log

# Generate DH parameters for SSL
RUN openssl dhparam -out /etc/nginx/ssl/dhparam.pem 2048

# Set proper permissions
RUN chown -R nginx:nginx /var/cache/nginx \
    && chown -R nginx:nginx /var/log/nginx \
    && chown -R nginx:nginx /etc/nginx/ssl \
    && chmod 600 /etc/nginx/ssl/*.key

# Health check script
COPY healthcheck.sh /usr/local/bin/healthcheck.sh
RUN chmod +x /usr/local/bin/healthcheck.sh

# Copy custom entrypoint
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Performance tuning
RUN echo "net.core.somaxconn = 65535" >> /etc/sysctl.conf \
    && echo "net.ipv4.tcp_max_syn_backlog = 65535" >> /etc/sysctl.conf \
    && echo "net.core.netdev_max_backlog = 5000" >> /etc/sysctl.conf

# Expose ports
EXPOSE 80 443

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD /usr/local/bin/healthcheck.sh || exit 1

# Use custom entrypoint
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]