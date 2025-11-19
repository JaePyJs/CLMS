# QUICK DEPLOYMENT AT LIBRARY

## On Library Server:

### 1. Pull Latest Changes
```bash
cd /path/to/CLMS
git pull origin 002-frontend-stability-auth-testing
```

### 2. Verify Google Credentials
```bash
# Make sure google-credentials.json is in the project root
ls -l google-credentials.json
```

### 3. Review Production Environment
```bash
cat .env.production

# Should show:
# - Strong MYSQL_ROOT_PASSWORD (NOT "change-me-root")
# - Strong MYSQL_PASSWORD (NOT "change-me-app")
# - Strong REDIS_PASSWORD (NOT "change-me-redis")
# - JWT secrets (64+ characters)
# - Google Sheets config (SHEETS_SPREADSHEET_ID, etc.)
```

### 4. Deploy
```bash
# Stop old containers
docker-compose -f docker-compose.prod.yml down

# Start with new config
docker-compose -f docker-compose.prod.yml up -d --build

# Watch logs
docker-compose -f docker-compose.prod.yml logs -f backend
```

### 5. Wait for Healthy Status (2-3 minutes)
```bash
docker-compose -f docker-compose.prod.yml ps

# All should show "Up (healthy)"
```

### 6. Initialize Database (if first time)
```bash
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

### 7. Access System
```
Frontend: http://192.168.0.126:8080
Backend:  http://192.168.0.126:3001
```

## Troubleshooting

### Backend unhealthy?
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs backend

# Look for:
# - "🚀 Server running on 0.0.0.0:3001 in production mode" = GOOD
# - Any errors about google-credentials.json = File missing
# - Database connection errors = MySQL not ready yet (wait)
```

### Still having issues?
```bash
# Rebuild everything
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build --no-cache
```

## What Was Fixed:

1. **Security** - All placeholder passwords replaced with strong random ones
2. **Google Sheets** - All environment variables now configured
3. **Docker** - Backend container gets all required environment variables
4. **Build** - Dockerfile no longer hides errors

## Important Notes:

- `.env.production` now has REAL passwords (keep it secret)
- `google-credentials.json` MUST be in project root
- Backend needs 60-120 seconds to start (waits for database)
- MySQL needs 30-40 seconds to start

## Success Indicators:

✅ All 4 containers show "Up (healthy)"
✅ Backend logs: "🚀 Server running"
✅ Can access frontend at http://192.168.0.126:8080
✅ No errors in any container logs
