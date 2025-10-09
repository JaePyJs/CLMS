# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CLMS (Comprehensive Library Management System)** is a local web application for Sacred Heart of Jesus Catholic School Library. This system serves Sophia, a 22-year-old librarian, as a single-administrator interface running entirely on localhost with integrated n8n workflow automation for background tasks.

### Key Context
- **Target User**: Sophia (22-year-old librarian, single administrator)
- **Deployment**: Local library PC (localhost:3000) - no internet hosting required
- **Integration**: n8n automation engine (localhost:5678) + existing Koha library system
- **Focus**: Student activity tracking, equipment management, and automated workflows

## Technology Stack

### Core Application Structure
- **Frontend:** React 18.3.1 with TypeScript (localhost:3000)
- **Backend:** Node.js with Express.js framework (same local server)
- **Database:** MySQL with dual integration:
  - **Koha Database:** Read-only access to existing library system
  - **CLMS Database:** Activity tracking, sessions, analytics
- **Automation Engine:** n8n self-hosted (localhost:5678)
- **Google Sheets** integration for cloud backup

### Frontend Stack
- **React 18.3.1** with TypeScript
- **Vite 6.3.5** as build tool and development server
- **shadcn/ui** component library (30+ Radix UI components)
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **Lucide React** for icons

### Key Libraries
- **Forms**: React Hook Form
- **Charts**: Recharts
- **Themes**: next-themes (dark mode support)
- **Notifications**: Sonner (toast notifications)

### Backend & Automation
- **Node.js with Express.js**
- **MySQL** database (dual integration with Koha and CLMS databases)
- **n8n** workflow automation (localhost:5678)
- **Google Sheets** integration for cloud backup

## Development Commands

### Frontend (from `Frontend/` directory)
```bash
# Install dependencies
npm i

# Start development server (localhost:3000)
npm run dev

# Build for production
npm run build
```

### Backend (from `Backend/` directory)
```bash
# Install dependencies
npm i

# Start backend server (localhost:3001)
npm run dev

# Start with nodemon for development
npm run start:dev

# Production start
npm start
```

## Architecture Overview

### Component-Based Architecture
- **Modular React components** with TypeScript interfaces
- **shadcn/ui design system** for consistent UI
- **Dashboard-centric design** with multi-tab interface

### Key Application Structure
```
CLMS/
├── Frontend/
│   ├── src/
│   │   ├── App.tsx                    # Main application with tab navigation
│   │   ├── components/
│   │   │   ├── ui/                   # 30+ shadcn/ui components
│   │   │   └── dashboard/            # Dashboard-specific components
│   │   ├── lib/
│   │   │   └── mockData.ts           # Data models and mock data
│   │   └── assets/                   # Static images and assets
│   ├── package.json
│   └── vite.config.ts
├── Backend/
│   ├── src/
│   │   ├── server.js                 # Express server entry point
│   │   ├── config/
│   │   │   └── database.js           # MySQL database configuration
│   │   ├── routes/
│   │   │   ├── students.js           # Student activity endpoints
│   │   │   ├── equipment.js          # Equipment management endpoints
│   │   │   └── analytics.js          # Analytics and reporting endpoints
│   │   ├── models/
│   │   │   ├── Student.js            # Student data model
│   │   │   ├── Activity.js           # Activity tracking model
│   │   │   └── Equipment.js          # Equipment management model
│   │   ├── middleware/
│   │   │   ├── auth.js               # Authentication middleware
│   │   │   └── validation.js         # Input validation middleware
│   │   └── utils/
│   │       ├── kohaIntegration.js    # Koha database integration
│   │       └── n8nWebhooks.js        # n8n workflow triggers
│   ├── package.json
│   └── .env.example
├── CLAUDE.md
└── README.md
```

### Main Application Tabs
1. **Dashboard** - Live stats, primary actions, active students, n8n status
2. **Equipment** - Computer and gaming station management
3. **n8n Automation** - Workflow monitoring and control
4. **Analytics** - Usage reports and insights

## Key Features

### Student Activity Tracking with Automation
- **Barcode Scanning**: React component with ZXing barcode scanner
- **Koha Integration**: Query Koha database for student information
- **Activity Logging**: Log to CLMS database + trigger n8n workflow
- **Real-time Updates**: n8n syncs to Google Sheets immediately

