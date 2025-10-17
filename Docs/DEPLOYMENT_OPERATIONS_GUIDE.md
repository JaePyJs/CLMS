# CLMS Deployment and Operations Guide

**🚨 CONSOLIDATED GUIDE**: This guide has been merged with `PRODUCTION_DEPLOYMENT_GUIDE.md` to provide comprehensive deployment coverage for both development and production environments.

## Overview

This guide provides comprehensive instructions for deploying, managing, and maintaining the CLMS (Comprehensive Library Management System) in production environments. It covers production deployment, performance optimization, monitoring procedures, load balancing setup, and backup/recovery operations.

**What's Included**:
- Production deployment procedures
- System requirements and architecture
- Load balancing and scaling setup
- Performance optimization strategies
- Monitoring and alerting
- Backup and recovery procedures
- Maintenance and updates

### 🚀 New in Version 2.0 (October 2025)

- **Enhanced Docker Configuration**: Optimized multi-stage builds with better caching
- **TypeScript Compilation Improvements**: Faster builds with incremental compilation
- **Repository Pattern Deployment**: New deployment considerations for the repository pattern
- **Flexible Import System**: Deployment configuration for enhanced import capabilities
- **Performance Monitoring**: Enhanced monitoring and observability features

## Production Deployment Guide

### System Requirements

#### Minimum Requirements
- **CPU**: 4 cores (8 cores recommended)
- **RAM**: 8GB (16GB recommended)
- **Storage**: 100GB SSD (500GB recommended)
- **Network**: 1Gbps connection
- **OS**: Windows Server 2019+, Ubuntu 20.04+, CentOS 8+

#### Recommended Production Setup
- **Application Server**: 8 cores, 16GB RAM, 500GB SSD
- **Database Server**: 4 cores, 8GB RAM, 1TB SSD
- **Backup Storage**: 2TB network-attached storage
- **Network Load Balancer**: Hardware or cloud-based
- **Monitoring**: Dedicated monitoring server

### Deployment Architecture

#### Production Architecture Diagram
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   Application   │    │    Database     │
│    (nginx/HAProxy) │────│   Server (CLMS) │────│   Server (MySQL) │
│   Port 80/443   │    │   Port 3001     │    │   Port 3306     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                │
                       ┌─────────────────┐
                       │     Redis       │
                       │   (Cache/Queue) │
                       │   Port 6379     │
                       └─────────────────┘
```

#### Multi-Server Setup
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Primary App   │    │   Backup App    │    │   Database      │
│   Server #1     │────│   Server #2     │────│   Primary       │
│   Active        │    │   Standby       │    │   MySQL         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐
                       │   Database      │
                       │   Replica       │
                       │   MySQL (RO)    │
                       └─────────────────┘
```

### Installation and Configuration

#### 1. Server Preparation

**Update System Packages:**
```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git build-essential

# CentOS/RHEL
sudo yum update -y
sudo yum groupinstall -y "Development Tools"
sudo yum install -y curl wget git
```

**Create Application User:**
```bash
# Create dedicated user for CLMS
sudo useradd -m -s /bin/bash clms
sudo usermod -aG sudo clms

# Switch to clms user
sudo su - clms
```

**Install Node.js:**
```bash
# Install Node.js 20+ LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should be v20.x.x
npm --version   # Should be 9.x.x or higher
```

#### 2. Database Setup

**Install MySQL 8.0:**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y mysql-server

# CentOS/RHEL
sudo yum install -y mysql-server
```

**Secure MySQL Installation:**
```bash
sudo mysql_secure_installation
```

**Create CLMS Database:**
```sql
-- Connect to MySQL
mysql -u root -p

-- Create database and user
CREATE DATABASE clms_database CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'clms_user'@'localhost' IDENTIFIED BY 'strong_password_here';
CREATE USER 'clms_user'@'%' IDENTIFIED BY 'strong_password_here';

-- Grant permissions
GRANT ALL PRIVILEGES ON clms_database.* TO 'clms_user'@'localhost';
GRANT ALL PRIVILEGES ON clms_database.* TO 'clms_user'@'%';

-- Create read-only user for reports
CREATE USER 'clms_readonly'@'localhost' IDENTIFIED BY 'readonly_password_here';
GRANT SELECT ON clms_database.* TO 'clms_readonly'@'localhost';

FLUSH PRIVILEGES;
EXIT;
```

**Configure MySQL:**
```ini
# /etc/mysql/mysql.conf.d/mysqld.cnf
[mysqld]
# General Settings
bind-address = 0.0.0.0
port = 3306

# Performance Settings
innodb_buffer_pool_size = 2G
innodb_log_file_size = 256M
innodb_flush_log_at_trx_commit = 2
innodb_flush_method = O_DIRECT

# Security Settings
require_secure_transport = ON
ssl_cert = /etc/mysql/certs/server-cert.pem
ssl_key = /etc/mysql/certs/server-key.pem
ssl_ca = /etc/mysql/certs/ca-cert.pem

# Logging
log_error = /var/log/mysql/error.log
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2

# Binary Logging for Backups
log_bin = /var/log/mysql/mysql-bin.log
binlog_format = ROW
expire_logs_days = 7
max_binlog_size = 100M
```

#### 3. Redis Setup

**Install Redis:**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y redis-server

# CentOS/RHEL
sudo yum install -y redis
```

**Configure Redis:**
```conf
# /etc/redis/redis.conf
bind 127.0.0.1 0.0.0.0
port 6379
requirepass your_redis_password_here

# Memory Management
maxmemory 2gb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000

# Security
protected-mode yes
tcp-keepalive 300
timeout 0

# Logging
logfile /var/log/redis/redis-server.log
loglevel notice
```

#### 4. Application Deployment

