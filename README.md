# CLMS (Comprehensive Library Management System)

A local web application for Sacred Heart of Jesus Catholic School Library with integrated n8n workflow automation for background tasks.

## Project Overview

**CLMS** serves Sophia, a 22-year-old librarian, as a single-administrator interface running entirely on localhost with integrated n8n workflow automation for background tasks.

### Key Features
- **Student Activity Tracking** with barcode scanning and grade-based permissions
- **Equipment Management** for computer stations, gaming rooms, and AVR equipment
- **n8n Automation** for daily backups, notifications, and analytics
- **Real-time Dashboard** showing library activity and system status
- **Offline-First Design** with cloud sync when internet available

## Technology Stack

### Frontend
- **React 18.3.1** with TypeScript
- **Vite 6.3.5** as build tool
- **shadcn/ui** component library (30+ Radix UI components)
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **Lucide React** for icons

### Backend
- **Node.js** with Express.js framework
- **MySQL** database (dual integration with Koha and CLMS databases)
- **n8n** workflow automation (localhost:5678)
- **Google Sheets** integration for cloud backup

## Local Development Setup

### Prerequisites
- Node.js (v18 or higher)
- MySQL Server
- n8n (self-hosted at localhost:5678)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/JaePyJs/CLMS.git
   cd CLMS
   ```

2. **Frontend Setup** (from `Frontend/` directory)
   ```bash
   cd Frontend
   npm install
   npm run dev  # Starts on localhost:3000
   ```

3. **Backend Setup** (from `Backend/` directory)
   ```bash
   cd Backend
   npm install
   npm run dev  # Starts on localhost:3001
   ```

4. **Database Setup**
   - Create MySQL database for CLMS
   - Configure read-only access to existing Koha database
   - Run database migrations (provided in Backend/scripts)

5. **n8n Setup**
   - Install n8n locally: `npm install n8n -g`
   - Start n8n: `n8n start` (runs on localhost:5678)
   - Import workflow templates from `Docs/n8n-workflows/`

## Project Structure

```
CLMS/
├── Frontend/                    # React frontend application
│   ├── src/
│   │   ├── components/         # React components
│   │   │   ├── ui/            # shadcn/ui components
│   │   │   └── dashboard/     # Dashboard-specific components
│   │   ├── lib/               # Utilities and mock data
│   │   └── assets/            # Static assets
│   ├── package.json
│   └── vite.config.ts
├── Backend/                     # Node.js backend API
│   ├── src/
│   │   ├── config/            # Database configuration
│   │   ├── routes/            # API endpoints
│   │   ├── models/            # Data models
│   │   ├── middleware/        # Auth and validation
│   │   └── utils/             # Integration utilities
│   ├── package.json
│   └── .env.example
├── Docs/                        # Documentation
│   ├── api/                   # API documentation
│   ├── n8n-workflows/         # Workflow templates
│   └── deployment/            # Deployment guides
├── CLAUDE.md                   # Claude AI development guide
└── README.md                   # This file
```

## Usage

### Starting the Application

1. **Start Backend Server**
   ```bash
   cd Backend
   npm run dev
   ```

2. **Start Frontend Application**
   ```bash
   cd Frontend
   npm run dev
   ```

3. **Start n8n Automation** (optional but recommended)
   ```bash
   n8n start
   ```

4. **Access the Application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - n8n Interface: http://localhost:5678

### Daily Workflow

1. **Morning Dashboard Check** - Review overnight automation results
2. **Student Activity Tracking** - Scan student IDs and log activities
3. **Equipment Management** - Monitor computer and gaming station usage
4. **Analytics Review** - Check usage patterns and generate reports

## Configuration

### Environment Variables

Backend `.env` file:
```env
# Database Configuration
DB_HOST=localhost
DB_USER=clms_user
DB_PASSWORD=your_password
DB_NAME=clms_database

# Koha Integration (Read-only)
KOHA_DB_HOST=localhost
KOHA_DB_USER=koha_user
KOHA_DB_PASSWORD=koha_password
KOHA_DB_NAME=koha_database

# n8n Integration
N8N_WEBHOOK_URL=http://localhost:5678/webhook
N8N_API_KEY=your_n8n_api_key

# Google Sheets Integration
GOOGLE_SHEETS_API_KEY=your_google_sheets_api_key
```

### Database Setup

Run the database setup script:
```bash
cd Backend/scripts
mysql -u root -p < setup-databases.sql
```

## Architecture

### Component-Based Design
- **Modular React components** with TypeScript interfaces
- **shadcn/ui design system** for consistent UI
- **Dashboard-centric design** with multi-tab interface

### Key Application Tabs
1. **Dashboard** - Live stats, primary actions, active students, n8n status
2. **Equipment** - Computer and gaming station management
3. **n8n Automation** - Workflow monitoring and control
4. **Analytics** - Usage reports and insights

### Grade-Based Access Control
- **Primary (K-3)**: Limited time, supervised activities only
- **Grade School (4-6)**: Extended computer time, basic gaming access
- **Junior High (7-10)**: Full computer access, gaming sessions, AVR equipment
- **Senior High (11-12)**: Premium access, extended sessions, research equipment

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Create an issue in this repository
- Review the documentation in the `Docs/` folder
- Check the `CLAUDE.md` file for development guidance

---

**Built with ❤️ for Sacred Heart of Jesus Catholic School Library**