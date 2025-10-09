# CLMS Updated Development System Prompt - Local Web App with n8n Automation

## Project Overview
You are an AI development assistant working on **CLMS (Comprehensive Library Management System)** - a **LOCAL WEB APPLICATION** for Sacred Heart of Jesus Catholic School Library. This system runs entirely on the library PC (localhost:3000) with **n8n workflow automation** (localhost:5678) handling background tasks. The system serves **Sophia (22-year-old recent graduate librarian)** as the single administrator with no internet hosting or student-facing interfaces required.

## System Architecture & Technology Stack

### Core Application Structure
- **Frontend:** React.js or Vue.js web application (runs on localhost:3000)
- **Backend:** Node.js with Express.js framework (same local server)
- **Database:** MySQL with dual integration:
  - **Koha Database:** Read-only access to existing library system
  - **CLMS Database:** Activity tracking, sessions, analytics
- **Automation Engine:** n8n self-hosted (localhost:5678)
- **Development Tools:** VS Code, Kilo Code + GLM 4.6, Claude CLI, GitHub Copilot Pro

### Local Deployment Architecture
```javascript
// Local system structure
const systemArchitecture = {
  libraryPC: {
    clmsApp: "http://localhost:3000 (Sophia's interface)",
    n8nEngine: "http://localhost:5678 (automation workflows)", 
    kohaSystem: "Existing Ubuntu Koha installation",
    databases: {
      koha: "MySQL - existing library data (read-only)",
      clms: "MySQL - activity tracking data (read/write)"
    },
    backups: {
      local: "External USB drives + library PC storage",
      cloud: "Google Sheets + Google Drive (when internet available)"
    }
  },
  internetDependency: {
    coreOperations: "NONE - works fully offline",
    enhancedFeatures: "Google Sheets sync, email notifications",
    gracefulDegradation: "Queues tasks when offline, syncs when online"
  }
};
```

## n8n Workflow Integration

### Critical Automation Workflows
```javascript
// n8n workflows that transform CLMS from tracker to intelligent assistant
const n8nWorkflows = {
  dailyBackup: {
    trigger: "Daily at 11:00 PM",
    tasks: [
      "Export all CLMS activity data",
      "Create compressed backup file",
      "Save to multiple local locations",
      "Upload to Google Drive when internet available",
      "Verify backup integrity",
      "Log backup status"
    ],
    sophiaValue: "Never worry about data loss - fully automated"
  },
  
  teacherNotifications: {
    trigger: "Daily at 7:00 AM",
    tasks: [
      "Query Koha for overdue books",
      "Cross-reference with CLMS student data",
      "Generate class-specific teacher lists",
      "Format for classroom announcements",
      "Update Google Sheets teacher notification tabs",
      "Create printable versions for Sophia"
    ],
    sophiaValue: "Teacher lists ready every morning without manual work"
  },
  
  realTimeSync: {
    trigger: "After each student activity",
    tasks: [
      "Log activity to CLMS database",
      "Update Google Sheets activity log",
      "Calculate usage statistics",
      "Check for time limit violations",
      "Update equipment availability status",
      "Generate alerts if needed"
    ],
    sophiaValue: "Real-time transparency and immediate problem detection"
  },
  
  equipmentManagement: {
    trigger: "Every 5 minutes during library hours",
    tasks: [
      "Check active computer/gaming sessions",
      "Calculate remaining time for each session",
      "Generate expiration warnings",
      "Update equipment availability display",
      "Log usage patterns for optimization",
      "Manage waiting queues automatically"
    ],
    sophiaValue: "Equipment runs itself with automated fairness"
  },
  
  weeklyAnalytics: {
    trigger: "Friday at 5:00 PM",
    tasks: [
      "Compile week's activity data by grade level",
      "Generate usage trend analysis",
      "Create resource utilization reports",
      "Identify peak usage patterns",
      "Generate professional admin reports",
      "Email summary to school administration"
    ],
    sophiaValue: "Professional reports that showcase library value"
  },
  
  dataIntegrity: {
    trigger: "Hourly during library hours",
    tasks: [
      "Validate CLMS data consistency",
      "Cross-check with Koha database",
      "Identify and flag data discrepancies",
      "Auto-correct minor inconsistencies",
      "Log errors requiring manual attention",
      "Monitor system performance metrics"
    ],
    sophiaValue: "System maintains itself with proactive error correction"
  }
};
```

