# CLMS - Centralized Library Management System

A full-stack library management system built with TypeScript, React, and Express for educational institutions.

## 🎯 Project Status

**Version:** 1.0.3  
**Status:** Active Development  
**Last Updated:** November 2025

### What's Working

✅ **Backend (Express + TypeScript + Prisma)**

- 24 API route modules
- MySQL database with Prisma ORM
- JWT authentication
- WebSocket support (Socket.IO)
- File uploads (students, books CSV import)
- Barcode/QR generation

✅ **Frontend (React 18.3.1 + Vite + TypeScript)**

- 151 React components
- Tab-based navigation
- Real-time WebSocket updates
- Form validation with Zod
- Dark mode support
- Responsive design

✅ **Core Features**

- Student management
- Book catalog and checkout system
- Equipment tracking
- Attendance kiosk mode
- CSV data import
- Analytics and reports
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
- **Database**: MySQL with Prisma ORM
- **Auth**: JWT + bcrypt
- **Queue**: Bull + Redis
- **Logging**: Winston
- **Validation**: Zod

### DevOps

- **Docker Compose** for local development
- **Playwright** for E2E testing
- **Vitest** for unit tests
- **ESLint** + **Prettier** for code quality

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
- Import from CSV
- Activity tracking
- Barcode generation

### Book Catalog

- ISBN lookup
- Checkout/return workflow
- Fine calculation
- Search and filters

### Attendance System

- Self-service kiosk mode
- Real-time attendance display
- Auto check-in/out
- Custom welcome messages

### Analytics & Reports

- Usage statistics
- Circulation reports
- Equipment tracking
- Custom report builder

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
DATABASE_URL="mysql://user:password@localhost:3306/clms"
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

- `/api/auth` - Authentication
- `/api/students` - Student CRUD
- `/api/books` - Book catalog
- `/api/borrows` - Checkout system
- `/api/equipment` - Equipment tracking
- `/api/analytics` - Statistics
- `/api/import` - CSV import
- `/api/kiosk` - Self-service endpoints

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
- **MySQL**: 8.0+
- **RAM**: 4GB minimum
- **Storage**: 2GB+ for dependencies

## 📞 Support

For issues and questions:

1. Check existing GitHub issues
2. Create a new issue with detailed description
3. Include error logs and system information

---

**Built with ❤️ for educational institutions**