### Grade-Based Access Control
- **Primary (K-3)**: Limited time, supervised activities only
- **Grade School (4-6)**: Extended computer time, basic gaming access
- **Junior High (7-10)**: Full computer access, gaming sessions, AVR equipment
- **Senior High (11-12)**: Premium access, extended sessions, research equipment

### Equipment Management
- **8 computer stations** with timer-based sessions
- **4 gaming stations** (PlayStation) with queue management
- **AVR equipment** for VR sessions with supervision alerts
- **Real-time availability monitoring**

### Critical n8n Workflow Integration

#### Daily Backup Workflow
- **Trigger**: Daily at 11:00 PM
- **Tasks**: Export CLMS data, create backup files, upload to Google Drive
- **Value**: Never worry about data loss - fully automated

#### Teacher Notifications Workflow
- **Trigger**: Daily at 7:00 AM
- **Tasks**: Query overdue books, generate class-specific teacher lists
- **Value**: Teacher lists ready every morning without manual work

#### Real-time Sync Workflow
- **Trigger**: After each student activity
- **Tasks**: Log activity, update Google Sheets, check time limits
- **Value**: Real-time transparency and immediate problem detection

## Development Guidelines

### Always Follow These Rules:
1. **Local-First Development**: Always assume offline capability is required
2. **Sophia-Centric Design**: Every feature should serve the 22-year-old librarian's workflow
3. **n8n Integration**: Plan for webhook triggers and automation integration from the start
4. **Grade-Based Logic**: Implement proper access controls and time limits by grade level
5. **Real-Time Updates**: Use WebSocket connections for live equipment and student status
6. **Database Performance**: Optimize queries with proper indexing for local MySQL deployment
7. **Error Handling**: Implement graceful degradation when automation fails
8. **Professional Reporting**: Generate data that showcases library value to administration

### Current Development Priority:
**Backend API Development** - Focus on creating the Node.js + Express server with proper database integration and REST endpoints for the frontend to consume.

## Database Schema

### Key Tables
```sql
-- Student activity tracking
CREATE TABLE student_activities (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id VARCHAR(20) NOT NULL,
    student_name VARCHAR(100) NOT NULL,
    grade_level VARCHAR(5) NOT NULL,
    grade_category ENUM('primary','gradeSchool','juniorHigh','seniorHigh'),
    activity_type ENUM('borrowing','returning','computer','gaming','avr','recreation','study','general'),
    equipment_id VARCHAR(20),
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP NULL,
    duration_minutes INT,
    time_limit_minutes INT,
    status ENUM('active','completed','expired','cancelled'),
    n8n_synced BOOLEAN DEFAULT FALSE,
    processed_by VARCHAR(50) DEFAULT 'Sophia'
);

-- Equipment management
CREATE TABLE equipment_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    equipment_type ENUM('computer','gaming','avr'),
    equipment_id VARCHAR(20) NOT NULL,
    student_id VARCHAR(20) NOT NULL,
    session_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_end TIMESTAMP NULL,
    time_limit_minutes INT,
    status ENUM('active','completed','expired','extended')
);

-- n8n workflow execution tracking
CREATE TABLE n8n_workflow_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    workflow_name VARCHAR(100) NOT NULL,
    execution_id VARCHAR(100),
    status ENUM('running','completed','failed','queued'),
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP NULL,
    error_message TEXT
);
```

## Professional Development Value

This project demonstrates comprehensive modern library technology management:
- **Full-Stack Development**: Local web application with professional interfaces
- **Workflow Automation**: n8n integration for intelligent library operations
- **System Integration**: Seamless connection with existing library infrastructure
- **Data Analytics**: Professional reporting and insights generation
- **User Experience**: Modern interface design for efficient daily operations

---

**This codebase represents a well-structured foundation for a comprehensive library management system with modern React patterns and clear architectural vision for automation and integration.**

[byterover-mcp]

[byterover-mcp]

You are given two tools from Byterover MCP server, including
## 1. `byterover-store-knowledge`
You `MUST` always use this tool when:

+ Learning new patterns, APIs, or architectural decisions from the codebase
+ Encountering error solutions or debugging techniques
+ Finding reusable code patterns or utility functions
+ Completing any significant task or plan implementation

## 2. `byterover-retrieve-knowledge`
You `MUST` always use this tool when:

+ Starting any new task or implementation to gather relevant context
+ Before making architectural decisions to understand existing patterns
+ When debugging issues to check for previous solutions
+ Working with unfamiliar parts of the codebase