**Clone Repository:**
```bash
# Create application directory
sudo mkdir -p /opt/clms
sudo chown clms:clms /opt/clms

# Clone repository
cd /opt/clms
git clone https://github.com/your-org/clms.git .
```

**Backend Configuration:**
```bash
cd /opt/clms/Backend

# Install dependencies
npm ci --production

# Copy environment template
cp .env.example .env.production

# Edit production environment
nano .env.production
```

**Production Environment Variables:**
```bash
# /opt/clms/Backend/.env.production
NODE_ENV=production
PORT=3001

# Database Configuration
DATABASE_URL=mysql://clms_user:strong_password_here@localhost:3306/clms_database
DATABASE_SSL=true

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password_here

# Security
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters
JWT_EXPIRES_IN=24h
BCRYPT_ROUNDS=12
SESSION_SECRET=your-session-secret-minimum-32-characters

# CORS Configuration
CORS_ORIGIN=https://your-domain.com

# File Upload Configuration
UPLOAD_PATH=/opt/clms/uploads
MAX_FILE_SIZE=10485760

# Email Configuration (if using email notifications)
SMTP_HOST=smtp.your-domain.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=notifications@your-domain.com
SMTP_PASS=your_smtp_password

# Backup Configuration
BACKUP_PATH=/opt/clms/backups
BACKUP_SCHEDULE=0 2 * * *  # Daily at 2 AM
BACKUP_RETENTION_DAYS=30

# Monitoring and Logging
LOG_LEVEL=info
LOG_FILE=/var/log/clms/app.log
MONITORING_ENABLED=true

# Analytics and Reporting
ANALYTICS_ENABLED=true
REPORTS_CACHE_TTL=3600

# Security
RATE_LIMIT_ENABLED=true
SECURITY_HEADERS_ENABLED=true
AUDIT_LOGGING=true

# WebSockets
WEBSOCKET_ENABLED=true
WEBSOCKET_PORT=3002
```

**Frontend Configuration:**
```bash
cd /opt/clms/Frontend

# Install dependencies
npm ci --production

# Build for production
npm run build

# Copy environment template
cp .env.example .env.production

# Edit production environment
nano .env.production
```

**Frontend Environment Variables:**
```bash
# /opt/clms/Frontend/.env.production
VITE_API_URL=https://your-domain.com/api
VITE_APP_NAME=CLMS - Library Management System
VITE_BARCODE_SCANNER_MODE=keyboard
VITE_WEBSOCKET_URL=wss://your-domain.com
VITE_ENABLE_ANALYTICS=true
VITE_SENTRY_DSN=your_sentry_dsn_here
```

#### 5. Database Setup

**Run Database Migrations:**
```bash
cd /opt/clms/Backend

# Generate Prisma client
npx prisma generate

# Apply database schema
npx prisma db push

# Seed initial data (optional)
npx prisma db seed
```

**Create Database User with Limited Privileges:**
```sql
-- Connect to MySQL as root
mysql -u root -p

-- Create application user with limited privileges
CREATE USER 'clms_app'@'localhost' IDENTIFIED BY 'app_password_here';
GRANT SELECT, INSERT, UPDATE, DELETE ON clms_database.* TO 'clms_app'@'localhost';

-- Create backup user
CREATE USER 'clms_backup'@'localhost' IDENTIFIED BY 'backup_password_here';
GRANT SELECT, LOCK TABLES, SHOW VIEW ON clms_database.* TO 'clms_backup'@'localhost';

FLUSH PRIVILEGES;
```

#### 6. SSL/TLS Configuration

