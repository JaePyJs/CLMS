# CLMS Library Deployment Guide
**Version:** 2.0 Production Ready
**Date:** 2025-11-19

## ✅ PRE-DEPLOYMENT CHECKLIST

**System Status:**
- ✅ All 107 TypeScript errors fixed (0 errors)
- ✅ All AI/legacy folders removed from repository
- ✅ Production environment variables configured
- ✅ Docker compose files ready
- ✅ CSV data files included (books & students with barcodes)

---

## 📋 REQUIREMENTS

### Hardware
- CPU: Dual-core or better
- RAM: 4GB minimum (8GB recommended)
- Storage: 20GB free space
- Network: LAN connection (192.168.x.x)

### Software
- Windows Server 2016+ or Windows 10/11
- Docker Desktop for Windows (latest version)
- Git (for cloning repository)

---

## 🚀 INSTALLATION STEPS

### Step 1: Clone Repository
```powershell
cd C:\
git clone https://github.com/JaePyJs/CLMS.git
cd CLMS
```

### Step 2: Configure Environment
1. Copy production environment file:
   ```powershell
   copy .env.production .env
   ```

2. Edit `.env` and update:
   - `MYSQL_ROOT_PASSWORD` - Change to strong password
   - `MYSQL_PASSWORD` - Change to strong password
   - `REDIS_PASSWORD` - Change to strong password
   - `JWT_SECRET` - Generate new 64-char random string
   - `JWT_REFRESH_SECRET` - Generate new 64-char random string
   - `FRONTEND_URL` - Your library PC's IP (e.g., http://192.168.0.126:8080)
   - `ALLOWED_ORIGINS` - Same as FRONTEND_URL
   - `PUBLIC_API_URL` - Your library PC's IP (e.g., http://192.168.0.126:3001)
   - `PUBLIC_WS_URL` - Your library PC's IP (e.g., ws://192.168.0.126:3001)

### Step 3: Setup Google Sheets (Optional)
1. Create a `credentials` folder in the root directory
2. Place your `google-credentials.json` inside it
3. Update in `.env`:
   - `SHEETS_SPREADSHEET_ID` - Your Google Sheet ID
   - `SHEETS_FOLDER_ID` - Your Google Drive folder ID

### Step 4: Import Data
1. Place your CSV files in `csv/` folder:
   - `SHJCS Bibliography - BOOK COLLECTIONS.csv`
   - `SHJCS SCANLOGS - SHJCS USERS.csv`

### Step 5: Start Application
```powershell
# Pull latest Docker images
docker-compose pull

# Start all services
docker-compose up -d

# Check status
docker-compose ps
```

### Step 6: Initialize Database
```powershell
# Wait 30 seconds for MySQL to be ready
Start-Sleep -Seconds 30

# Run database migration
docker-compose exec backend npx prisma migrate deploy

# Import CSV data
docker-compose exec backend node src/scripts/importCsv.js
```

### Step 7: Create Admin User
```powershell
# Create librarian account
docker-compose exec backend node create-librarian.js
```

---

## 🌐 ACCESS THE SYSTEM

**Frontend (Main Interface):**
- URL: http://YOUR-IP:8080
- Example: http://192.168.0.126:8080

**Default Login:**
- Username: librarian
- Password: (created in Step 7)

---

## 🔧 TROUBLESHOOTING

### Backend Unhealthy
```powershell
# Check logs
docker-compose logs backend

# Restart backend
docker-compose restart backend
```

### Database Connection Error
```powershell
# Check MySQL is running
docker-compose ps mysql

# Check MySQL logs
docker-compose logs mysql
```

### Cannot Access from Other Computers
1. Check Windows Firewall - Allow ports 3001 and 8080
2. Verify IP address: `ipconfig`
3. Update `.env` with correct IP
4. Restart containers: `docker-compose restart`

---

## 📊 VERIFY INSTALLATION

1. **Frontend loads:** http://YOUR-IP:8080
2. **Login works:** Use librarian credentials
3. **Books visible:** Check Books Management tab
4. **Students visible:** Check Students tab
5. **Kiosk works:** Try check-in/check-out

---

## 🛑 STOP THE SYSTEM

```powershell
docker-compose down
```

## 🔄 UPDATE THE SYSTEM

```powershell
# Pull latest code
git pull

# Rebuild and restart
docker-compose down
docker-compose up -d --build
```

---

## 📞 SUPPORT

For issues, check:
1. Docker logs: `docker-compose logs`
2. System requirements met
3. Network configuration correct
4. Firewall settings

---

**Installation Complete! 🎉**
