# CLMS Production Deployment - Windows Quick Guide

## Prerequisites Checklist
- [ ] Docker Desktop for Windows installed and running
- [ ] Google credentials JSON file ready
- [ ] Network access to 192.168.0.126 (or update IP in .env.production)

## Step-by-Step Deployment

### 1. Verify Google Credentials
```powershell
# Check if google-credentials.json exists in project root
Test-Path .\google-credentials.json
# Should return: True

# If False, copy your google-credentials.json to the project root
Copy-Item "C:\path\to\your\google-credentials.json" -Destination ".\google-credentials.json"
```

### 2. Verify Environment Configuration
```powershell
# Check .env.production file
Get-Content .\.env.production | Select-String "MYSQL_ROOT_PASSWORD|JWT_SECRET|SHEETS_SPREADSHEET_ID"

# Should show:
# - Strong random passwords (NOT "change-me-...")
# - JWT secrets (64+ characters)
# - Your Google Sheets Spreadsheet ID
```

### 3. Update IP Address (If Needed)
If your server IP is different from 192.168.0.126:

```powershell
# Edit .env.production
notepad .\.env.production

# Update these lines with your server IP:
# FRONTEND_URL=http://YOUR_IP:8080
# ALLOWED_ORIGINS=http://YOUR_IP:8080
# PUBLIC_API_URL=http://YOUR_IP:3001
# PUBLIC_WS_URL=ws://YOUR_IP:3001
```

### 4. Start Production Services
```powershell
# Build and start all services
docker-compose -f docker-compose.prod.yml up -d --build

# This will:
# - Build backend and frontend images
# - Start MySQL, Redis, Backend, Frontend
# - Run health checks
```

### 5. Monitor Deployment
```powershell
# Check service status
docker-compose -f docker-compose.prod.yml ps

# All services should show "Up (healthy)" after 2-3 minutes

# Watch backend logs
docker-compose -f docker-compose.prod.yml logs -f backend

# Look for: "🚀 Server running on 0.0.0.0:3001 in production mode"
# Press Ctrl+C to stop following logs
```

### 6. Initialize Database
```powershell
# Run database migrations
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# Seed initial data (if needed)
docker-compose -f docker-compose.prod.yml exec backend npm run db:seed
```

### 7. Create Admin User
```powershell
# Use the create-librarian script
node create-librarian.js

# Follow prompts to create your admin account
```

### 8. Access the Application
```
Frontend: http://192.168.0.126:8080
Backend API: http://192.168.0.126:3001
```

## Troubleshooting

### Backend shows "unhealthy"
```powershell
# Check backend logs
docker-compose -f docker-compose.prod.yml logs backend

# Common issues:
# 1. Missing google-credentials.json
Test-Path .\google-credentials.json

# 2. Database not ready
docker-compose -f docker-compose.prod.yml logs mysql

# 3. Environment variables missing
docker-compose -f docker-compose.prod.yml exec backend printenv | Select-String "DATABASE_URL|JWT_SECRET"

# Fix: Rebuild backend
docker-compose -f docker-compose.prod.yml up -d --build --no-cache backend
```

### Cannot access frontend
```powershell
# Check frontend logs
docker-compose -f docker-compose.prod.yml logs frontend

# Verify frontend is running
docker-compose -f docker-compose.prod.yml ps frontend

# Test if port is accessible
Test-NetConnection -ComputerName 192.168.0.126 -Port 8080
```

### MySQL connection errors
```powershell
# Test MySQL connection
docker-compose -f docker-compose.prod.yml exec mysql mysql -u clms_user -p clms_database
# Enter password when prompted (from .env.production)

# Reset MySQL if needed (WARNING: Deletes all data)
docker-compose -f docker-compose.prod.yml down
docker volume rm clms_mysql_data_prod
docker-compose -f docker-compose.prod.yml up -d
```

### Redis connection errors
```powershell
# Test Redis
docker-compose -f docker-compose.prod.yml exec redis redis-cli -a "YOUR_REDIS_PASSWORD" ping
# Should return: PONG
```

## Quick Commands

```powershell
# View all logs
docker-compose -f docker-compose.prod.yml logs -f

# View specific service logs
docker-compose -f docker-compose.prod.yml logs -f backend

# Restart a service
docker-compose -f docker-compose.prod.yml restart backend

# Stop all services
docker-compose -f docker-compose.prod.yml down

# Stop and remove all data (CAUTION)
docker-compose -f docker-compose.prod.yml down -v

# Check service health
docker-compose -f docker-compose.prod.yml ps

# Execute command in container
docker-compose -f docker-compose.prod.yml exec backend sh
```

## Health Check Endpoints

```powershell
# Test backend health
Invoke-WebRequest -Uri "http://192.168.0.126:3001/health" -UseBasicParsing

# Should return: Status 200 OK

# Test frontend
Invoke-WebRequest -Uri "http://192.168.0.126:8080" -UseBasicParsing
```

## Backup Before Going Live

```powershell
# Create backups directory
New-Item -ItemType Directory -Force -Path .\backups

# Backup database
docker-compose -f docker-compose.prod.yml exec mysql mysqldump -u root -p clms_database > "backups\backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"

# Backup .env.production
Copy-Item .\.env.production -Destination "backups\.env.production.$(Get-Date -Format 'yyyyMMdd')"

# Backup google credentials
Copy-Item .\google-credentials.json -Destination "backups\google-credentials.$(Get-Date -Format 'yyyyMMdd').json"
```

## Production Checklist

Before going live, verify:

- [ ] All containers show "Up (healthy)" status
- [ ] Backend logs show successful startup
- [ ] Can access frontend at http://192.168.0.126:8080
- [ ] Can login with admin credentials
- [ ] Google Sheets integration working (test a student activity)
- [ ] Database persists after restart
- [ ] Backups configured and tested
- [ ] Firewall rules configured (if needed)
- [ ] Strong passwords in .env.production
- [ ] google-credentials.json is secure and valid

## Security Reminders

- ✅ .env.production contains strong random passwords
- ✅ google-credentials.json is read-only in container
- ✅ Non-root user runs backend
- ✅ Network isolation with Docker networks
- ⚠️ Consider adding HTTPS/TLS (nginx reverse proxy)
- ⚠️ Enable Windows Firewall rules if needed
- ⚠️ Regular backups scheduled

## Support

If issues persist after troubleshooting:
1. Check all logs: `docker-compose -f docker-compose.prod.yml logs`
2. Verify google-credentials.json is valid JSON
3. Ensure all ports are available
4. Check Windows Firewall isn't blocking ports
5. Verify Docker Desktop has enough resources (Settings > Resources)

## Success Indicators

✅ **System is ready when:**
- All 4 containers (mysql, redis, backend, frontend) show "healthy"
- Backend logs: "🚀 Server running on 0.0.0.0:3001 in production mode"
- Frontend accessible in browser
- Can login with admin account
- No error messages in logs

## Next Steps After Deployment

1. Create additional user accounts
2. Import books/equipment data
3. Configure library sections
4. Set up borrowing policies
5. Test Google Sheets sync
6. Train staff on system usage
7. Schedule regular backups