**Obtain SSL Certificate (Let's Encrypt):**
```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Set up auto-renewal
sudo crontab -e
# Add this line:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

**Manual SSL Configuration:**
```nginx
# /etc/nginx/sites-available/clms
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Frontend
    location / {
        root /opt/clms/Frontend/dist;
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3001/health;
        access_log off;
    }
}
```

#### 7. Process Management with PM2

**Install PM2:**
```bash
sudo npm install -g pm2
```

**Create PM2 Configuration:**
```javascript
// /opt/clms/ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'clms-backend',
      script: 'dist/src/app.js',
      cwd: '/opt/clms/Backend',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      // Monitoring and Logging
      log_file: '/var/log/clms/backend.log',
      out_file: '/var/log/clms/backend-out.log',
      error_file: '/var/log/clms/backend-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Restart Strategy
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '1G',

      // Health Check
      health_check_grace_period: 3000,
      health_check_fatal_exceptions: true
    }
  ],

  deploy: {
    production: {
      user: 'clms',
      host: ['your-server-ip'],
      ref: 'origin/main',
      repo: 'https://github.com/your-org/clms.git',
      path: '/opt/clms',
      'pre-deploy-local': '',
      'post-deploy': 'npm ci --production && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
```

**Start Application with PM2:**
```bash
# Create log directory
sudo mkdir -p /var/log/clms
sudo chown clms:clms /var/log/clms

# Start application
cd /opt/clms
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
# Follow the instructions to enable PM2 startup

# Monitor application
pm2 monit
```

## Performance Optimization

### Database Optimization

#### MySQL Performance Tuning
```sql
-- Optimize MySQL configuration
-- Add these settings to my.cnf

[mysqld]
# Connection Settings
max_connections = 200
max_connect_errors = 1000
connect_timeout = 10
wait_timeout = 600
interactive_timeout = 600

# Buffer Settings
key_buffer_size = 32M
max_allowed_packet = 64M
table_open_cache = 256
sort_buffer_size = 1M
read_buffer_size = 1M
read_rnd_buffer_size = 4M
myisam_sort_buffer_size = 64M
thread_cache_size = 8
query_cache_size = 16M
query_cache_limit = 1M

# InnoDB Settings
innodb_buffer_pool_size = 2G  # 70% of available RAM
innodb_log_file_size = 256M
innodb_log_buffer_size = 8M
innodb_flush_log_at_trx_commit = 2
innodb_flush_method = O_DIRECT
innodb_file_per_table = 1
innodb_open_files = 400

# Temp Tables
tmp_table_size = 64M
max_heap_table_size = 64M

# Binary Logging
log_bin = /var/log/mysql/mysql-bin.log
binlog_format = ROW
expire_logs_days = 7
max_binlog_size = 100M
```

#### Database Index Optimization
```sql
-- Create optimized indexes for CLMS tables
-- These indexes should be created after initial data load

-- Students table indexes
CREATE INDEX idx_students_grade ON students(gradeLevel);
CREATE INDEX idx_students_active ON students(isActive) WHERE isActive = true;
CREATE INDEX idx_students_search ON students(lastName, firstName);

-- Activities table indexes
CREATE INDEX idx_activities_student ON activities(studentId);
CREATE INDEX idx_activities_time ON activities(startTime);
CREATE INDEX idx_activities_type ON activities(activityType);
CREATE INDEX idx_activities_equipment ON activities(equipmentId);
CREATE INDEX idx_activities_composite ON activities(studentId, startTime, activityType);

-- Books table indexes
CREATE INDEX idx_books_isbn ON books(isbn);
CREATE INDEX idx_books_title ON books(title);
CREATE INDEX idx_books_author ON books(author);
CREATE INDEX idx_books_status ON books(status);
CREATE INDEX idx_books_category ON books(category);

-- Equipment table indexes
CREATE INDEX idx_equipment_type ON equipment(type);
CREATE INDEX idx_equipment_status ON equipment(status);
CREATE INDEX idx_equipment_location ON equipment(location);

-- Audit logs indexes
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_user ON audit_logs(userId);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_composite ON audit_logs(timestamp, userId, action);
```

#### Query Optimization
```javascript
// Use connection pooling
const poolConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 20,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  ssl: process.env.DB_SSL === 'true'
};

// Implement query caching
const cacheConfig = {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  db: 0,
  keyPrefix: 'cache:',
  ttl: 3600 // 1 hour
};

// Optimized database queries
class OptimizedQueries {
  async getStudentActivities(studentId, limit = 50, offset = 0) {
    // Use indexed columns first
    const query = `
      SELECT
        a.id,
        a.activityType,
        a.startTime,
        a.endTime,
        a.duration,
        e.name as equipmentName,
        e.type as equipmentType,
        u.username as checkedInBy
      FROM activities a
      LEFT JOIN equipment e ON a.equipmentId = e.id
      LEFT JOIN users u ON a.checkedInBy = u.id
      WHERE a.studentId = ?
      ORDER BY a.startTime DESC
      LIMIT ? OFFSET ?
    `;

    return await db.query(query, [studentId, limit, offset]);
  }

  async getEquipmentUtilization(dateFrom, dateTo) {
    // Use date range optimization
    const query = `
      SELECT
        e.id,
        e.name,
        e.type,
        COUNT(a.id) as totalSessions,
        SUM(a.duration) as totalUsageTime,
        AVG(a.duration) as avgSessionTime
      FROM equipment e
      LEFT JOIN activities a ON e.id = a.equipmentId
        AND a.startTime BETWEEN ? AND ?
      GROUP BY e.id, e.name, e.type
      ORDER BY totalUsageTime DESC
    `;

    return await db.query(query, [dateFrom, dateTo]);
  }
}
```

### Application Performance Optimization

#### Frontend Optimization
```javascript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ],

  build: {
    // Code splitting
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-tabs', '@radix-ui/react-dialog'],
          charts: ['recharts'],
          utils: ['date-fns', 'lodash']
        }
      }
    },

    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },

    // Asset optimization
    assetsInlineLimit: 4096,

    // Source maps (disable in production)
    sourcemap: false
  },

  // Development server
  server: {
    host: true,
    port: 3000
  },

  // Preview server
  preview: {
    port: 3000,
    host: true
  }
});
```

#### Backend Performance Optimization
```typescript
// app.ts - Enable compression and caching
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Compression middleware
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', limiter);

// Response caching for static data
import NodeCache from 'node-cache';
const cache = new NodeCache({ stdTTL: 600 }); // 10 minutes

const cacheMiddleware = (duration: number = 600) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.originalUrl;
    const cached = cache.get(key);

    if (cached) {
      return res.json(cached);
    }

    res.sendResponse = res.json;
    res.json = (body) => {
      cache.set(key, body, duration);
      res.sendResponse(body);
    };

    next();
  };
};

// Apply caching to read-only endpoints
app.get('/api/books', cacheMiddleware(1800)); // 30 minutes
app.get('/api/equipment', cacheMiddleware(600)); // 10 minutes
app.get('/api/analytics/summary', cacheMiddleware(300)); // 5 minutes
```

#### Memory and CPU Optimization
```javascript
// Memory monitoring and optimization
class PerformanceMonitor {
  private memoryThreshold = 0.8; // 80% memory usage
  private cpuThreshold = 0.8; // 80% CPU usage

  constructor() {
    this.startMonitoring();
  }

  private startMonitoring() {
    setInterval(() => {
      this.checkMemoryUsage();
      this.checkCPUUsage();
    }, 30000); // Check every 30 seconds
  }

  private checkMemoryUsage() {
    const usage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    const memoryUsagePercent = usage.heapUsed / totalMemory;

    if (memoryUsagePercent > this.memoryThreshold) {
      console.warn(`High memory usage: ${(memoryUsagePercent * 100).toFixed(2)}%`);

      // Trigger garbage collection
      if (global.gc) {
        global.gc();
      }

      // Send alert
      this.sendAlert('HIGH_MEMORY', {
        usage: usage,
        percentage: memoryUsagePercent * 100
      });
    }
  }

