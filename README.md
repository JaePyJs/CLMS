# CLMS (Comprehensive Library Management System)

CLMS is a professional full-stack platform that digitizes educational library operations. It covers student activity tracking, inventory, barcode and QR generation, and background automation while running entirely on local infrastructure.

## Project Overview

This repository contains both the backend API (Express + Prisma) and the React dashboard. The system targets library staff operations with support for multi-user expansion via role-based access control.

### Key Features

- Student, book, and equipment management with unified history and audit trails
- Production-ready barcode and QR code pipelines (batch generation, printable sheets, Google Sheets sync)
- USB barcode scanner workflows for fast check-in/out with offline queueing
- Automation layer using Bull + Redis for scheduled jobs, imports, and backups
- Real-time dashboard with TanStack Query caching, analytics, and notifications
- Docker-based infrastructure for MySQL, Redis, Koha mirror, backend, and frontend

### Architecture Diagram (Conceptual)

- **Frontend:** Vite + React SPA served on port 3000
- **Backend:** Express API with Prisma ORM served on port 3001
- **Database:** MySQL (primary) with optional Koha read replica for legacy data
- **Cache & Queues:** Redis for Bull job queues and rate limiting
- **Integrations:** Google Sheets service account; optional external automation via scripts

## Technology Stack

### Frontend

- React 18 with TypeScript and Vite
- shadcn/ui (Radix primitives), Tailwind CSS, Framer Motion, Sonner toasts
- State/query management via TanStack Query and Zustand
- ZXing (browser) for barcode/QR scanning with keyboard wedge support

### Backend

- Node.js 20+, Express, Prisma ORM, and TypeScript
- Bull queues backed by Redis for automation and scheduled jobs
- Google Sheets API, ExcelJS, CSV parsers, PDF-Lib for data exchange
- Winston logging, Helmet, compression, and express-rate-limit for resilience

### DevOps & Tooling

- Docker Compose for local orchestration (MySQL, Redis, Adminer, Koha, backend, frontend)
- Vitest + Testing Library for unit/integration tests
- ESLint, Prettier, Husky, and lint-staged for code quality
- GitHub Actions CI/CD (see `.github/workflows/ci.yml`)

## Quick Start

### Prerequisites

- Node.js v20+ (Required - matches CI/CD environment)
- Docker Desktop (or native Docker + Compose)
- Git

### Clone

```powershell
git clone https://github.com/JaePyJs/CLMS.git
cd CLMS
```

### Install Dependencies

```powershell
cd Backend
npm install
cd ..\Frontend
npm install
```

### Environment Setup

- Copy `Backend/.env.example` to `Backend/.env` and configure database, JWT secrets, Google credentials paths, and rate limit settings.
- Copy `Frontend/.env.example` to `Frontend/.env` to configure API endpoints and feature flags.

### Start Supporting Services

```powershell
cd ..
docker-compose up -d mysql redis koha-mysql adminer
```

### Run the Stack (Dev Mode)

```powershell
# Backend API
cd Backend
npm run dev

# Frontend
cd ..\Frontend
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3001`
- Adminer: `http://localhost:8080`

### Seed & Test (Optional)

```powershell
cd ..\Backend
npm run db:push
npm run db:seed
npm test

cd ..\Frontend
npm test
```

## Key Scripts

(Run from `Backend/` unless noted.)

- `npm run generate:barcodes` – Batch-generate student barcodes + HTML sheets
- `npm run generate:qr` – Batch-generate QR codes
- `npm run sync:qr` – Push barcode/QR metadata to Google Sheets
- `npm run import:data` – Bulk import students/books/equipment
- `npm run db:reset` – Recreate schema and reseed
- `Frontend/: npm run build` – Production bundle

## Project Structure

```text
CLMS/
├── Backend/                # Express API, Prisma, scripts, uploads, dist
├── Frontend/               # React dashboard, assets, tests
├── Docs/                   # Guides (barcode, QR, database setup, overview)
├── docker/                 # MySQL, Redis, Koha configuration
├── scripts/                # Standalone JS utilities
├── docker-compose.yml      # Local infrastructure stack
├── Current_Students.json   # Sample data / import template
└── README.md
```

### Backend Highlights

