# CLMS - Centralized Library Management System

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-20%2B-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-5.0%2B-blue.svg)](https://www.typescriptlang.org)

A full-stack library management system built with TypeScript, React, and Express for educational institutions managing 880+ students and 2,900+ books.

---

## 📋 Overview

CLMS (Centralized Library Management System) is a comprehensive solution for school libraries featuring real-time kiosk check-in, book checkout management, equipment tracking, printing services, and detailed analytics.

**Production Stats**:

- 🎓 880+ students and personnel
- 📚 2,900+ books in catalog
- 🖨️ Printing job tracking with dynamic pricing
- 📊 Real-time analytics and leaderboards
- 🔄 Google Sheets integration for attendance/borrowing history

---

## ✨ Features

### 📚 Library Core

- **Book Catalog Management** - ISBN tracking, accession numbers, categories, availability status
- **Checkout/Return Workflow** - Due date calculation, fine management, renewal system
- **Borrowing Policies** - Grade-level based loan limits and duration rules
- **Fine Policies** - Automated fine calculation for overdue books

### 👥 Student & Personnel

- **Student Management** - CRUD operations, barcode generation, activity history
- **Personnel Tracking** - Faculty/staff library access monitoring
- **Barcode System** - Unique barcode generation for all users
- **Import/Export** - CSV and Google Sheets integration for bulk operations

### ⏱️ Kiosk & Attendance

- **Self-Service Kiosk** - Barcode scanner check-in/out with welcome display
- **Auto-Checkout** - 15-minute inactivity timeout
- **Real-Time Updates** - WebSocket-powered status synchronization
- **Multi-Display Support** - Secondary monitor kiosk screen
- **Google Sheets Sync** - Import/export attendance and borrowing history

### 🖨️ Printing Services

- **Print Job Logging** - Track all print requests with metadata
- **Dynamic Pricing** - Configurable rates for paper sizes and color levels
- **Cost Calculation** - Automatic total cost computation
- **Payment Tracking** - Mark jobs as paid/unpaid with receipt numbers

### 🏠 Equipment & Rooms

- **Equipment Management** - Computers, printers, projectors, etc.
- **Room Tracking** - Session-based room assignments
- **Drag-and-Drop UI** - Assign students to equipment visually
- **Session History** - Track usage patterns and durations

### 📊 Analytics & Reports

- **Usage Statistics** - Library visits, book circulation, equipment utilization
- **Leaderboards** - Monthly/yearly rankings (students only, excludes personnel)
- **Trend Analysis** - Time-series data visualization
- **CSV Exports** - Download reports for external analysis
- **Real-Time Dashboard** - WebSocket-powered live activity feed

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React 18)                      │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌──────────────┐ │
│  │Dashboard│  │ Students │  │  Books  │  │Equipment/    │ │
│  │         │  │          │  │         │  │ Printing     │ │
│  └────┬────┘  └────┬─────┘  └────┬────┘  └──────┬───────┘ │
│       │            │             │               │         │
│       └────────────┴─────────────┴───────────────┘         │
│                          │                                  │
│                    TanStack Query                           │
│                          │                                  │
└──────────────────────────┼──────────────────────────────────┘
                           │ HTTP + WebSocket
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend (Express 4)                       │
│  ┌─────────┐  ┌──────────┐  ┌────────────┐  ┌───────────┐ │
│  │  Auth   │  │  Routes  │  │  Services  │  │ WebSocket │ │
│  │         │  │  (33)    │  │            │  │  Server   │ │
│  └────┬────┘  └────┬─────┘  └─────┬──────┘  └─────┬─────┘ │
│       │            │               │               │        │
│       └────────────┴───────────────┴───────────────┘        │
│                          │                                  │
│                    Prisma ORM                               │
│                          │                                  │
└──────────────────────────┼──────────────────────────────────┘
                           ▼
                     SQLite Database
              (18 tables, 880+ students, 2900+ books)
```

### WebSocket Event Flow

```
┌──────────┐          ┌─────────────┐          ┌──────────────┐
│  Kiosk   │  scan    │   Backend   │  emit    │  Dashboard   │
│  Client  ├─────────▶│  WebSocket  ├─────────▶│   Clients    │
│          │          │   Server    │          │   (all)      │
└──────────┘          └─────────────┘          └──────────────┘
                            │
                            ▼
                      student_activities
                       (Prisma DB)