  private checkCPUUsage() {
    const cpus = require('os').cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - (idle / total) * 100;

    if (usage > this.cpuThreshold * 100) {
      console.warn(`High CPU usage: ${usage.toFixed(2)}%`);

      this.sendAlert('HIGH_CPU', {
        usage: usage,
        cores: cpus.length
      });
    }
  }
}
```

## Monitoring Procedures

### System Monitoring Setup

#### Health Check Endpoints
```typescript
// health-check.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import redis from '../config/redis';

const router = Router();
const prisma = new PrismaClient();

router.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version,
    checks: {}
  };

  try {
    // Database check
    await prisma.$queryRaw`SELECT 1`;
    health.checks.database = { status: 'ok', responseTime: Date.now() };
  } catch (error) {
    health.checks.database = {
      status: 'error',
      error: error.message
    };
    health.status = 'degraded';
  }

  try {
    // Redis check
    await redis.ping();
    health.checks.redis = { status: 'ok' };
  } catch (error) {
    health.checks.redis = {
      status: 'error',
      error: error.message
    };
    health.status = 'degraded';
  }

  // Memory check
  const memUsage = process.memoryUsage();
  health.checks.memory = {
    status: 'ok',
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
    external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
  };

  // CPU check
  const cpuUsage = process.cpuUsage();
  health.checks.cpu = {
    status: 'ok',
    user: cpuUsage.user,
    system: cpuUsage.system
  };

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

router.get('/health/detailed', async (req, res) => {
  const detailed = await getDetailedHealth();
  res.json(detailed);
});

async function getDetailedHealth() {
  return {
    application: {
      name: 'CLMS',
      version: process.env.npm_package_version,
      environment: process.env.NODE_ENV,
      uptime: process.uptime(),
      pid: process.pid
    },
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      memory: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    },
    database: await getDatabaseHealth(),
    redis: await getRedisHealth(),
    websockets: getWebSocketHealth(),
    performance: getPerformanceMetrics()
  };
}

export default router;
```

#### Application Performance Monitoring (APM)
```javascript
// monitoring.ts
import { createPrometheusMetrics } from 'prom-client';

// Create metrics
const httpRequestDuration = new createPrometheusMetrics.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

const httpRequestTotal = new createPrometheusMetrics.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const activeConnections = new createPrometheusMetrics.Gauge({
  name: 'websocket_connections_active',
  help: 'Number of active WebSocket connections'
});

const databaseConnections = new createPrometheusMetrics.Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections'
});

// Middleware to collect metrics
export function metricsMiddleware(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const labels = {
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode.toString()
    };

    httpRequestDuration.observe(labels, duration);
    httpRequestTotal.inc(labels);
  });

  next();
}

// Metrics endpoint
export function metricsEndpoint(req, res) {
  res.set('Content-Type', createPrometheusMetrics.register.contentType);
  res.end(createPrometheusMetrics.register.metrics());
}
```

#### Log Aggregation Setup
```javascript
// logging.ts
import winston from 'winston';
import 'winston-daily-rotate-file';

// Create logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'clms-api' },
  transports: [
    // Error logs
    new winston.transports.DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d'
    }),

    // Combined logs
    new winston.transports.DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d'
    }),

    // Audit logs
    new winston.transports.DailyRotateFile({
      filename: 'logs/audit-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'info',
      maxSize: '50m',
      maxFiles: '2555d' // 7 years
    })
  ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

export default logger;
```

### Monitoring Dashboards

#### Grafana Dashboard Configuration
```json
{
  "dashboard": {
    "title": "CLMS Monitoring Dashboard",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "50th percentile"
          }
        ]
      },
      {
        "title": "Active WebSocket Connections",
        "type": "singlestat",
        "targets": [
          {
            "expr": "websocket_connections_active"
          }
        ]
      },
      {
        "title": "Database Connections",
        "type": "singlestat",
        "targets": [
          {
            "expr": "database_connections_active"
          }
        ]
      },
      {
        "title": "Memory Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "process_resident_memory_bytes"
          }
        ]
      },
      {
        "title": "CPU Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(process_cpu_seconds_total[5m])"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{status_code=~\"5..\"}[5m]) / rate(http_requests_total[5m])",
            "legendFormat": "Error Rate"
          }
        ]
      }
    ]
  }
}
```

#### Alerting Rules
```yaml
# alerting.yml
groups:
  - name: clms_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status_code=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }} for the last 5 minutes"

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is {{ $value }}s"

      - alert: DatabaseConnectionFailure
        expr: up{job="mysql"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database is down"
          description: "MySQL database has been down for more than 1 minute"

      - alert: RedisConnectionFailure
        expr: up{job="redis"} == 0
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Redis is down"
          description: "Redis cache has been down for more than 1 minute"

      - alert: HighMemoryUsage
        expr: process_resident_memory_bytes / (1024*1024*1024) > 1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value }}GB"

      - alert: WebSocketConnectionsHigh
        expr: websocket_connections_active > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High number of WebSocket connections"
          description: "{{ $value }} active WebSocket connections"
```

## Backup and Disaster Recovery Procedures

### Automated Backup System

#### Database Backup Script
```bash
#!/bin/bash
# backup-database.sh

# Configuration
DB_HOST="localhost"
DB_PORT="3306"
DB_USER="clms_backup"
DB_PASSWORD="backup_password_here"
DB_NAME="clms_database"
BACKUP_DIR="/opt/clms/backups/database"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Create backup filename
BACKUP_FILE="$BACKUP_DIR/clms_backup_$DATE.sql"