- `src/app.ts` – Express bootstrap, middleware, routing, health checks
- `src/routes/*` – REST endpoints grouped by domain (students, utilities, automation, etc.)
- `src/services/*` – Business logic: barcode/QR generation, Google Sheets, automation
- `src/utils/*` – Logger, Prisma client, error handling, scheduler wrappers
- `scripts/` – TS entrypoints executed with `tsx` (seed, import, barcode generation)
- `barcodes/` & `qr-codes/` – Generated assets with JSON reports and printable HTML

### Frontend Highlights

- `src/App.tsx` – Top-level layout with tabbed navigation & keyboard shortcuts
- `src/components/dashboard/*` – Feature-focused dashboards (scan workspace, analytics, barcode/QR manager)
- `src/hooks/api-hooks.ts` – TanStack Query hooks for backend endpoints
- `src/lib/*` – Axios client, offline queue, scanner utilities
- `src/contexts/AuthContext.tsx` – Auth state and route guards
- `src/test/*` – Vitest + Testing Library setup

## Documentation

- `CLAUDE.md` – Platform architecture guidance and development principles
- `CONTRIBUTING.md` – Contribution guidelines and development workflow
- `BARCODE_GUIDE.md` & `BARCODE_IMPLEMENTATION_SUMMARY.md` – Deep dives into barcode workflow
- `QR_CODE_GUIDE.md` – QR generation and distribution
- `USB_SCANNER_SETUP.md` – Hardware setup for USB scanners
- `Docs/codebase-overview.md` – Architectural summary and onboarding checklist
- `Docs/database-setup.md` – Database provisioning details

## Deployment Notes

- Dockerfile `Backend/Dockerfile` builds a production-ready API image (uses `dist/` output).
- Frontend build output served by Vite preview or any static host (`npm run build` → `dist/`).
- Ensure `google-credentials.json` is mounted or copied for production environments needing Google Sheets.
- Consider enabling HTTPS termination via reverse proxy when exposing beyond localhost.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/name`)
3. Commit changes (`git commit -m "feat: add ..."`)
4. Push and open a Pull Request

## License

Licensed under the MIT License – see [LICENSE](LICENSE) for details.

## Troubleshooting

### Common Issues

**Database Connection Issues**
```bash
# Check Docker containers are running
docker-compose ps

# Check MySQL logs
docker-compose logs mysql

# Restart database services
docker-compose restart mysql redis
```

**Backend Won't Start**
```bash
# Check Node.js version (requires v20+)
node --version

# Clear node_modules and reinstall
cd Backend
rm -rf node_modules package-lock.json
npm install

# Check environment variables
cat .env | grep DATABASE_URL
```

**Frontend Build Issues**
```bash
# Clear cache and reinstall
cd Frontend
rm -rf node_modules package-lock.json dist
npm install
npm run build
```

**Authentication Issues**
- Verify JWT_SECRET is set in Backend/.env
- Check that CORS_ORIGIN matches frontend URL
- Ensure user exists in database (run npm run cli)

**Google Sheets Integration Issues**
- Verify google-credentials.json exists and has correct permissions
- Check GOOGLE_SPREADSHEET_ID is correct
- Test connection: `curl http://localhost:3001/api/health`

**Barcode Scanner Not Working**
- Check VITE_BARCODE_SCANNER_MODE in Frontend/.env
- Ensure scanner is in keyboard wedge mode
- Test with manual input first

**Tests Failing**
```bash
# Run tests with verbose output
cd Backend && npm test -- --verbose
cd Frontend && npm test -- --verbose

# Reset test database
cd Backend && npm run db:reset
```

### Performance Issues

**Slow API Response**
- Check Redis connection: `docker-compose logs redis`
- Monitor database performance: use Adminer at http://localhost:8080
- Check automation job queue status in backend logs

**Frontend Loading Slow**
- Disable TanStack Query dev tools in production
- Check network tab for API response times
- Verify asset compression in build output

### Environment-Specific Issues

**Windows Development**
- Use PowerShell commands as shown in README
- Ensure Windows long paths are enabled
- Use Git Bash or WSL for better compatibility

**Mac Development**
- Install Docker Desktop for Mac
- Use `./scripts/start-dev.sh` if available
- Check for port conflicts with system services

## Support

- Create an issue in this repository
- Review docs inside `Docs/`
- Contact the maintainers via GitHub issues

---

Built with ❤️ for educational library management professionals.