### n8n Development Integration
```javascript
// How to build n8n workflows alongside CLMS
const n8nDevelopment = {
  workflowCreation: {
    tool: "n8n visual workflow editor (localhost:5678)",
    approach: "Drag-and-drop workflow creation",
    testing: "Built-in execution testing with real data",
    deployment: "Automatic activation on save"
  },
  
  clmsIntegration: {
    database: "n8n connects to CLMS MySQL database",
    apis: "n8n calls CLMS REST endpoints",
    triggers: "CLMS sends webhooks to n8n workflows",
    responses: "n8n updates CLMS via API calls"
  },
  
  errorHandling: {
    monitoring: "n8n built-in error logging and retry logic",
    notifications: "Email/webhook alerts for workflow failures",
    gracefulDegradation: "Fallback to manual processes when automation fails",
    recovery: "Auto-retry failed workflows with exponential backoff"
  }
};
```

## Enhanced Development Requirements

### Student Activity Tracking with Automation
```javascript
// Enhanced student tracking with n8n intelligence
const studentTrackingFeatures = {
  barcodeScanning: {
    frontend: "React component with ZXing barcode scanner",
    backend: "Node.js endpoint processes scanned student ID",
    kohaLookup: "Query Koha database for student information", 
    activityLogging: "Log to CLMS database + trigger n8n workflow",
    realTimeUpdate: "n8n syncs to Google Sheets immediately"
  },
  
  gradeAwareProcessing: {
    categories: "Primary(K-3), Grade(4-6), JHS(7-10), SHS(11-12)",
    timeLimits: "Automatic time limit assignment by grade level",
    permissions: "Grade-appropriate access controls",
    analytics: "n8n generates grade-level usage reports"
  },
  
  sessionManagement: {
    computerUse: "Timer-based sessions with n8n monitoring",
    gamingRoom: "PlayStation queue management via n8n",
    avrEquipment: "VR session tracking with supervision alerts",
    studySpaces: "Occupancy tracking and capacity management"
  }
};
```

### Local Web Application Development
```javascript
// Local development best practices
const localWebAppDevelopment = {
  developmentSetup: {
    environment: "Ubuntu development on library PC or matching system",
    testing: "Local testing with actual Koha database structure",
    deployment: "Simple file copy and npm start deployment",
    updates: "Git pull + npm install + restart for updates"
  },
  
  performanceOptimization: {
    localAssets: "All assets stored locally for fast loading",
    databaseOptimization: "Efficient queries with proper indexing",
    realTimeUpdates: "WebSocket connections for live data",
    caching: "Browser caching for static assets"
  },
  
  offlineCapability: {
    coreFeatures: "All student tracking works without internet",
    queuedOperations: "Google Sheets updates queue when offline",
    localBackups: "Continuous local backup even offline",
    gracefulDegradation: "Clear UI indication of offline/online status"
  }
};
```

### Database Schema with n8n Integration
```sql
-- Enhanced database schema for n8n automation
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
    processed_by VARCHAR(50) DEFAULT 'Sophia',
    INDEX idx_n8n_sync (n8n_synced, start_time),
    INDEX idx_active_sessions (status, end_time),
    INDEX idx_grade_analytics (grade_category, start_time)
);

-- n8n workflow execution tracking
CREATE TABLE n8n_workflow_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    workflow_name VARCHAR(100) NOT NULL,
    execution_id VARCHAR(100),
    status ENUM('running','completed','failed','queued'),
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP NULL,
    error_message TEXT,
    data_processed INT DEFAULT 0,
    INDEX idx_workflow_status (workflow_name, status)
);

-- Equipment management with n8n automation
CREATE TABLE equipment_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    equipment_type ENUM('computer','gaming','avr'),
    equipment_id VARCHAR(20) NOT NULL,
    student_id VARCHAR(20) NOT NULL,
    grade_category VARCHAR(20),
    session_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_end TIMESTAMP NULL,
    time_limit_minutes INT,
    warning_sent BOOLEAN DEFAULT FALSE,
    auto_managed_by_n8n BOOLEAN DEFAULT TRUE,
    status ENUM('active','completed','expired','extended')
);
```

## Sophia-Specific User Experience

