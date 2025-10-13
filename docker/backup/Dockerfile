# Backup service for CLMS
FROM alpine:latest

# Install required packages
RUN apk add --no-cache \
    mysql-client \
    curl \
    jq \
    aws-cli \
    bash \
    coreutils \
    gzip \
    openssl \
    tzdata

# Set timezone
ENV TZ=UTC

# Create backup user
RUN addgroup -g 1001 backup && \
    adduser -D -s /bin/bash -u 1001 -G backup backup

# Create directories
RUN mkdir -p /backups /scripts /logs && \
    chown -R backup:backup /backups /scripts /logs

# Copy scripts
COPY scripts/ /scripts/
RUN chmod +x /scripts/*.sh

# Switch to backup user
USER backup

# Set working directory
WORKDIR /backups

# Health check
HEALTHCHECK --interval=300s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Default command
CMD ["/scripts/backup-scheduler.sh"]