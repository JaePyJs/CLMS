# CLMS Production Deployment Guide

## ✅ Production Readiness Checklist

### 1. **Prerequisites**
- [ ] Docker and Docker Compose installed on production server
- [ ] Git installed (for cloning/pulling updates)
- [ ] Minimum 4GB RAM, 2 CPU cores
- [ ] 20GB+ available disk space
- [ ] Port 3001 (Backend), 8080 (Frontend), 3308 (MySQL), 6379 (Redis) available

### 2. **Google Credentials Setup** (CRITICAL)

#### On Production Server:
```bash
# 1. Create credentials directory in project root
cd /path/to/CLMS
mkdir -p credentials

# 2. Copy your google-credentials.json to the credentials folder
# Transfer the file from your local machine via SCP/SFTP/USB
cp /path/to/your/google-credentials.json ./google-credentials.json

# 3. Verify file exists and has correct permissions
ls -l google-credentials.json
chmod 644 google-credentials.json
```

**Important:** The `google-credentials.json` file must be in the project root directory. Docker will mount it into the backend container.

### 3. **Environment Configuration**

The `.env.production` file has been configured with:
- ✅ Strong auto-generated passwords (MySQL, Redis)
- ✅ Strong JWT secrets (64+ characters)
- ✅ Google Sheets integration variables
- ✅ Production-grade security settings

**VERIFY YOUR SETTINGS:**
```bash
cat .env.production
```

**Update if needed:**
- `FRONTEND_URL` - Your production frontend URL
- `PUBLIC_API_URL` - Your production backend API URL
- `ALLOWED_ORIGINS` - Comma-separated allowed CORS origins
- `SHEETS_SPREADSHEET_ID` - Your Google Sheets ID
- `SHEETS_WORKSHEET_NAME` - Worksheet name
- `SHEETS_FOLDER_ID` - Google Drive folder ID

### 4. **Deployment Steps**

#### First Time Deployment:
```bash
# 1. Navigate to project directory
cd /path/to/CLMS

# 2. Ensure google-credentials.json exists
test -f google-credentials.json && echo "✅ Google credentials found" || echo "❌ Google credentials MISSING"

# 3. Build and start services
docker-compose -f docker-compose.prod.yml up -d --build

# 4. Check service health
docker-compose -f docker-compose.prod.yml ps

# 5. Monitor logs
docker-compose -f docker-compose.prod.yml logs -f backend
```

#### Subsequent Deployments (Updates):
```bash
# 1. Pull latest changes
git pull origin main

# 2. Rebuild and restart
docker-compose -f docker-compose.prod.yml up -d --build

# 3. Verify health
docker-compose -f docker-compose.prod.yml ps
```

### 5. **Database Initialization**

```bash
# Run Prisma migrations
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# Seed initial data (if needed)
docker-compose -f docker-compose.prod.yml exec backend npm run db:seed
```

### 6. **Create Initial Admin Account**

```bash
# Use the create-librarian script
docker-compose -f docker-compose.prod.yml exec backend node dist/scripts/createLibrarian.js
```

Or from host:
```bash
node create-librarian.js
```

### 7. **Health Checks**

```bash
# Check all services
docker-compose -f docker-compose.prod.yml ps

# Test backend API
curl http://192.168.0.126:3001/health

# Test frontend
curl http://192.168.0.126:8080

# Check MySQL
docker-compose -f docker-compose.prod.yml exec mysql mysqladmin ping -h localhost -p

# Check Redis
docker-compose -f docker-compose.prod.yml exec redis redis-cli -a <REDIS_PASSWORD> ping
```

### 8. **Common Issues & Solutions**

#### Backend is "unhealthy"
**Symptoms:** Backend container status shows "unhealthy"

**Diagnosis:**
```bash
# Check backend logs
docker-compose -f docker-compose.prod.yml logs backend

# Check if backend is listening
docker-compose -f docker-compose.prod.yml exec backend netstat -tlnp | grep 3001
```

**Common Causes:**
1. **Missing google-credentials.json**
   - Verify: `ls -l google-credentials.json`
   - Fix: Copy the file to project root

2. **Database connection failure**
   - Verify MySQL is healthy: `docker-compose -f docker-compose.prod.yml ps mysql`
   - Check DATABASE_URL in logs
   - Ensure MySQL user/password match .env.production