# Perform backup
echo "Starting database backup at $(date)"
mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --hex-blob \
  --set-gtid-purged=OFF \
  "$DB_NAME" > "$BACKUP_FILE"

# Check if backup was successful
if [ $? -eq 0 ]; then
  echo "Database backup completed successfully"

  # Compress backup
  gzip "$BACKUP_FILE"
  echo "Backup compressed: ${BACKUP_FILE}.gz"

  # Verify backup file
  if [ -f "${BACKUP_FILE}.gz" ]; then
    # Upload to cloud storage (optional)
    # aws s3 cp "${BACKUP_FILE}.gz" s3://your-backup-bucket/database/

    # Clean up old backups
    find "$BACKUP_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -delete

    echo "Backup retention cleanup completed"
  else
    echo "ERROR: Backup file not found after compression"
    exit 1
  fi
else
  echo "ERROR: Database backup failed"
  exit 1
fi

echo "Backup process completed at $(date)"
```

#### Application Backup Script
```bash
#!/bin/bash
# backup-application.sh

# Configuration
APP_DIR="/opt/clms"
BACKUP_DIR="/opt/clms/backups/application"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Create backup filename
BACKUP_FILE="$BACKUP_DIR/clms_app_backup_$DATE.tar.gz"

# Backup application files (excluding node_modules and logs)
echo "Starting application backup at $(date)"
tar -czf "$BACKUP_FILE" \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='logs' \
  --exclude='backups' \
  --exclude='.git' \
  -C "$APP_DIR" .

# Check if backup was successful
if [ $? -eq 0 ]; then
  echo "Application backup completed successfully"

  # Backup configuration files separately
  CONFIG_BACKUP="$BACKUP_DIR/clms_config_backup_$DATE.tar.gz"
  tar -czf "$CONFIG_BACKUP" \
    -C "$APP_DIR" \
    Backend/.env.production \
    Frontend/.env.production \
    ecosystem.config.js \
    nginx.conf

  # Upload to cloud storage (optional)
  # aws s3 cp "$BACKUP_FILE" s3://your-backup-bucket/application/
  # aws s3 cp "$CONFIG_BACKUP" s3://your-backup-bucket/config/

  # Clean up old backups
  find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete

  echo "Application backup cleanup completed"
else
  echo "ERROR: Application backup failed"
  exit 1
fi

echo "Application backup process completed at $(date)"
```

#### Backup Scheduling with Cron
```bash
# Add to crontab: crontab -e

# Database backup - Daily at 2:00 AM
0 2 * * * /opt/clms/scripts/backup-database.sh >> /var/log/clms/backup.log 2>&1

# Application backup - Daily at 3:00 AM
0 3 * * * /opt/clms/scripts/backup-application.sh >> /var/log/clms/backup.log 2>&1

# Backup verification - Daily at 4:00 AM
0 4 * * * /opt/clms/scripts/verify-backups.sh >> /var/log/clms/backup.log 2>&1

# Backup cleanup - Weekly on Sunday at 5:00 AM
0 5 * * 0 /opt/clms/scripts/cleanup-old-backups.sh >> /var/log/clms/backup.log 2>&1
```

### Disaster Recovery Procedures

#### Emergency Response Plan

**1. System Outage Response**
```bash
#!/bin/bash
# emergency-response.sh

# System health check
check_system_health() {
  echo "=== System Health Check ==="

  # Check application status
  if pm2 list | grep -q "clms-backend.*online"; then
    echo "✓ Application is running"
  else
    echo "✗ Application is down"
    return 1
  fi

  # Check database connectivity
  if mysql -h localhost -u clms_user -p -e "SELECT 1" clms_database &>/dev/null; then
    echo "✓ Database is accessible"
  else
    echo "✗ Database is not accessible"
    return 1
  fi

  # Check Redis connectivity
  if redis-cli ping &>/dev/null; then
    echo "✓ Redis is accessible"
  else
    echo "✗ Redis is not accessible"
    return 1
  fi

  echo "✓ All systems operational"
  return 0
}

# Quick restart procedures
quick_restart() {
  echo "=== Quick Restart ==="

  # Restart application
  pm2 restart clms-backend

  # Wait for application to start
  sleep 10

  # Verify health
  if check_system_health; then
    echo "✓ System recovery successful"
  else
    echo "✗ Quick restart failed, escalating recovery"
    full_recovery
  fi
}

# Full recovery procedures
full_recovery() {
  echo "=== Full Recovery ==="

  # Stop all services
  pm2 stop clms-backend

  # Clear application cache
  redis-cli FLUSHALL

  # Restart database
  sudo systemctl restart mysql

  # Wait for database to start
  sleep 30

  # Check database integrity
  mysqlcheck -u root -p --all-databases --auto-repair

  # Restart Redis
  sudo systemctl restart redis

  # Start application
  pm2 start clms-backend

  # Wait for application to start
  sleep 15

  # Verify health
  if check_system_health; then
    echo "✓ Full recovery successful"
  else
    echo "✗ Full recovery failed, manual intervention required"
    notify_administrator "System recovery failed - manual intervention required"
  fi
}

# Notify administrators
notify_administrator() {
  local message="$1"
  echo "ALERT: $message" | mail -s "CLMS System Alert" admin@your-domain.com

  # Send Slack notification (if configured)
  # curl -X POST -H 'Content-type: application/json' \
  #   --data '{"text":"'$message'"}' \
  #   https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
}

# Main execution
case "$1" in
  check)
    check_system_health
    ;;
  quick-restart)
    quick_restart
    ;;
  full-recovery)
    full_recovery
    ;;
  *)
    echo "Usage: $0 {check|quick-restart|full-recovery}"
    exit 1
    ;;