```

---

## 📊 Database Schema

| Table                        | Records    | Description                               |
| ---------------------------- | ---------- | ----------------------------------------- |
| `users`                      | ~10        | Librarian accounts with role-based access |
| `students`                   | 880+       | Students and personnel with barcodes      |
| `books`                      | 2,900+     | Book catalog with ISBN, accession numbers |
| `book_checkouts`             | Active     | Current and historical borrowing records  |
| `student_activities`         | 1,000s     | Library check-in/out logs                 |
| `equipment`                  | ~50        | Computers, printers, rooms, etc.          |
| `equipment_sessions`         | Active     | Equipment usage tracking                  |
| `printing_jobs`              | 100s       | Print request history                     |
| `printing_prices`            | ~12        | Dynamic pricing rules                     |
| `leaderboards`               | Monthly    | Student visit rankings                    |
| `monthly_scans`              | Historical | Aggregated monthly statistics             |
| `borrowing_policies`         | ~10        | Grade-based loan rules                    |
| `fine_policies`              | ~5         | Overdue fine calculation rules            |
| `library_sections`           | ~20        | Library area codes                        |
| `calendar_events`            | ~50        | Custom library events                     |
| `announcements`              | Active     | Library announcements                     |
| `notifications`              | Active     | User notifications                        |
| `student_activities_archive` | Historical | Archived activity records                 |

**Cascade Delete Rules**: ✅ All foreign keys have proper `onDelete`/`onUpdate` behaviors to prevent orphaned data.

---

## 🔌 API Endpoints

### Authentication

| Endpoint             | Method | Auth | Description              |
| -------------------- | ------ | ---- | ------------------------ |
| `/api/auth/login`    | POST   | ❌   | User login (returns JWT) |
| `/api/auth/register` | POST   | ❌   | Create new user account  |
| `/api/auth/me`       | GET    | ✅   | Get current user info    |
| `/api/csrf/token`    | GET    | ❌   | Get CSRF token           |

### Students & Personnel

| Endpoint                    | Method | Auth | Description                         |
| --------------------------- | ------ | ---- | ----------------------------------- |
| `/api/students`             | GET    | ✅   | List all students/personnel         |
| `/api/students/:id`         | GET    | ✅   | Get student details                 |
| `/api/students`             | POST   | ✅   | Create new student                  |
| `/api/students/:id`         | PUT    | ✅   | Update student                      |
| `/api/students/:id`         | DELETE | ✅   | Delete student (with cascade rules) |
| `/api/students/:id/barcode` | GET    | ✅   | Generate student barcode            |
| `/api/students/import`      | POST   | ✅   | Bulk import from CSV                |

### Books & Borrowing

| Endpoint                  | Method | Auth | Description              |
| ------------------------- | ------ | ---- | ------------------------ |
| `/api/books`              | GET    | ✅   | List all books           |
| `/api/books/:id`          | GET    | ✅   | Get book details         |
| `/api/books`              | POST   | ✅   | Add new book             |
| `/api/books/:id`          | PUT    | ✅   | Update book              |
| `/api/books/:id`          | DELETE | ✅   | Delete book              |
| `/api/books/import`       | POST   | ✅   | Bulk import books        |
| `/api/borrows`            | GET    | ✅   | List active checkouts    |
| `/api/borrows/checkout`   | POST   | ✅   | Checkout book to student |
| `/api/borrows/:id/return` | POST   | ✅   | Return book              |
| `/api/borrows/:id/renew`  | POST   | ✅   | Renew checkout           |

### Equipment & Rooms

| Endpoint                         | Method | Auth | Description             |
| -------------------------------- | ------ | ---- | ----------------------- |
| `/api/equipment`                 | GET    | ✅   | List all equipment      |
| `/api/equipment/session`         | POST   | ✅   | Start equipment session |
| `/api/equipment/session/:id/end` | POST   | ✅   | End session             |

### Printing

| Endpoint               | Method | Auth | Description       |
| ---------------------- | ------ | ---- | ----------------- |
| `/api/printing/jobs`   | GET    | ✅   | List print jobs   |
| `/api/printing/jobs`   | POST   | ✅   | Create print job  |
| `/api/printing/prices` | GET    | ✅   | Get pricing rules |
| `/api/printing/prices` | POST   | ✅   | Add pricing rule  |

### Kiosk & Attendance

| Endpoint                       | Method | Auth | Description                         |
| ------------------------------ | ------ | ---- | ----------------------------------- |
| `/api/kiosk/tap-in`            | POST   | ✅   | Student barcode scan (check-in/out) |
| `/api/kiosk/status`            | GET    | ✅   | Get active sessions                 |
| `/api/attendance/export`       | POST   | ✅   | Export to Google Sheets             |
| `/api/attendance/import`       | POST   | ✅   | Import from Google Sheets           |
| `/api/borrowing-export/export` | POST   | ✅   | Export borrowing to Google Sheets   |
| `/api/borrowing-export/import` | POST   | ✅   | Import borrowing from Google Sheets |

### Analytics & Reports

| Endpoint                     | Method | Auth | Description            |
| ---------------------------- | ------ | ---- | ---------------------- |
| `/api/analytics/overview`    | GET    | ✅   | Dashboard statistics   |
| `/api/analytics/leaderboard` | GET    | ✅   | Top students by visits |
| `/api/analytics/trends`      | GET    | ✅   | Time-series data       |

### Settings & Configuration

| Endpoint                 | Method | Auth | Description            |
| ------------------------ | ------ | ---- | ---------------------- |
| `/api/settings/policies` | GET    | ✅   | Get borrowing policies |
| `/api/settings/policies` | POST   | ✅   | Create policy          |
| `/api/calendar-events`   | GET    | ✅   | List calendar events   |
| `/api/calendar-events`   | POST   | ✅   | Create event           |

**Total**: 33+ RESTful endpoints + WebSocket real-time events

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ ([download](https://nodejs.org))
- **Git** ([download](https://git-scm.com))
- **Google Sheets API credentials** (for sync features - optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/JaePyJs/CLMS.git
cd CLMS

# Install dependencies (all projects)
cd Backend && npm install
cd ../Frontend && npm install
cd ../BarcodeScanner && npm install
```

