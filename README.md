# CLMS - Centralized Library Management System

A full-stack library management system built with TypeScript, React, and Express for educational institutions.

## 🎯 Project Status

**Version:** 1.0.3  
**Status:** Production Ready ✅  
**Last Updated:** December 2025

### Overall Health: 🟢 Excellent

- All critical issues fixed
- TypeScript compiles clean
- 78 features tested, 61 passed, 0 failed
- SQLite database (migrated from MySQL)

### What's Working

✅ **Backend (Express + TypeScript + Prisma)**

- 24 API route modules
- SQLite database with Prisma ORM
- JWT authentication with refresh tokens
- WebSocket support (Socket.IO) for real-time updates
- File uploads (students, books CSV import)
- Barcode/QR generation
- Fine calculation service (flat ₱40 fine, lost book penalties)

✅ **Frontend (React 18.3.1 + Vite + TypeScript)**

- 151 React components
- Scrollable tab-based navigation
- Real-time WebSocket updates
- Form validation with Zod
- Dark mode support
- Responsive design
- Drag-and-drop student room assignments

✅ **Core Features**

- Student management (881 students supported)
- Book catalog (2,977 books) and checkout system
- Equipment/Room tracking with session management
- Attendance kiosk mode with barcode scanning
- CSV data import for students and books
- Activity history with CSV export
- Analytics, reports, and leaderboards
- Printing services with pricing configuration
- Settings and administration

## 🛠 Tech Stack

### Frontend

- **React** 18.3.1 with TypeScript 5.6
- **Vite** 5.4 for fast development
- **UI**: Radix UI primitives + Tailwind CSS
- **State**: TanStack Query + Zustand
- **Forms**: React Hook Form + Zod
- **Real-time**: Socket.IO Client

### Backend

- **Node.js** 20+ with Express 4.21
- **TypeScript** 5.7
- **Database**: SQLite with Prisma ORM
- **Auth**: JWT + bcrypt
- **Real-time**: Socket.IO
- **Logging**: Winston
- **Validation**: Zod

### DevOps

- **Docker Compose** for local development
- **Playwright** for E2E testing
- **Vitest** for unit tests
- **ESLint** + **Prettier** for code quality
- **Husky** for pre-commit hooks

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Git

### Starting the Application

1. Double-click `START_CLMS.bat` (Windows)
2. Wait for Backend (port 3001) and Frontend (port 3000) to start
3. Browser will open automatically to http://localhost:3000

### First-Time Setup

Create your admin account using the setup script:

```bash
cd Backend
npx tsx src/scripts/create_test_admin.ts
```

⚠️ **Security Note:** Create your own secure credentials. Never use default passwords in production!\*\*

## 📁 Project Structure

```
CLMS/
├── Backend/
│   ├── src/
│   │   ├── routes/         # 24 API endpoints
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Auth, validation, error handling
│   │   ├── utils/          # Helpers
│   │   └── index.ts        # Entry point
│   ├── prisma/             # Database schema
│   └── package.json        # v2.0.0
│
├── Frontend/
│   ├── src/
│   │   ├── components/     # 151 React components
│   │   ├── hooks/          # Custom hooks
│   │   ├── lib/            # API client, utilities
│   │   └── main.tsx        # Entry point
│   └── package.json        # v1.0.0
│
├── docker-compose.yml      # Development setup
├── package.json            # Root workspace (v1.0.3)
└── README.md
```

## 📖 Key Features

### Student Management

- Add/edit/delete students
- Import from CSV (881+ students)
- Activity tracking with real-time status
- Barcode generation
- Contact parent (mailto/phone)
- Award system with notes

### Book Catalog

- 2,977+ book catalog support
- ISBN lookup
- Checkout/return workflow
- Fine calculation (₱5/day overdue, ₱40 flat fine, lost book penalties)
- Search and filters (case-insensitive)
- Material type policies

### Equipment/Room Management

- 6+ room/equipment tracking
- Session time limits
- Drag-and-drop student assignments
- Real-time availability status
- Usage statistics
- Room settings and deletion

### Attendance System

- Self-service kiosk mode
- Barcode scanner support (USB)
- Real-time attendance display
- Auto check-in/out (15-min cooldown)
- Personnel identification (PN prefix)
- Custom welcome/thank you screens

### Analytics & Reports

- Activity history with export to CSV
- Usage statistics dashboard
- Circulation reports
- Leaderboard (monthly/yearly)
- Real-time connection status

### Printing Services

- Print job logging
- Pricing configuration
- Student search (active only)
- Job history with export

## 🔧 Development

### Run Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# With UI
npm run test:e2e:ui
```

### Build for Production

```bash
# Frontend
cd Frontend && npm run build

# Backend
cd Backend && npm run build
```

### Database Management

```bash
cd Backend

# Generate Prisma client
npm run db:generate

# Push schema changes
npm run db:push

# Open Prisma Studio
npm run db:studio
```

## 📝 Environment Variables

Create `.env` files:

**Backend/.env**

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-key"
PORT=3001
NODE_ENV=development
```

**Frontend/.env**

```env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=http://localhost:3001
```

## 🐳 Docker Deployment

```bash
# Development
docker-compose up

# Production
docker-compose -f docker-compose.prod.yml up -d
```

## 📊 API Documentation

The backend exposes 24 route modules including:

- `/api/auth` - Authentication (login, refresh, logout)
- `/api/students` - Student CRUD and search
- `/api/books` - Book catalog management
- `/api/borrows` - Checkout/return system
- `/api/equipment` - Room/equipment tracking
- `/api/analytics` - Statistics, metrics, activity history
- `/api/import` - CSV import for students/books
- `/api/kiosk` - Self-service check-in/out
- `/api/fines` - Fine management
- `/api/reports` - Report generation
- `/api/settings` - System configuration
- `/api/search` - Global search (case-insensitive)

## 📈 Testing Status

| Section          | Passed | Total  |
| ---------------- | ------ | ------ |
| Authentication   | 2      | 3      |
| Books            | 8      | 8      |
| Students         | 10     | 12     |
| Borrowing        | 5      | 7      |
| Printing         | 6      | 6      |
| Equipment        | 6      | 6      |
| Dashboard        | 5      | 5      |
| Scanner          | 5      | 11     |
| Settings         | 4      | 4      |
| Leaderboard      | 2      | 2      |
| Activity History | 7      | 7      |
| **TOTAL**        | **61** | **78** |

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 🔗 Links

- **Repository**: https://github.com/JaePyJs/CLMS
- **Issues**: https://github.com/JaePyJs/CLMS/issues

## ⚙️ System Requirements

- **Node.js**: 20.0.0 or higher
- **NPM**: 10.0.0 or higher
- **RAM**: 4GB minimum
- **Storage**: 2GB+ for dependencies

> **Note:** Redis is optional. The system works without it (caching simply disabled).

## 🐛 Known Issues

- Books page occasionally shows "Page Error" on module load (reload fixes it)
- Some features need manual testing (kiosk check-in, book return)

## 📞 Support

For issues and questions:

1. Check existing GitHub issues
2. Create a new issue with detailed description
3. Include error logs and system information

---

**Built with ❤️ for educational institutions**