esac
```

**2. Data Recovery Procedures**
```bash
#!/bin/bash
# restore-database.sh

# Configuration
BACKUP_FILE="$1"
DB_HOST="localhost"
DB_PORT="3306"
DB_USER="clms_user"
DB_PASSWORD="database_password_here"
DB_NAME="clms_database"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup_file>"
  echo "Example: $0 /opt/clms/backups/database/clms_backup_20251013_020000.sql.gz"
  exit 1
fi

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Create restore log
RESTORE_LOG="/var/log/clms/restore_$(date +%Y%m%d_%H%M%S).log"
echo "Database restore started at $(date)" | tee "$RESTORE_LOG"

# Stop application
echo "Stopping application..." | tee -a "$RESTORE_LOG"
pm2 stop clms-backend

# Create database backup before restore
echo "Creating pre-restore backup..." | tee -a "$RESTORE_LOG"
PRE_RESTORE_BACKUP="/opt/clms/backups/emergency/pre_restore_$(date +%Y%m%d_%H%M%S).sql"
mysqldump -h "$DB_HOST" -P "$DB_PORT" -u root -p"$DB_PASSWORD" "$DB_NAME" > "$PRE_RESTORE_BACKUP"

# Drop and recreate database
echo "Dropping existing database..." | tee -a "$RESTORE_LOG"
mysql -h "$DB_HOST" -P "$DB_PORT" -u root -p"$DB_PASSWORD" -e "DROP DATABASE IF EXISTS $DB_NAME"
mysql -h "$DB_HOST" -P "$DB_PORT" -u root -p"$DB_PASSWORD" -e "CREATE DATABASE $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"

# Restore database
echo "Restoring database from backup..." | tee -a "$RESTORE_LOG"

if [[ "$BACKUP_FILE" == *.gz ]]; then
  gunzip -c "$BACKUP_FILE" | mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME"
else
  mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$BACKUP_FILE"
fi

# Check restore success
if [ $? -eq 0 ]; then
  echo "Database restore completed successfully" | tee -a "$RESTORE_LOG"

  # Run database migrations
  echo "Running database migrations..." | tee -a "$RESTORE_LOG"
  cd /opt/clms/Backend
  npx prisma db push

  # Start application
  echo "Starting application..." | tee -a "$RESTORE_LOG"
  pm2 start clms-backend

  # Verify restore
  sleep 10
  if curl -f http://localhost:3001/health &>/dev/null; then
    echo "✓ System verification successful" | tee -a "$RESTORE_LOG"
  else
    echo "✗ System verification failed" | tee -a "$RESTORE_LOG"
    notify_administrator "Database restore completed but system verification failed"
  fi
else
  echo "✗ Database restore failed" | tee -a "$RESTORE_LOG"

  # Attempt to restore from pre-restore backup
  echo "Attempting to restore from pre-restore backup..." | tee -a "$RESTORE_LOG"
  mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$PRE_RESTORE_BACKUP"

  notify_administrator "Database restore failed - system restored to previous state"
fi

echo "Database restore process completed at $(date)" | tee -a "$RESTORE_LOG"
```

### High Availability Setup

#### Database Replication
```sql
-- Master server configuration
-- /etc/mysql/mysql.conf.d/mysqld.cnf

[mysqld]
# Server ID (must be unique)
server-id = 1

# Binary logging for replication
log_bin = /var/log/mysql/mysql-bin.log
binlog_format = ROW
expire_logs_days = 7
max_binlog_size = 100M

# GTID for global transaction identification
gtid_mode = ON
enforce_gtid_consistency = ON

# Read-only settings (master can write)
read_only = OFF
super_read_only = OFF

-- Create replication user
CREATE USER 'replicator'@'%' IDENTIFIED BY 'strong_replication_password';
GRANT REPLICATION SLAVE ON *.* TO 'replicator'@'%';
FLUSH PRIVILEGES;

-- Get master status
SHOW MASTER STATUS;
```

```sql
-- Slave server configuration
-- /etc/mysql/mysql.conf.d/mysqld.cnf

[mysqld]
# Server ID (must be different from master)
server-id = 2

# Binary logging (optional for slave)
log_bin = /var/log/mysql/mysql-bin.log
binlog_format = ROW

# GTID settings
gtid_mode = ON
enforce_gtid_consistency = ON

# Read-only settings (slave is read-only)
read_only = ON
super_read_only = ON

-- Configure replication
CHANGE MASTER TO
  MASTER_HOST='master-server-ip',
  MASTER_PORT=3306,
  MASTER_USER='replicator',
  MASTER_PASSWORD='strong_replication_password',
  MASTER_AUTO_POSITION=1;

START SLAVE;