### Running the Application

**Windows** (Recommended):

```bash
# Double-click START_CLMS.bat
# Or run from command line:
START_CLMS.bat
```

**Manual** (Linux/Mac):

```bash
# Terminal 1 - Backend
cd Backend
npm run dev

# Terminal 2 - Frontend
cd Frontend
npm run dev

# Terminal 3 - Barcode Scanner (optional)
cd BarcodeScanner
npm start
```

Access the application:

- **Main App**: http://localhost:3000
- **Kiosk Display**: http://localhost:3000/kiosk
- **Backend API**: http://localhost:3001

### First-Time Setup

1. **Create Admin Account**:

```bash
cd Backend
npx tsx create_test_admin.ts
```

2. **Seed Sample Data** (optional):

```bash
cd Backend
npx tsx src/scripts/seed_equipment.ts
```

3. **Login**:
   - Username: `admin`
   - Password: (check console output from step 1)

---

## 🔧 Configuration

### Backend Environment (`Backend/.env`)

```env
# Database
DATABASE_URL="file:./prisma/dev.db"

# Authentication
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="7d"

# Server
PORT=3001
NODE_ENV="development"

# Google Sheets (optional - for attendance/borrowing sync)
GOOGLE_SHEETS_CREDENTIALS_PATH="./credentials/google-credentials.json"
```

### Frontend Environment (`Frontend/.env`)

```env
# API Connection
VITE_API_URL=http://localhost:3001
VITE_WS_URL=http://localhost:3001

# Feature Flags
VITE_ENABLE_KIOSK=true
VITE_ENABLE_GOOGLE_SHEETS=true
```

### Google Sheets Integration Setup

1. **Create Google Cloud Project**:
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create new project "CLMS Integration"
   - Enable Google Sheets API

2. **Create Service Account**:
   - Navigate to "IAM & Admin" → "Service Accounts"
   - Create service account with "Editor" role
   - Download JSON key file

3. **Configure CLMS**:

   ```bash
   # Place credentials file
   mkdir -p credentials
   cp /path/to/downloaded-key.json credentials/google-credentials.json
   ```

4. **Share Your Sheet**:
   - Open your Google Sheet
   - Click "Share"
   - Add service account email (from JSON file)
   - Grant "Editor" permission

