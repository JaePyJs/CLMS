# CLMS Production Deployment Guide

## Overview

This comprehensive guide covers the complete production deployment process for the Comprehensive Library Management System (CLMS). It includes infrastructure setup, application deployment, monitoring, security, and maintenance procedures.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Application Deployment](#application-deployment)
4. [Security Configuration](#security-configuration)
5. [Monitoring and Logging](#monitoring-and-logging)
6. [Backup and Recovery](#backup-and-recovery)
7. [Maintenance Procedures](#maintenance-procedures)
8. [Troubleshooting](#troubleshooting)
9. [Performance Optimization](#performance-optimization)
10. [Disaster Recovery](#disaster-recovery)

## Prerequisites

### System Requirements

#### Hardware Requirements
- **Minimum**: 4 CPU cores, 16GB RAM, 200GB SSD
- **Recommended**: 8 CPU cores, 32GB RAM, 500GB SSD
- **Database**: 8 CPU cores, 16GB RAM, 500GB SSD (dedicated)
- **Monitoring**: 2 CPU cores, 4GB RAM, 100GB SSD

#### Software Requirements
- **Operating System**: Ubuntu 22.04 LTS or Amazon Linux 2
- **Docker**: 20.10 or later
- **Docker Compose**: 2.0 or later
- **Node.js**: 20.x or later
- **Terraform**: 1.5 or later
- **AWS CLI**: 2.0 or later

#### Network Requirements
- **Internet Connection**: 100 Mbps minimum
- **Ports Required**: 80, 443, 22 (SSH)
- **SSL Certificate**: Valid certificate for domain
- **DNS**: Proper domain configuration

### Access Requirements

#### AWS Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:*",
        "rds:*",
        "ecs:*",
        "elasticache:*",
        "s3:*",
        "iam:*",
        "route53:*",
        "acm:*",
        "cloudwatch:*",
        "logs:*",
        "secretsmanager:*"
      ],
      "Resource": "*"
    }
  ]
}
```

#### GitHub Repository Access
- **Admin Access**: Full repository permissions
- **Secrets Access**: Ability to manage GitHub secrets
- **Actions Access**: Ability to trigger workflows

### Required Secrets

#### GitHub Secrets
```bash
# AWS Credentials
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key

# Database Credentials
DB_USERNAME=clms_admin
DB_PASSWORD=your_secure_db_password

# SSL Configuration
DOMAIN_NAME=your-domain.com
OWNER_EMAIL=admin@your-domain.com
NOTIFICATION_EMAIL=admin@your-domain.com

# Security
SSH_ALLOWED_IPS=["203.0.113.0/24", "198.51.100.0/24"]

# Communication
SLACK_WEBHOOK=your_slack_webhook_url
EMAIL_USERNAME=your_email@gmail.com
EMAIL_PASSWORD=your_email_password
```

#### Environment Files
```bash
# Backend/.env.production
NODE_ENV=production
DATABASE_URL=mysql://clms_user:password@mysql-primary:3306/clms_database
REDIS_HOST=redis-primary
REDIS_PORT=6379
JWT_SECRET=your_jwt_secret_key
CORS_ORIGIN=https://your-domain.com
```

## Infrastructure Setup

### 1. AWS Infrastructure Deployment

#### Initialize Terraform
```bash
cd infrastructure/terraform
terraform init
```

#### Plan Infrastructure
```bash
terraform plan \
  -var="owner_email=admin@your-domain.com" \
  -var="domain_name=your-domain.com" \
  -var="notification_email=admin@your-domain.com"
```

#### Apply Infrastructure
```bash
terraform apply \
  -var="owner_email=admin@your-domain.com" \
  -var="domain_name=your-domain.com" \
  -var="notification_email=admin@your-domain.com"
```

### 2. DNS Configuration

#### Configure DNS Records
```bash
# A Records
your-domain.com.      A    ALB_IP_ADDRESS
*.your-domain.com.    A    ALB_IP_ADDRESS

# CNAME Records
api.your-domain.com.  CNAME your-domain.com.
ws.your-domain.com.   CNAME your-domain.com.

# MX Records
your-domain.com.      MX   10 mail.your-domain.com.
```

#### Verify DNS Propagation
```bash
nslookup your-domain.com
dig your-domain.com
```

### 3. SSL Certificate Setup

#### Request SSL Certificate
```bash
# Using Certbot
certbot certonly --webroot -w /var/www/html -d your-domain.com -d *.your-domain.com

# Or use AWS ACM
aws acm request-certificate \
  --domain-name your-domain.com \
  --subject-alternative-names *.your-domain.com \
  --validation-method DNS
```

#### Install SSL Certificate
```bash
# Copy certificates to Nginx
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /etc/nginx/ssl/
cp /etc/letsencrypt/live/your-domain.com/privkey.pem /etc/nginx/ssl/

# Set proper permissions
chmod 600 /etc/nginx/ssl/privkey.pem
chmod 644 /etc/nginx/ssl/fullchain.pem
```

### 4. Container Registry Setup

#### Login to ECR
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-east-1.amazonaws.com
```

#### Create Repositories
```bash
aws ecr create-repository --repository-name clms-backend --image-scanning-configuration scanOnPush=true
aws ecr create-repository --repository-name clms-frontend --image-scanning-configuration scanOnPush=true
```

## Application Deployment

### 1. Build and Push Images

#### Backend Image
```bash
cd Backend

# Build production image
docker build -f Dockerfile.prod -t clms-backend:latest .

# Tag for ECR
docker tag clms-backend:latest $(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-east-1.amazonaws.com/clms-backend:latest

# Push to ECR
docker push $(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-east-1.amazonaws.com/clms-backend:latest
```

#### Frontend Image
```bash
cd Frontend

# Build production image
docker build -t clms-frontend:latest .

# Tag for ECR
docker tag clms-frontend:latest $(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-east-1.amazonaws.com/clms-frontend:latest

# Push to ECR
docker push $(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-east-1.amazonaws.com/clms-frontend:latest
```

### 2. Deploy Application

#### Update Docker Compose File
```bash
# Update image references in docker-compose.prod.yml
sed -i 's|clms-backend:latest|$(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-east-1.amazonaws.com/clms-backend:latest|g' docker-compose.prod.yml
sed -i 's|clms-frontend:latest|$(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-east-1.amazonaws.com/clms-frontend:latest|g' docker-compose.prod.yml
```

#### Deploy Services
```bash
# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Deploy services
docker-compose -f docker-compose.prod.yml up -d

# Check service status
docker-compose -f docker-compose.prod.yml ps
```

### 3. Database Setup

#### Initialize Database
```bash
# Generate Prisma client
docker-compose -f docker-compose.prod.yml exec backend npm run db:generate

# Run database migrations
docker-compose -f docker-compose.prod.yml exec backend npm run db:migrate

# Seed initial data (optional)
docker-compose -f docker-compose.prod.yml exec backend npm run db:seed
```

#### Verify Database Connection
```bash
# Test database connectivity
docker-compose -f docker-compose.prod.yml exec backend npm run db:studio

# Check database logs
docker-compose -f docker-compose.prod.yml logs mysql
```

### 4. Configuration Validation

#### Validate Environment Variables
```bash
# Check backend environment
docker-compose -f docker-compose.prod.yml exec backend env | grep -E "(DATABASE_URL|REDIS_HOST|JWT_SECRET)"

# Check frontend environment
docker-compose -f docker-compose.prod.yml exec frontend env | grep -E "(VITE_API_URL|VITE_WS_URL)"
```

#### Test Health Endpoints
```bash
# Backend health check
curl -f http://localhost:3001/health

# Frontend health check
curl -f http://localhost:3000/health

# Database health check
curl -f http://localhost:3001/api/health/database
```

## Security Configuration

### 1. Network Security

#### Configure Security Groups
```bash
# Web server security group
aws ec2 create-security-group \
  --group-name clms-web-sg \
  --description "Security group for CLMS web servers"

# Authorize HTTP/HTTPS access
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxxx \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxxx \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

# Authorize SSH access (restricted)
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxxx \
  --protocol tcp \
  --port 22 \
  --cidr 203.0.113.0/24
```

#### Configure Nginx Security
```nginx
# Add to nginx.conf
server {
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Hide server version
    server_tokens off;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=20r/s;
}
```

### 2. Application Security

#### Environment Variables Security
```bash
# Use Docker secrets for sensitive data
echo "your_jwt_secret" | docker secret create jwt_secret -
echo "your_db_password" | docker secret create db_password -
```

#### Database Security
```sql
-- Create application user with limited privileges
CREATE USER 'clms_app'@'%' IDENTIFIED BY 'secure_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON clms_database.* TO 'clms_app'@'%';
FLUSH PRIVILEGES;
```

### 3. Access Control

#### SSH Configuration
```bash
# /etc/ssh/sshd_config
PasswordAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
```

#### Application Access Control
```bash
# Create application user
useradd -m -s /bin/bash clms
usermod -aG docker clms

# Set proper permissions
chown -R clms:clms /opt/clms
chmod 755 /opt/clms
```

## Monitoring and Logging

### 1. Prometheus Setup

#### Configure Prometheus
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'clms-backend'
    static_configs:
      - targets: ['backend:3001']
    metrics_path: '/metrics'
```

#### Start Prometheus
```bash
docker-compose -f docker-compose.prod.yml up -d prometheus
```

### 2. Grafana Dashboard

#### Import CLMS Dashboard
```bash
# Download CLMS dashboard JSON
curl -o clms-dashboard.json https://raw.githubusercontent.com/your-repo/clms-dashboard.json

# Import to Grafana
curl -X POST \
  -H "Authorization: Bearer $GRAFANA_API_KEY" \
  -H "Content-Type: application/json" \
  -d @clms-dashboard.json \
  http://localhost:3000/api/dashboards/db
```

### 3. Log Aggregation

#### Configure ELK Stack
```yaml
# docker-compose.elk.yml
version: '3.8'
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"

  logstash:
    image: docker.elastic.co/logstash/logstash:8.11.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf

  kibana:
    image: docker.elastic.co/kibana/kibana:8.11.0
    ports:
      - "5601:5601"
```

### 4. Alert Configuration

#### Configure AlertManager
```yaml
# alertmanager.yml
global:
  smtp_smarthost: 'localhost:587'
  smtp_from: 'alerts@your-domain.com'

route:
  receiver: 'web.hook'

receivers:
  - name: 'web.hook'
    slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#alerts'
```

## Backup and Recovery

### 1. Automated Backups

#### Database Backups
```bash
#!/bin/bash
# backup-database.sh

BACKUP_DIR="/opt/clms/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="clms_database_$TIMESTAMP.sql.gz"

# Create backup
docker-compose exec -T mysql mysqldump \
  -u root -p$MYSQL_ROOT_PASSWORD \
  --single-transaction \
  --routines \
  --triggers \
  clms_database | gzip > $BACKUP_DIR/$BACKUP_FILE

# Upload to S3
aws s3 cp $BACKUP_DIR/$BACKUP_FILE s3://clms-backups/database/

# Clean old backups (keep 30 days)
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

#### File Backups
```bash
#!/bin/bash
# backup-files.sh

BACKUP_DIR="/opt/clms/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="clms_files_$TIMESTAMP.tar.gz"

# Create backup
tar -czf $BACKUP_DIR/$BACKUP_FILE \
  /opt/clms/uploads \
  /opt/clms/generated \
  /opt/clms/config

# Upload to S3
aws s3 cp $BACKUP_DIR/$BACKUP_FILE s3://clms-backups/files/
```

### 2. Recovery Procedures

#### Database Recovery
```bash
#!/bin/bash
# restore-database.sh

BACKUP_FILE=$1

# Stop application
docker-compose stop backend

# Restore database
gunzip -c $BACKUP_FILE | docker-compose exec -T mysql mysql -u root -p$MYSQL_ROOT_PASSWORD clms_database

# Start application
docker-compose start backend
```

#### File Recovery
```bash
#!/bin/bash
# restore-files.sh

BACKUP_FILE=$1

# Extract backup
tar -xzf $BACKUP_FILE -C /

# Set permissions
chown -R clms:clms /opt/clms/uploads
chown -R clms:clms /opt/clms/generated
```

## Maintenance Procedures

### 1. Regular Maintenance Tasks

#### Daily Tasks
```bash
#!/bin/bash
# daily-maintenance.sh

# Check system health
./scripts/health-check.sh

# Rotate logs
logrotate /etc/logrotate.d/clms

# Clean temporary files
find /tmp -name "clms-*" -mtime +1 -delete
```

#### Weekly Tasks
```bash
#!/bin/bash
# weekly-maintenance.sh

# Update packages
apt update && apt upgrade -y

# Optimize database
docker-compose exec mysql mysql -u root -p$MYSQL_ROOT_PASSWORD -e "OPTIMIZE TABLE clms_database.students, clms_database.books, clms_database.equipment;"

# Check disk usage
df -h

# Restart services if needed
docker-compose restart
```

#### Monthly Tasks
```bash
#!/bin/bash
# monthly-maintenance.sh

# Security updates
apt update && apt upgrade -y

# Update Docker images
docker-compose pull

# Review and clean logs
find /var/log -name "*.log" -mtime +30 -delete

# Check backup integrity
./scripts/verify-backups.sh
```

### 2. Performance Monitoring

#### System Metrics
```bash
# Check CPU usage
top -bn1 | grep "Cpu(s)"

# Check memory usage
free -h

# Check disk usage
df -h

# Check network connections
netstat -tuln
```

#### Application Metrics
```bash
# Check application response time
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3001/health

# Check database performance
docker-compose exec mysql mysql -u root -p$MYSQL_ROOT_PASSWORD -e "SHOW PROCESSLIST;"

# Check Redis performance
docker-compose exec redis redis-cli info stats
```

## Troubleshooting

### 1. Common Issues

#### Service Not Starting
```bash
# Check service status
docker-compose ps

# Check service logs
docker-compose logs backend

# Check resource usage
docker stats

# Restart service
docker-compose restart backend
```

#### Database Connection Issues
```bash
# Check database status
docker-compose exec mysql mysqladmin ping

# Check database logs
docker-compose logs mysql

# Test connection
docker-compose exec backend npm run db:studio
```

#### Performance Issues
```bash
# Check system resources
htop
iotop

# Check application metrics
curl http://localhost:3001/metrics

# Check database queries
docker-compose exec mysql mysql -u root -p$MYSQL_ROOT_PASSWORD -e "SHOW FULL PROCESSLIST;"
```

### 2. Debugging Procedures

#### Enable Debug Logging
```bash
# Update environment variables
echo "LOG_LEVEL=debug" >> .env.production

# Restart service
docker-compose restart backend

# Check logs
docker-compose logs -f backend
```

#### Network Debugging
```bash
# Check network connectivity
docker network ls
docker network inspect clms_clms-network

# Test port connectivity
nc -zv localhost 3001
telnet localhost 3001
```

#### Database Debugging
```bash
# Connect to database
docker-compose exec mysql mysql -u root -p$MYSQL_ROOT_PASSWORD

# Check database status
SHOW STATUS;
SHOW VARIABLES;

# Check slow queries
SHOW VARIABLES LIKE 'slow_query_log';
```

## Performance Optimization

### 1. Application Optimization

#### Backend Optimization
```bash
# Enable caching
redis-cli CONFIG SET maxmemory 256mb
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Optimize database queries
docker-compose exec mysql mysql -u root -p$MYSQL_ROOT_PASSWORD -e "ANALYZE TABLE clms_database.students;"

# Enable compression
echo "COMPRESSION_ENABLED=true" >> .env.production
```

#### Frontend Optimization
```bash
# Enable gzip compression
# Update nginx.conf to include gzip settings

# Optimize static assets
# Configure CDN for static files

# Enable browser caching
# Update nginx.conf with cache headers
```

### 2. Database Optimization

#### MySQL Configuration
```ini
# /etc/mysql/conf.d/production.cnf
[mysqld]
innodb_buffer_pool_size = 1G
innodb_log_file_size = 256M
max_connections = 200
query_cache_size = 64M
```

#### Query Optimization
```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_students_grade ON students(grade);
CREATE INDEX idx_books_status ON books(status);

-- Analyze query performance
EXPLAIN SELECT * FROM students WHERE grade = 'GRADE_10';
```

### 3. Infrastructure Optimization

#### Auto-scaling Configuration
```yaml
# docker-compose.prod.yml
services:
  backend:
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
```

#### Load Balancing
```nginx
# nginx.conf
upstream backend {
    server backend1:3001;
    server backend2:3001;
}

server {
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Disaster Recovery

### 1. Backup Strategy

#### 3-2-1 Backup Rule
- **3 copies** of data (1 primary, 2 backups)
- **2 different media** types (local disk, cloud storage)
- **1 off-site** backup (different geographical location)

#### Backup Types
- **Full Backups**: Weekly complete system backup
- **Incremental Backups**: Daily changes since last backup
- **Differential Backups**: Changes since last full backup

### 2. Recovery Procedures

#### Partial Recovery
```bash
# Recover specific service
docker-compose up -d backend

# Recover from recent backup
./scripts/restore-database.sh /opt/clms/backups/latest.sql.gz
```

#### Full Recovery
```bash
# Stop all services
docker-compose down

# Recover infrastructure
cd infrastructure/terraform
terraform apply

# Recover application
docker-compose up -d

# Recover data
./scripts/restore-full.sh /opt/clms/backups/clms_full_backup_YYYYMMDD_HHMMSS.tar.gz
```

### 3. Testing Recovery Procedures

#### Regular Testing
```bash
# Monthly disaster recovery test
./scripts/disaster-recovery-test.sh

# Annual full-scale test
./scripts/full-disaster-recovery-test.sh
```

#### Validation Checklist
- [ ] All services start successfully
- [ ] Database connectivity is working
- [ ] User authentication is working
- [ ] Data integrity is verified
- [ ] Performance is acceptable
- [ ] Monitoring is operational

## Appendix

### A. Quick Reference Commands

```bash
# Start services
docker-compose -f docker-compose.prod.yml up -d

# Stop services
docker-compose -f docker-compose.prod.yml down

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Check service status
docker-compose -f docker-compose.prod.yml ps

# Scale services
docker-compose -f docker-compose.prod.yml up -d --scale backend=3

# Update services
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d

# Backup database
./scripts/backup-database.sh

# Restore database
./scripts/restore-database.sh backup_file.sql.gz

# Health check
curl -f http://localhost:3001/health

# Rollback deployment
./scripts/rollback-procedures.sh rollback-to-last
```

### B. Configuration Templates

#### Environment Variables Template
```bash
# .env.production.template
NODE_ENV=production
DATABASE_URL=mysql://clms_user:password@mysql-primary:3306/clms_database
REDIS_HOST=redis-primary
REDIS_PORT=6379
JWT_SECRET=your_jwt_secret_here
CORS_ORIGIN=https://your-domain.com
LOG_LEVEL=info
```

#### Nginx Configuration Template
```nginx
# nginx.conf.template
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://frontend:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ {
        proxy_pass http://backend:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### C. Monitoring Dashboards

#### System Health Dashboard
- CPU usage
- Memory usage
- Disk usage
- Network traffic
- Service status

#### Application Performance Dashboard
- Response time
- Error rate
- Request rate
- Database performance
- Cache hit rate

#### Business Metrics Dashboard
- Active users
- Books checked out
- New registrations
- System usage patterns

### D. Contact Information

#### Emergency Contacts
- **On-call Engineer**: [Phone] | [Email]
- **Engineering Manager**: [Phone] | [Email]
- **System Administrator**: [Phone] | [Email]
- **Database Administrator**: [Phone] | [Email]

#### Service Providers
- **AWS Support**: [Contact Information]
- **Domain Registrar**: [Contact Information]
- **SSL Provider**: [Contact Information]

---

**Document Version**: 1.0
**Last Updated**: [Date]
**Next Review**: [Date]
**Approved By**: [Name/Title]

This deployment guide provides comprehensive instructions for deploying, maintaining, and operating the CLMS in a production environment. Regular reviews and updates are essential to ensure it remains current with system changes and best practices.