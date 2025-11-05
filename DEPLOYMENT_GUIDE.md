# CLMS Deployment Guide
**Production Deployment Instructions**

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Configuration](#database-configuration)
4. [Application Deployment](#application-deployment)
5. [Docker Deployment](#docker-deployment)
6. [Production Configuration](#production-configuration)
7. [Health Checks](#health-checks)
8. [Monitoring & Logging](#monitoring--logging)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

**Minimum:**
- CPU: 2 cores
- RAM: 4 GB
- Storage: 20 GB SSD
- Network: 1 Gbps

**Recommended:**
- CPU: 4+ cores
- RAM: 8+ GB
- Storage: 50+ GB SSD
- Network: 1+ Gbps

### Software Dependencies

```bash
# Required
- Node.js 18.x or higher
- npm 9.x or higher
- MySQL 8.0+
- Redis 7.x (optional, for caching)
- Docker 20.x+ (for containerized deployment)
- Docker Compose 2.x+
```

### Ports

**Backend Services:**
- 3001: Main API server
- 3306: MySQL database
- 6379: Redis cache
- 8080: Adminer (DB GUI)

**Frontend (if deployed separately):**
- 3000: React application

---

## Environment Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd CLMS
```

### 2. Install Dependencies

```bash
# Install all dependencies (root package.json)
npm install

# OR install individually
cd Backend && npm install
cd ../Frontend && npm install
```

### 3. Environment Variables

#### Backend Configuration

Create `Backend/.env`:

```bash
# Server Configuration
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Database Configuration
DATABASE_URL="mysql://username:password@localhost:3306/clms_database"

# JWT Configuration (CRITICAL: Use strong secrets!)
JWT_SECRET="your-32+ character secret key here-0123456789"
JWT_EXPIRES_IN="7d"
JWT_REFRESH_SECRET="your-32+ character refresh secret here-9876543210"
JWT_REFRESH_EXPIRES_IN="30d"

# CORS Configuration
FRONTEND_URL="https://your-frontend-domain.com"
ALLOWED_ORIGINS="https://your-frontend-domain.com,https://admin.your-domain.com"

# Redis Configuration (Optional but recommended)
REDIS_URL="redis://localhost:6379"

# Security Configuration
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# Logging Configuration
LOG_LEVEL=info
LOG_FILE="./logs/app.log"

# Feature Flags
ENABLE_SWAGGER=true
ENABLE_METRICS=true
ENABLE_CACHE=true
```

#### Frontend Configuration

Create `Frontend/.env`:

```bash
VITE_API_URL=https://api.your-domain.com
VITE_WS_URL=wss://api.your-domain.com
NODE_ENV=production
```

---

## Database Configuration

### Option 1: MySQL Installation

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install mysql-server mysql-client

# macOS
brew install mysql

# Windows
# Download from https://dev.mysql.com/downloads/mysql/
```

### Option 2: Docker MySQL

```bash
docker run -d \
  --name clms-mysql \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=your-secure-password \
  -e MYSQL_DATABASE=clms_database \
  -e MYSQL_USER=clms_user \
  -e MYSQL_PASSWORD=your-db-password \
  mysql:8.0 \
  --default-authentication-plugin=mysql_native_password
```

### Initialize Database

```bash
cd Backend

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed with initial data
npm run db:seed

# OR manually
npx prisma generate
npx prisma db push
```

### Verify Database

```bash
# Connect to MySQL
mysql -h localhost -u clms_user -p clms_database

# Check tables
SHOW TABLES;

# Verify schema
DESCRIBE students;
DESCRIBE books;
DESCRIBE equipment;
```

---

## Application Deployment

### Development Mode

```bash
# Start all services with Docker Compose
docker-compose up -d

# OR start manually
# Terminal 1: Start MySQL
docker-compose up mysql -d

# Terminal 2: Start Redis
docker-compose up redis -d

# Terminal 3: Start Backend
cd Backend
npm run dev

# Terminal 4: Start Frontend
cd Frontend
npm run dev
```

**Access URLs:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Health Check: http://localhost:3001/health
- API Docs: http://localhost:3001/api-docs
- Adminer (DB): http://localhost:8080

---

## Docker Deployment

### Production Build

```bash
# Build all services
docker-compose -f docker-compose.prod.yml build

# Deploy with production config
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Docker Compose Production Config

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ${MYSQL_DATABASE}
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
      - ./docker/mysql/conf.d/production.cnf:/etc/mysql/conf.d/custom.cnf
    ports:
      - "3306:3306"
    restart: unless-stopped
    networks:
      - clms-network

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped
    networks:
      - clms-network

  backend:
    build:
      context: ./Backend
      dockerfile: Dockerfile.prod
    environment:
      NODE_ENV: production
      DATABASE_URL: mysql://${MYSQL_USER}:${MYSQL_PASSWORD}@mysql:3306/${MYSQL_DATABASE}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
    ports:
      - "3001:3001"
    depends_on:
      - mysql
      - redis
    restart: unless-stopped
    networks:
      - clms-network
    volumes:
      - ./Backend/logs:/app/logs

  frontend:
    build:
      context: ./Frontend
      dockerfile: Dockerfile.prod
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - clms-network
    volumes:
      - ./Frontend/nginx/ssl:/etc/nginx/ssl

  adminer:
    image: adminer:latest
    ports:
      - "8080:8080"
    depends_on:
      - mysql
    restart: unless-stopped
    networks:
      - clms-network

volumes:
  mysql_data:
  redis_data:

networks:
  clms-network:
    driver: bridge
```

### Environment File (.env.production)

```bash
# Database
MYSQL_ROOT_PASSWORD=generate-a-secure-password-here
MYSQL_DATABASE=clms_database
MYSQL_USER=clms_user
MYSQL_PASSWORD=generate-another-secure-password

# Redis
REDIS_PASSWORD=generate-redis-password

# JWT
JWT_SECRET=your-very-secure-jwt-secret-minimum-32-characters
JWT_REFRESH_SECRET=your-very-secure-refresh-secret-minimum-32-characters
```

---

## Production Configuration

### SSL/TLS Setup

**Option 1: Let's Encrypt (Recommended)**

```bash
# Install Certbot
sudo apt install certbot

# Generate certificate
sudo certbot certonly --standalone -d api.your-domain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/api.your-domain.com/fullchain.pem /path/to/ssl/
sudo cp /etc/letsencrypt/live/api.your-domain.com/privkey.pem /path/to/ssl/
```

**Option 2: Self-Signed (Development Only)**

```bash
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/private.key \
  -out ssl/certificate.crt
```

### Nginx Reverse Proxy

Create `/etc/nginx/sites-available/clms`:

```nginx
server {
    listen 80;
    server_name api.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.your-domain.com;

    ssl_certificate /path/to/ssl/certificate.crt;
    ssl_certificate_key /path/to/ssl/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/clms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Health Checks

### API Health Check

```bash
# Basic health check
curl https://api.your-domain.com/health

# Expected response:
{
  "status": "OK",
  "timestamp": "2025-11-05T19:45:00.000Z",
  "uptime": 3600,
  "environment": "production"
}
```

### Database Health Check

```bash
# Check database connection
curl https://api.your-domain.com/api/health/db

# Check cache
curl https://api.your-domain.com/api/health/cache
```

### Performance Monitoring

```bash
# Get performance metrics
curl https://api.your-domain.com/api/performance
```

---

## Monitoring & Logging

### Application Logs

```bash
# View logs
tail -f Backend/logs/app.log

# View error logs
tail -f Backend/logs/error.log

# View access logs
tail -f Backend/logs/access.log
```

### Log Rotation

Create `/etc/logrotate.d/clms`:

```
/path/to/Backend/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0644 www-data www-data
    postrotate
        systemctl reload clms-backend
    endscript
}
```

### Monitoring Setup

**Option 1: Prometheus + Grafana**

```yaml
# docker-compose.monitoring.yml
version: '3.8'
services:
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

**Option 2: Cloud Monitoring**

- AWS CloudWatch
- Google Cloud Monitoring
- Azure Monitor

---

## Backup & Recovery

### Database Backup

```bash
# Create backup
mysqldump -u clms_user -p clms_database > backup_$(date +%Y%m%d_%H%M%S).sql

# Automated backup script
#!/bin/bash
BACKUP_DIR="/backup/clms"
DATE=$(date +%Y%m%d_%H%M%S)
mysqldump -u clms_user -p${MYSQL_PASSWORD} clms_database | gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# Add to crontab
# 0 2 * * * /path/to/backup.sh
```

### Restore Database

```bash
# Restore from backup
gunzip < backup_20251105_020000.sql.gz | mysql -u clms_user -p clms_database
```

---

## Troubleshooting

### Common Issues

**1. Database Connection Failed**

```bash
# Check MySQL is running
sudo systemctl status mysql

# Check port
netstat -tulpn | grep 3306

# Check credentials
mysql -h localhost -u clms_user -p
```

**2. JWT Authentication Errors**

```bash
# Verify JWT secrets are set and >= 32 characters
grep JWT_SECRET Backend/.env

# Check token expiration
# Ensure JWT_EXPIRES_IN is set properly
```

**3. High Memory Usage**

```bash
# Check memory
free -h

# Check Node.js memory
ps aux | grep node

# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
```

**4. Slow Queries**

```bash
# Enable slow query log
# Add to MySQL config:
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2

# View slow queries
tail -f /var/log/mysql/slow.log
```

**5. Port Already in Use**

```bash
# Find process using port
sudo lsof -i :3001

# Kill process
sudo kill -9 <PID>
```

---

## Security Checklist

- [ ] Change default passwords
- [ ] Use strong JWT secrets (32+ characters)
- [ ] Enable SSL/TLS
- [ ] Configure firewall (only ports 80, 443, 22)
- [ ] Keep dependencies updated
- [ ] Enable rate limiting
- [ ] Configure CORS properly
- [ ] Set up log monitoring
- [ ] Enable database encryption
- [ ] Regular security audits

---

## Performance Tuning

### MySQL Optimization

Add to `/etc/mysql/mysql.conf.d/mysqld.cnf`:

```ini
[mysqld]
innodb_buffer_pool_size = 1G
innodb_log_file_size = 256M
query_cache_size = 64M
max_connections = 200
```

### Redis Optimization

Add to `/etc/redis/redis.conf`:

```conf
maxmemory 256mb
maxmemory-policy allkeys-lru
```

### Node.js Optimization

```bash
# Set Node.js options
export NODE_OPTIONS="--max-old-space-size=2048"
export UV_THREADPOOL_SIZE=128
```

---

## Rollback Procedure

### Application Rollback

```bash
# Previous Docker image
docker-compose down
docker pull clms-backend:previous-version
docker-compose up -d
```

### Database Rollback

```bash
# Restore from backup
gunzip backup_20251105_020000.sql.gz | mysql -u clms_user -p clms_database
```

---

## Support & Maintenance

### Regular Tasks

**Daily:**
- Check application health
- Review error logs
- Monitor disk space

**Weekly:**
- Review performance metrics
- Check security logs
- Update dependencies

**Monthly:**
- Full system backup
- Security audit
- Capacity planning review

### Log Locations

```
Backend/logs/
  ├── app.log          # Application logs
  ├── error.log        # Error logs
  ├── access.log       # Access logs
  └── performance.log  # Performance logs
```

---

## Contact Information

**System Administrator:** admin@your-domain.com
**Documentation:** https://docs.your-domain.com
**Support:** support@your-domain.com

---

## References

- [CLMS README](README.md)
- [API Documentation](http://localhost:3001/api-docs)
- [Database Schema](Backend/prisma/schema.prisma)
- [Security Audit Report](SECURITY_AUDIT_REPORT.md)
- [Performance Report](Backend/PERFORMANCE_OPTIMIZATION_REPORT.md)

---

**Deployment Guide Version:** 1.0
**Last Updated:** November 5, 2025
**CLMS Version:** 2.0.0