5. **Use in CLMS**:
   - Settings → Attendance → Google Sheets Integration
   - Enter Spreadsheet ID and Sheet Name
   - Click "Validate" → "Import" or "Export"

---

## 🛠️ Troubleshooting

### Common Errors

#### ❌ "Port 3000/3001 already in use"

**Solution**:

```bash
# Windows
taskkill /F /IM node.exe

# Linux/Mac
killall node
```

#### ❌ "Prisma Client not generated"

**Solution**:

```bash
cd Backend
npx prisma generate
```

#### ❌ "Database migration needed"

**Solution**:

```bash
cd Backend
npx prisma migrate dev
# Or for production
npx prisma db push
```

#### ❌ "WebSocket connection failed"

**Problem**: Firewall blocking port 3001  
**Solution**: Allow port 3001 in Windows Firewall or disable temporarily for development

#### ❌ "Google Sheets import failed"

**Checklist**:

- ✅ Credentials file exists at `credentials/google-credentials.json`
- ✅ Service account email added to sheet with "Editor" permission
- ✅ Sheet ID and name are correct
- ✅ Required columns present (Timestamp, User ID, Action)

#### ❌ "Students not appearing in leaderboard"

**Reason**: Personnel are excluded from leaderboards by design  
**Solution**: Check that `type` field is "STUDENT" not "PERSONNEL"

### Debug Mode

Enable detailed logging:

```bash
# Backend
cd Backend
NODE_ENV=development npm run dev

# Frontend (check browser console)
# Open DevTools (F12) → Console tab
```

### Database Issues

**Reset Database** (⚠️ deletes all data):

```bash
cd Backend
rm prisma/dev.db
npx prisma db push
npx tsx create_test_admin.ts
```

**View Database**:

```bash
cd Backend
npx prisma studio
# Opens at http://localhost:5555
```

---

## 📝 Batch Scripts Reference

| Script               | Purpose              | When to Use                 |
| -------------------- | -------------------- | --------------------------- |
| `START_CLMS.bat`     | Launch all services  | First time or after restart |
| `CLMS_MANAGER.bat`   | Unified control menu | Manage running services     |
| `SETUP_DATABASE.bat` | Initialize database  | First-time setup            |
| `RESET_DATABASE.bat` | Clear all data       | Testing or fresh start      |

### CLMS_MANAGER.bat Options

```
╔════════════════════════════════════╗
║  1. START CLMS                     ║ - Launch all servers
║  2. STOP CLMS                      ║ - Kill all node processes
║  3. RESTART                        ║ - Stop + Start
║  4. CHECK STATUS                   ║ - View running processes
║  5. SEED ROOMS/EQUIPMENT           ║ - Add sample equipment
║  6. OPEN BROWSER                   ║ - Quick URL launcher
║  7. START BARCODE SCANNER          ║ - Launch scanner app
║  8. EXIT                           ║ - Close manager
╚════════════════════════════════════╝
```

---

## 🧪 Testing

### Run Tests

```bash
# Backend unit tests
cd Backend
npm test

# Frontend E2E tests
cd Frontend
npm run test:e2e

# Frontend unit tests
npm run test:unit
```

### Manual Testing Checklist

- [ ] Login with admin account
- [ ] Add new student with barcode generation
- [ ] Check out a book to student
- [ ] Return book and verify fine calculation
- [ ] Scan student barcode at kiosk
- [ ] Verify real-time dashboard updates
- [ ] Create print job
- [ ] Export attendance to Google Sheets
- [ ] Import borrowing history from Google Sheets
- [ ] View leaderboard rankings

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

**Code Style**:

- ESLint for both Backend/Frontend (must pass with 0 warnings)
- Prettier for formatting
- TypeScript strict mode (incrementally enabled)

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🔗 Links

- **Repository**: [https://github.com/JaePyJs/CLMS](https://github.com/JaePyJs/CLMS)
- **Issues**: [https://github.com/JaePyJs/CLMS/issues](https://github.com/JaePyJs/CLMS/issues)
- **Discussions**: [https://github.com/JaePyJs/CLMS/discussions](https://github.com/JaePyJs/CLMS/discussions)

---

**Made with ❤️ for educational institutions**