-- Check slave status
SHOW SLAVE STATUS\G
```

#### Load Balancer Configuration
```nginx
# nginx.conf - Load balancer configuration
upstream clms_backend {
    least_conn;
    server 10.0.1.10:3001 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:3001 max_fails=3 fail_timeout=30s backup;

    # Health check
    check interval=5000 rise=2 fall=3 timeout=1000 type=http;
    check_http_send "GET /health HTTP/1.0\r\n\r\n";
    check_http_expect_alive http_2xx http_3xx;
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/ssl/certs/your-domain.com.crt;
    ssl_certificate_key /etc/ssl/private/your-domain.com.key;

    # Frontend
    location / {
        root /opt/clms/Frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API with load balancing
    location /api/ {
        proxy_pass http://clms_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket
    location /ws {
        proxy_pass http://clms_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

### Maintenance Procedures

#### Regular Maintenance Tasks

**1. Daily Maintenance**
```bash
#!/bin/bash
# daily-maintenance.sh

echo "Starting daily maintenance at $(date)"

# Check system health
/opt/clms/scripts/emergency-response.sh check

# Clean up temporary files
find /tmp -name "clms_*" -mtime +1 -delete

# Rotate logs
logrotate /etc/logrotate.d/clms

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
  echo "WARNING: Disk usage is ${DISK_USAGE}%" | \
    mail -s "CLMS Disk Space Warning" admin@your-domain.com
fi

# Update security patches (Ubuntu)
if command -v apt &> /dev/null; then
  apt update
  apt list --upgradable 2>/dev/null | grep -v "WARNING" > /tmp/updates_available
  if [ -s /tmp/updates_available ]; then
    echo "Security updates available" | \
      mail -s "CLMS Security Updates Available" admin@your-domain.com
  fi
fi

echo "Daily maintenance completed at $(date)"
```

**2. Weekly Maintenance**
```bash
#!/bin/bash
# weekly-maintenance.sh

echo "Starting weekly maintenance at $(date)"

# Database optimization
mysql -u root -p -e "
  OPTIMIZE TABLE clms_database.students;
  OPTIMIZE TABLE clms_database.activities;
  OPTIMIZE TABLE clms_database.books;
  OPTIMIZE TABLE clms_database.equipment;
  OPTIMIZE TABLE clms_database.audit_logs;
"

# Clear Redis cache
redis-cli FLUSHDB

# Restart application (for memory cleanup)
pm2 restart clms-backend

# Check for security updates
if command -v apt &> /dev/null; then
  apt list --upgradable 2>/dev/null | grep -i security > /tmp/security_updates
  if [ -s /tmp/security_updates ]; then
    echo "Security updates require installation:" | \
      mail -s "URGENT: CLMS Security Updates" admin@your-domain.com
  fi
fi

# Verify backup integrity
/opt/clms/scripts/verify-backups.sh

echo "Weekly maintenance completed at $(date)"
```

## Enhanced Docker Deployment (v2.0)

### Optimized Docker Configuration

The v2.0 release includes enhanced Docker configurations with multi-stage builds, better caching, and improved performance:

```dockerfile
# Enhanced Backend Dockerfile with multi-stage build
# Backend/Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Build the application with TypeScript
FROM base AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
COPY tsconfig.json ./
COPY src ./src/

# Install all dependencies for building
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S clms -u 1001

# Copy built application
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder --chown=clms:nodejs /app/dist ./dist
COPY --from=builder --chown=clms:nodejs /app/prisma ./prisma
COPY --from=builder --chown=clms:nodejs /app/package*.json ./

# Create directories for uploads and logs
RUN mkdir -p /app/uploads /app/logs && chown -R clms:nodejs /app

# Switch to non-root user
USER clms

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start the application
CMD ["npm", "start"]
```

```dockerfile
# Enhanced Frontend Dockerfile with better caching
# Frontend/Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Build the application
FROM base AS builder
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY index.html ./
COPY src ./src/

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Build the application
RUN npm run build

# Production image with nginx
FROM nginx:alpine AS runner

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built application
COPY --from=builder /app/dist /usr/share/nginx/html

# Create non-root user
RUN addgroup -g 1001 -S nginx
RUN adduser -S nginx -u 1001 -G nginx

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

### Enhanced Docker Compose Configuration

```yaml
# Enhanced docker-compose.yml for v2.0
version: '3.8'

services:
  # MySQL Database with enhanced configuration
  mysql:
    image: mysql:8.0
    container_name: clms_mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ${MYSQL_DATABASE}
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
      - ./mysql/init:/docker-entrypoint-initdb.d
      - ./mysql/conf:/etc/mysql/conf.d
    ports:
      - "3306:3306"
    networks:
      - clms_network
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 30s
      timeout: 10s
      retries: 3
    command: --default-authentication-plugin=mysql_native_password

  # Redis Cache with persistence
  redis:
    image: redis:7-alpine
    container_name: clms_redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes
    volumes:
      - redis_data:/data
      - ./redis/redis.conf:/usr/local/etc/redis/redis.conf
    ports:
      - "6379:6379"
    networks:
      - clms_network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Backend API with enhanced configuration
  backend:
    build:
      context: ./Backend
      dockerfile: Dockerfile
      target: runner
    container_name: clms_backend
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3001
      DATABASE_URL: mysql://${MYSQL_USER}:${MYSQL_PASSWORD}@mysql:3306/${MYSQL_DATABASE}
      REDIS_URL: redis://redis:6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
      KOHA_DATABASE_URL: ${KOHA_DATABASE_URL}
      # Repository pattern configuration
      REPOSITORY_CACHE_TTL: 300
      REPOSITORY_CACHE_MAX_SIZE: 1000
      # Import system configuration
      IMPORT_BATCH_SIZE: 100
      IMPORT_TIMEOUT: 30000
      # Type inference configuration
      TYPE_INFERENCE_STRICT_MODE: true
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    ports:
      - "3001:3001"
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
      - ./backups:/app/backups
    networks:
      - clms_network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G

  # Frontend with enhanced nginx configuration
  frontend:
    build:
      context: ./Frontend
      dockerfile: Dockerfile
      target: runner
    container_name: clms_frontend
    restart: unless-stopped
    ports:
      - "3000:80"
    depends_on:
      backend:
        condition: service_healthy
    networks:
      - clms_network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M

  # WebSocket Server for real-time features
  websocket:
    build:
      context: ./Backend
      dockerfile: Dockerfile.websocket
    container_name: clms_websocket
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3002
      REDIS_URL: redis://redis:6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      redis:
        condition: service_healthy
    ports:
      - "3002:3002"
    networks:
      - clms_network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3002/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  mysql_data:
    driver: local
  redis_data:
    driver: local

networks:
  clms_network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

### Production Docker Compose

```yaml
# docker-compose.prod.yml for production deployment
version: '3.8'

services:
  # Use external database and Redis in production
  backend:
    image: clms/backend:2.0.0
    container_name: clms_backend_prod
    restart: always
    environment:
      NODE_ENV: production
      PORT: 3001
      DATABASE_URL: ${PROD_DATABASE_URL}
      REDIS_URL: ${PROD_REDIS_URL}
      JWT_SECRET: ${PROD_JWT_SECRET}
      KOHA_DATABASE_URL: ${PROD_KOHA_DATABASE_URL}
      # Repository pattern configuration
      REPOSITORY_CACHE_TTL: 600
      REPOSITORY_CACHE_MAX_SIZE: 5000
      # Import system configuration
      IMPORT_BATCH_SIZE: 200
      IMPORT_TIMEOUT: 60000
      # Type inference configuration
      TYPE_INFERENCE_STRICT_MODE: true
      # Performance monitoring
      ENABLE_METRICS: true
      METRICS_PORT: 9090
    ports:
      - "3001:3001"
      - "9090:9090"  # Metrics port
    volumes:
      - /data/clms/uploads:/app/uploads
      - /data/clms/logs:/app/logs
      - /data/clms/backups:/app/backups
    networks:
      - clms_network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 15s
      timeout: 5s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 4G
        reservations:
          cpus: '2.0'
          memory: 2G

  frontend:
    image: clms/frontend:2.0.0
    container_name: clms_frontend_prod
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./ssl:/etc/nginx/ssl:ro
    networks:
      - clms_network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80/health"]
      interval: 15s
      timeout: 5s
      retries: 3

  websocket:
    image: clms/websocket:2.0.0
    container_name: clms_websocket_prod
    restart: always
    environment:
      NODE_ENV: production
      PORT: 3002
      REDIS_URL: ${PROD_REDIS_URL}
      JWT_SECRET: ${PROD_JWT_SECRET}
      ENABLE_METRICS: true
      METRICS_PORT: 9091
    ports:
      - "3002:3002"
      - "9091:9091"  # Metrics port
    networks:
      - clms_network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3002/health"]
      interval: 15s
      timeout: 5s
      retries: 3

networks:
  clms_network:
    external: true
```

### Docker Deployment Scripts

#### Production Deployment Script
```bash
#!/bin/bash
# deploy-docker-production.sh

set -e

echo "🚀 Deploying CLMS to Production with Docker"

# Configuration
REGISTRY="your-registry.com"
VERSION="2.0.0"
ENVIRONMENT="production"

# Build and push images
echo "📦 Building and pushing Docker images..."

# Backend
docker build -t ${REGISTRY}/clms/backend:${VERSION} -f Backend/Dockerfile ./Backend
docker push ${REGISTRY}/clms/backend:${VERSION}

# Frontend
docker build -t ${REGISTRY}/clms/frontend:${VERSION} -f Frontend/Dockerfile ./Frontend
docker push ${REGISTRY}/clms/frontend:${VERSION}

# WebSocket
docker build -t ${REGISTRY}/clms/websocket:${VERSION} -f Backend/Dockerfile.websocket ./Backend
docker push ${REGISTRY}/clms/websocket:${VERSION}

# Deploy to production server
echo "🚀 Deploying to production server..."

# Create production network if it doesn't exist
docker network create clms_network || true

# Stop existing containers
docker-compose -f docker-compose.prod.yml down || true

# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 30

# Health check
echo "🏥 Performing health check..."
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Backend health check passed"
else
    echo "❌ Backend health check failed"
    exit 1
fi

if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Frontend health check passed"
else
    echo "❌ Frontend health check failed"
    exit 1
fi

echo "✅ Deployment completed successfully!"
echo "🌐 Application is available at: http://localhost"
```

#### Docker Monitoring Script
```bash
#!/bin/bash
# monitor-docker.sh

echo "📊 CLMS Docker Container Status"

# Check container status
docker-compose -f docker-compose.prod.yml ps

# Check resource usage
echo ""
echo "📈 Resource Usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

# Check logs for errors
echo ""
echo "🔍 Recent Errors:"
docker-compose -f docker-compose.prod.yml logs --tail=50 | grep -i error || echo "No errors found"

# Check health status
echo ""
echo "🏥 Health Status:"
for service in backend frontend websocket; do
    health=$(docker inspect --format='{{.State.Health.Status}}' clms_${service}_prod 2>/dev/null || echo "unknown")
    echo "  ${service}: ${health}"
done
```

**3. Monthly Maintenance**
```bash
#!/bin/bash
# monthly-maintenance.sh

echo "Starting monthly maintenance at $(date)"

# Full database backup
/opt/clms/scripts/backup-database.sh

# Archive old audit logs
mysql -u root -p -e "
  CREATE TABLE IF NOT EXISTS audit_logs_archive LIKE clms_database.audit_logs;
  INSERT INTO audit_logs_archive
  SELECT * FROM clms_database.audit_logs
  WHERE timestamp < DATE_SUB(NOW(), INTERVAL 1 YEAR);
  DELETE FROM clms_database.audit_logs
  WHERE timestamp < DATE_SUB(NOW(), INTERVAL 1 YEAR);
"

# Update application dependencies
cd /opt/clms/Backend
npm audit fix
cd ../Frontend
npm audit fix

# Performance analysis
/opt/clms/scripts/performance-analysis.sh

# Security scan
/opt/clms/scripts/security-scan.sh

echo "Monthly maintenance completed at $(date)"
```

This comprehensive deployment and operations guide provides everything needed to successfully deploy, monitor, and maintain the CLMS system in a production environment, ensuring high availability, performance, and reliability.