3. **TypeScript compilation errors**
   - Check build logs: `docker-compose -f docker-compose.prod.yml logs backend | grep "build"`
   - Rebuild: `docker-compose -f docker-compose.prod.yml up -d --build --no-cache backend`

4. **Missing environment variables**
   - Verify all required vars are set in .env.production
   - Check backend logs for "Missing critical environment variables"

#### MySQL connection errors
```bash
# Test MySQL connection
docker-compose -f docker-compose.prod.yml exec mysql mysql -u clms_user -p clms_database

# Reset MySQL if needed
docker-compose -f docker-compose.prod.yml down
docker volume rm clms_mysql_data_prod
docker-compose -f docker-compose.prod.yml up -d
```

#### Redis connection errors
```bash
# Test Redis
docker-compose -f docker-compose.prod.yml exec redis redis-cli -a <REDIS_PASSWORD> ping

# Should return: PONG
```

### 9. **Monitoring**

```bash
# Watch all logs
docker-compose -f docker-compose.prod.yml logs -f

# Watch specific service
docker-compose -f docker-compose.prod.yml logs -f backend

# Check resource usage
docker stats

# Check disk usage
docker system df
```

### 10. **Backup Strategy**

```bash
# Backup MySQL database
docker-compose -f docker-compose.prod.yml exec mysql mysqldump -u root -p clms_database > backup_$(date +%Y%m%d).sql

# Backup volumes
docker run --rm -v clms_mysql_data_prod:/data -v $(pwd)/backups:/backup alpine tar czf /backup/mysql_$(date +%Y%m%d).tar.gz -C /data .

# Backup google credentials
cp google-credentials.json backups/google-credentials-$(date +%Y%m%d).json
```

### 11. **Security Hardening**

- ✅ Non-root user in Docker containers
- ✅ Strong random passwords generated
- ✅ Read-only volume mounts for credentials
- ✅ Network isolation with Docker networks
- ✅ Health checks enabled
- ✅ Resource limits configured

**Additional recommendations:**
1. Use HTTPS/TLS in production (add nginx reverse proxy)
2. Enable firewall (ufw/firewalld)
3. Regular security updates
4. Monitor logs for suspicious activity
5. Regular backups (automated)

### 12. **Shutdown & Cleanup**

```bash
# Stop services
docker-compose -f docker-compose.prod.yml down

# Stop and remove volumes (CAUTION: deletes all data)
docker-compose -f docker-compose.prod.yml down -v

# Remove images
docker-compose -f docker-compose.prod.yml down --rmi all
```

## 🚀 Quick Start Production Deployment

```bash
# 1. Ensure google-credentials.json is in project root
test -f google-credentials.json && echo "✅ Ready" || echo "❌ Add google-credentials.json first"

# 2. Review and update .env.production
nano .env.production

# 3. Deploy
docker-compose -f docker-compose.prod.yml up -d --build

# 4. Check status
docker-compose -f docker-compose.prod.yml ps

# 5. Initialize database
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# 6. Create admin user
node create-librarian.js

# 7. Access application
# Frontend: http://192.168.0.126:8080
# Backend: http://192.168.0.126:3001
```

## 📊 Production Status Indicators

**All systems operational when:**
- ✅ All containers show "Up (healthy)"
- ✅ Backend logs show "🚀 Server running on 0.0.0.0:3001 in production mode"
- ✅ `curl http://192.168.0.126:3001/health` returns 200 OK
- ✅ Frontend loads without errors
- ✅ Can login with admin credentials

## 🆘 Emergency Contacts

If issues persist:
1. Check logs: `docker-compose -f docker-compose.prod.yml logs -f`
2. Verify environment variables are set
3. Ensure google-credentials.json exists and is valid
4. Check network connectivity between containers
5. Verify ports are not in use by other services

## 🔐 Security Notes

**IMPORTANT - Keep Secret:**
- `.env.production` contains sensitive passwords
- `google-credentials.json` contains Google API credentials
- MySQL root password: Store securely
- JWT secrets: Never commit to git

**Recommended:**
- Use environment-specific credentials
- Rotate passwords regularly
- Use secrets management (Docker secrets, Kubernetes secrets)
- Enable audit logging
- Regular security scans