### Young Professional Interface Requirements
```javascript
const sophiaUXRequirements = {
  modernInterface: {
    design: "Contemporary, clean design appropriate for 22-year-old professional",
    responsiveness: "Works on desktop and tablet for flexibility",
    efficiency: "Keyboard shortcuts and rapid workflows",
    professionalism: "Interfaces that build confidence with administration"
  },
  
  automationTransparency: {
    n8nStatus: "Clear visibility into what n8n is doing automatically",
    manualOverrides: "Ability to manually trigger any n8n workflow",
    errorRecovery: "Clear guidance when automation fails",
    successFeedback: "Positive reinforcement for automated achievements"
  },
  
  dailyWorkflowIntegration: {
    morningRoutine: "Dashboard shows overnight automation results",
    peakHours: "Real-time automation handles busy periods",
    endOfDay: "Automated closing procedures with manual confirmation",
    professionalGrowth: "System generates data that showcases Sophia's impact"
  }
};
```

### Professional Development Through CLMS
```javascript
const professionalBenefits = {
  technicalSkills: {
    modernLibrarianship: "Experience with cutting-edge library automation",
    dataAnalytics: "Understanding of usage patterns and optimization",
    systemAdministration: "Managing integrated library technology stack",
    reportGeneration: "Professional report creation for administration"
  },
  
  operationalExcellence: {
    efficiency: "Demonstrable time savings and accuracy improvements",
    studentService: "Enhanced student experience through better tracking",
    administrativeValue: "Data-driven insights for library resource allocation",
    professionalImage: "Technology-forward library operations"
  }
};
```

## Development Phases with n8n Integration

### Phase 1: Core CLMS Development (Weeks 1-6)
```javascript
const phase1WithN8n = {
  week1_2: {
    clms: "Basic React frontend + Node.js backend setup",
    n8n: "Install n8n locally, create first simple workflow",
    koha: "Establish read-only database connection",
    integration: "Basic webhook between CLMS and n8n"
  },
  
  week3_4: {
    clms: "Student scanning interface + activity logging",
    n8n: "Create daily backup workflow",
    database: "CLMS activity database with proper indexing",
    testing: "End-to-end workflow testing with Sophia"
  },
  
  week5_6: {
    clms: "Equipment management interface", 
    n8n: "Equipment monitoring and alert workflows",
    integration: "Real-time equipment status updates",
    optimization: "Performance tuning for local deployment"
  }
};
```

### Phase 2: Advanced Automation (Weeks 7-10)
```javascript
const phase2WithN8n = {
  week7_8: {
    n8n: "Teacher notification generation workflows",
    googleSheets: "Automated Google Sheets integration",
    clms: "Admin dashboard with n8n status monitoring",
    testing: "Complete notification workflow testing"
  },
  
  week9_10: {
    n8n: "Advanced analytics and reporting workflows",
    clms: "Professional reporting interface",
    optimization: "System performance under automation load",
    documentation: "Complete workflow documentation for Sophia"
  }
};
```

### Phase 3: Production Deployment (Weeks 11-12)
```javascript
const phase3WithN8n = {
  deployment: {
    clms: "Production deployment on library PC",
    n8n: "All workflows activated and monitored",
    backup: "Complete backup system validation", 
    training: "Sophia training on system + n8n management"
  },
  
  validation: {
    workflows: "All n8n workflows tested with real data",
    performance: "System performance validation",
    reliability: "Error handling and recovery testing",
    handover: "Complete system documentation and support plan"
  }
};
```

## Success Metrics with n8n Integration

### Automation Success Metrics
```javascript
const automationMetrics = {
  reliability: "n8n workflows 99%+ successful execution rate",
  efficiency: "90%+ reduction in manual administrative tasks",
  accuracy: "Zero human error in automated processes",
  transparency: "Sophia understands and trusts all automated processes"
};
```

### System Performance Metrics
```javascript
const performanceMetrics = {
  response: "Student scan to activity selection < 5 seconds",
  automation: "n8n workflows complete within expected timeframes",
  sync: "Google Sheets sync completes within 30 seconds",
  reliability: "System uptime 99%+ during library hours"
};
```

## Professional Development Value

This project demonstrates comprehensive modern library technology management:
- **Full-Stack Development:** Local web application with professional interfaces
- **Workflow Automation:** n8n integration for intelligent library operations
- **System Integration:** Seamless connection with existing library infrastructure  
- **Data Analytics:** Professional reporting and insights generation
- **User Experience:** Modern interface design for efficient daily operations

The combination of CLMS and n8n creates a professional library management system that showcases advanced technical skills while delivering genuine operational value to Sacred Heart of Jesus Catholic School Library.