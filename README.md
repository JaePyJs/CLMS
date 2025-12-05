# CLMS - Centralized Library Management System

A full-stack library management system built with TypeScript, React, and Express for educational institutions.

## Features

### Core Features
- **Student & Personnel Management** - Track 880+ students and personnel with barcode generation and activity history
- **Book Catalog** - Manage 2,900+ books with checkout/return workflow and fine calculation
- **Equipment & Room Tracking** - Session management with drag-and-drop assignments
- **Calendar Events** - Custom events for library reminders and scheduling

### Kiosk & Attendance
- **Self-Service Kiosk** - Barcode scanner check-in/out with real-time welcome display
- **Auto-Checkout** - Automatic session timeout after 15 minutes of inactivity
- **Multi-Display Support** - Separate kiosk welcome screen for secondary monitors
- **Real-time Updates** - WebSocket-powered instant status updates across all clients

### Analytics & Reports
- **Usage Statistics** - Comprehensive library usage analytics
- **Leaderboards** - Monthly/yearly visit rankings (students only, excludes personnel)
- **CSV Exports** - Export reports and data for external analysis

### Printing Services
- **Print Job Tracking** - Log and manage print requests with automatic cost calculation
- **Dynamic Pricing** - Configurable prices for paper sizes (Short, Long, A4, custom) and colors (B&W, Half Color, Full Color, custom)
- **Barcode Integration** - Scan student barcodes to auto-select users for print jobs
- **Price Management** - Settings tab for editing, adding, and removing pricing configurations

## Tech Stack

| Frontend       | Backend     |
| -------------- | ----------- |
| React 18       | Node.js 20+ |
| TypeScript     | Express 4   |
| Vite           | Prisma ORM  |
| Tailwind CSS   | SQLite      |
| Radix UI       | Socket.IO   |
| TanStack Query | JWT Auth    |

## Quick Start

### Prerequisites

- Node.js 20+
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/JaePyJs/CLMS.git
cd CLMS

# Install dependencies
npm install
cd Backend && npm install
cd ../Frontend && npm install
```

### Running the Application

**Windows:** Double-click `START_CLMS.bat`

**Manual:**

```bash
# Terminal 1 - Backend
cd Backend
npm run dev

# Terminal 2 - Frontend
cd Frontend
npm run dev
```

Access the application at http://localhost:3000

### First-Time Setup

Create an admin account:

```bash
cd Backend
npx tsx create_test_admin.ts
```

## Project Structure

```
CLMS/
├── Backend/
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Auth, validation
│   │   └── index.ts        # Entry point
│   ├── prisma/             # Database schema
│   └── package.json
│
├── Frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom hooks
│   │   ├── lib/            # Utilities
│   │   └── main.tsx        # Entry point
│   └── package.json
│
├── START_CLMS.bat          # Quick start script
└── package.json            # Root workspace
```

## API Endpoints

| Endpoint               | Description                  |
| ---------------------- | ---------------------------- |
| `/api/auth`            | Authentication               |
| `/api/students`        | Student CRUD                 |
| `/api/books`           | Book catalog                 |
| `/api/borrows`         | Checkout/return              |
| `/api/equipment`       | Room tracking                |
| `/api/analytics`       | Statistics                   |
| `/api/kiosk`           | Self-service                 |
| `/api/printing`        | Print jobs & pricing         |
| `/api/calendar-events` | Calendar events              |
| `/api/settings`        | Configuration                |

## Environment Variables

**Backend/.env**

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-key"
PORT=3001
```

**Frontend/.env**

```env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=http://localhost:3001
```

## Database

Using SQLite with Prisma ORM:

```bash
cd Backend

# Generate Prisma client
npm run db:generate

# Push schema changes
npm run db:push

# Open database GUI
npm run db:studio
```

## License

MIT License - see LICENSE file for details.

## Links

- [Repository](https://github.com/JaePyJs/CLMS)
- [Issues](https://github.com/JaePyJs/CLMS/issues)
