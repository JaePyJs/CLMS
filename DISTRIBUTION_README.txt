===============================================================================
  CLMS - CENTRALIZED LIBRARY MANAGEMENT SYSTEM
  Distribution Package for Schools
  Version 1.0
===============================================================================

WHAT IS CLMS?
-------------
CLMS is a comprehensive library management system designed specifically for
schools. It helps librarians manage:
  • Student records and checkouts
  • Book catalog and circulation
  • Equipment inventory and reservations
  • User roles and permissions
  • Reports and analytics
  • Data import/export

SYSTEM REQUIREMENTS
-------------------
Minimum Requirements:
  • Windows 10/11 (64-bit)
  • 4 GB RAM
  • 10 GB free disk space
  • Internet connection (for installation)
  • Administrator access

Recommended:
  • Windows 11
  • 8 GB RAM
  • 20 GB free disk space
  • Stable internet connection
  • Intel i5 or AMD equivalent processor

QUICK START GUIDE
-----------------

STEP 1: Install Docker Desktop
  1. Download Docker Desktop from:
     https://www.docker.com/products/docker-desktop/
  2. Run the installer (as Administrator)
  3. Restart your computer when prompted
  4. Start Docker Desktop
  5. Wait for the whale icon to appear in system tray
     (This may take 2-3 minutes on first run)

STEP 2: Install CLMS
  1. Extract this ZIP file to a folder (e.g., C:\CLMS)
  2. Navigate to the extracted folder
  3. Right-click on "INSTALL.bat"
  4. Select "Run as administrator"
  5. Follow the on-screen instructions
  6. Wait for installation to complete (5-10 minutes)

STEP 3: Access CLMS
  • CLMS will open automatically after installation
  • Application URL: http://localhost:3000
  • Admin Panel: http://localhost:3001

DEFAULT CREDENTIALS
-------------------
Username: admin
Password: librarian123

*** IMPORTANT: Change the default password after first login! ***

MANAGEMENT SCRIPTS
------------------
START.bat    - Starts all CLMS services
STOP.bat     - Stops all CLMS services
INSTALL.bat  - Full installation (run as Administrator)

GETTING HELP
------------
1. Check the documentation:
   - See "docs\INSTALLATION_GUIDE.md" for detailed instructions
   - See "docs\README.md" for system overview

2. Common Issues:
   - Docker not running? Start Docker Desktop first
   - Port conflicts? Close other applications
   - Installation fails? Check internet connection
   - Can't login? Use default credentials above

TRAINING RESOURCES
------------------
For Librarians:
  • Read the Installation Guide
  • Practice with sample data
  • Explore all dashboard features
  • Set up user accounts

For IT Staff:
  • Review technical documentation
  • Understand Docker deployment
  • Set up backup procedures
  • Monitor system health

SECURITY NOTES
--------------
• Change all default passwords immediately
• Create separate accounts for each staff member
• Regularly back up your data
• Monitor system logs
• Keep Docker Desktop updated
• Restrict network access if needed

BACKUP & RECOVERY
-----------------
Manual Backup:
  1. Run STOP.bat
  2. Copy entire CLMS folder to backup location
  3. Run START.bat

Automated Backup:
  • Schedule regular backups via Windows Task Scheduler
  • Include entire CLMS folder

FEATURES INCLUDED
-----------------
✓ Student Management
  - Add/edit/delete students
  - Student photos
  - Barcode integration
  - Bulk import

✓ Book Management
  - ISBN-based catalog
  - Checkout/check-in
  - Fine calculation
  - Due date tracking
  - Search and filter

✓ Equipment Management
  - Equipment inventory
  - Reservation system
  - Check-out tracking
  - Availability status

✓ User Management
  - Role-based access (Admin, Librarian, Staff)
  - User permissions
  - Session management

✓ Reporting & Analytics
  - Checkout reports
  - Activity logs
  - Overdue items
  - Usage statistics

✓ Data Management
  - CSV import/export
  - Data validation
  - Backup/restore

✓ Real-time Features
  - Live notifications
  - WebSocket updates
  - Activity feeds

TECHNICAL DETAILS
-----------------
This package includes:
  • Frontend: React 19 with Vite
  • Backend: Express.js with TypeScript
  • Database: MySQL 8.0
  • Cache: Redis 7
  • Deployment: Docker Compose

The application runs entirely on your school's network.
No data is sent to external servers.

SUPPORT & UPDATES
-----------------
For technical support:
  • Check documentation in the "docs" folder
  • Review troubleshooting guides
  • Contact your IT administrator

For system updates:
  • Download new distribution package
  • Backup your current installation
  • Extract new package
  • Run installation scripts
  • Restore data from backup

LICENSING
---------
This software is provided for educational use in schools.
Refer to LICENSE file for full terms.

VERSION HISTORY
---------------
v1.0.0 - Initial Release
  • Core library management features
  • Student, book, and equipment tracking
  • User roles and permissions
  • Data import/export
  • Reports and analytics
  • Docker-based deployment

PACKAGE CONTENTS
----------------
Backend/           - Backend source code and configuration
Frontend/          - Frontend source code and assets
docker/            - Docker configuration files
docs/              - Documentation (Installation Guide, README, etc.)
scripts/           - Utility scripts
INSTALL.bat        - One-click installer
START.bat          - Start services
STOP.bat           - Stop services
docker-compose.*   - Docker service definitions

IMPORTANT NOTES
---------------
1. This package does NOT include Docker Desktop
   You must install Docker Desktop separately

2. All data is stored locally on your computer
   Regular backups are recommended

3. The system requires administrator access for installation

4. Internet connection is required for:
   - Initial Docker image downloads
   - Installing Docker Desktop

5. Ports 3000, 3001, 3308, and 6380 must be available
   Close other applications if these ports are in use

===============================================================================
Thank you for choosing CLMS for your library management needs!
For questions or support, please refer to the documentation.
===============================================================================
