# CLMS Scripts Directory

This directory contains utility scripts for maintenance and deployment of the CLMS application.

## ⚠️ IMPORTANT: Docker-First Approach

**Most development and deployment operations are now handled through Docker Compose.**

Use these commands from the **project root**:

### Development Commands
```bash
# Start development environment (hot-reload enabled)
npm start                  # or: docker-compose up
start-dev.bat             # Windows: double-click to start

# Stop development
npm stop                  # or: docker-compose down
stop-dev.bat             # Windows: double-click to stop

# View logs
npm run logs             # or: docker-compose logs -f

# Restart services
npm run restart          # or: docker-compose restart

# Clean everything (including volumes)
npm run clean            # or: docker-compose down -v
```

### Production Commands
```bash
# Start production environment
npm run prod             # or: docker-compose -f docker-compose.prod.yml up -d
start-prod.bat          # Windows: double-click to start

# Stop production
npm run stop:prod       # or: docker-compose -f docker-compose.prod.yml down
stop-prod.bat          # Windows: double-click to stop

# View production logs
npm run logs:prod       # or: docker-compose -f docker-compose.prod.yml logs -f

# Check service status
npm run ps              # or: docker ps
```

## Available Scripts (Maintenance Only)

### Deployment & Rollback

#### `rollback-procedures.sh`
Contains procedures for rolling back deployments in case of issues.

**Usage:**
```bash
./scripts/rollback-procedures.sh [version]
```

## Docker Service Management

### Backend Operations
```bash
# Access backend container
docker-compose exec backend sh

# Run database migrations
docker-compose exec backend npm run db:push

# Generate Prisma client
docker-compose exec backend npm run db:generate

# Open Prisma Studio
docker-compose exec backend npm run db:studio

# Seed database
docker-compose exec backend npm run db:seed
```

### Database Operations
```bash
# Access MySQL CLI
docker-compose exec mysql mysql -u clms_user -pclms_password clms_database

# Database backup
docker-compose exec mysql mysqldump -u clms_user -pclms_password clms_database > backup.sql

# Restore database
docker-compose exec -T mysql mysql -u clms_user -pclms_password clms_database < backup.sql
```

### Logs and Debugging
```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mysql
docker-compose logs -f redis

# Check service health
docker-compose ps
```

## Script Guidelines

1. **Use Docker-first approach** - New scripts should leverage Docker Compose
2. **Run from project root** - Scripts expect to be run from CLMS root directory
3. **Check permissions** - Ensure shell scripts have execute permissions (`chmod +x script.sh`)
4. **Environment variables** - Configure `.env` or `.env.production` files as needed

## Creating New Scripts

When adding new scripts:
1. Consider if Docker Compose can handle it first
2. Place scripts in this directory
3. Follow naming conventions (kebab-case)
4. Add proper documentation headers
5. Update this README
6. Make scripts work with Docker containers

## Common Issues

### Docker Not Running
Ensure Docker Desktop is running:
```bash
docker --version
docker ps
```

### Services Won't Start
```bash
# Check for port conflicts
docker-compose ps
netstat -ano | findstr :3000
netstat -ano | findstr :3001

# Clean restart
npm run clean
npm start
```

### Permission Denied (Linux/Mac)
```bash
chmod +x scripts/*.sh
```

### PowerShell Execution Policy (Windows)
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Hot-Reload Not Working
```bash
# Rebuild containers
docker-compose down
docker-compose build --no-cache
docker-compose up
```

## Support

For issues:
1. Check Docker service status: `docker ps`
2. Review environment configuration: `.env` or `.env.production`
3. Check service logs: `npm run logs`
4. Verify Node.js version: `node --version` (required: >=20.0.0)
5. Check Docker Compose version: `docker-compose --version`

## File Structure
```
scripts/
├── README.md                    # This file
└── rollback-procedures.sh       # Deployment rollback procedures
```

## Archived/Removed Scripts

The following scripts have been **removed** as their functionality is now handled by Docker Compose:
- ~~`start-development.ps1`~~ → Use `npm start` or `start-dev.bat`
- ~~`start-development.sh`~~ → Use `npm start` or `docker-compose up`
- ~~`stop-development.sh`~~ → Use `npm stop` or `stop-dev.bat`
- ~~`setup-clms.ps1`~~ → Use `npm start` (auto-setup via Docker)
- ~~`setup-clms.sh`~~ → Use `npm start` (auto-setup via Docker)
- ~~`quick-setup.bat`~~ → Use `start-dev.bat`
