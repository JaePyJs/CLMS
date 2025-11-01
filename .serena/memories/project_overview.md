# Project Overview
- **Purpose**: Centralized Library Management System (CLMS) that digitizes student, book, and equipment workflows with audit trails, analytics, and automation.
- **Structure**: Monorepo with `Backend/` (Express + Prisma API) and `Frontend/` (React 19 dashboard); shared docs and infrastructure tooling at repo root.
- **Key Services**: Error monitoring, security auditing, FERPA compliance, barcode/QR generation, Bull/Redis job orchestration, Google Sheets sync.
- **Deployment**: Docker Compose orchestration with MySQL and Redis; production-oriented configs plus extensive documentation packs.
