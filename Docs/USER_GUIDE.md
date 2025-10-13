# CLMS User Guide

## Table of Contents
1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Student Management](#student-management)
4. [Book Management](#book-management)
5. [Equipment Management](#equipment-management)
6. [Activity Tracking](#activity-tracking)
7. [Self-Service Mode](#self-service-mode)
8. [Advanced Analytics](#advanced-analytics)
9. [Real-Time Features](#real-time-features)
10. [Reports & Analytics](#reports--analytics)
11. [Barcode & QR Code Management](#barcode--qr-code-management)
12. [Import & Export](#import--export)
13. [Settings & Configuration](#settings--configuration)
14. [Security & Privacy](#security--privacy)
15. [Troubleshooting](#troubleshooting)

## Getting Started

### System Requirements
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection
- Login credentials provided by administrator

### First Login
1. Open your web browser and navigate to the CLMS URL
2. Enter your username and password
3. Click "Login"
4. You will be redirected to the main dashboard

### Dashboard Navigation
The main dashboard uses a tabbed interface for easy navigation:
- **Dashboard**: Overview and quick stats
- **Activity**: Student check-in/out operations
- **Students**: Student records management
- **Books**: Book catalog and circulation
- **Checkout**: Book checkout management
- **Equipment**: Equipment tracking
- **Automation**: Automated tasks and jobs
- **Analytics**: Reports and statistics
- **Import**: Bulk data import
- **QR Codes**: QR code generation
- **Barcodes**: Barcode management
- **Settings**: System configuration

### Keyboard Shortcuts
- **Alt + 1-9**: Quick navigation to tabs
- **Ctrl/Cmd + K**: Global search
- **Ctrl/Cmd + /**: Show help
- **F5**: Refresh system
- **Esc**: Exit self-service mode

## Dashboard Overview

The main dashboard provides a comprehensive overview of library operations:

### Key Metrics
- **Total Students**: Number of active students in the system
- **Total Books**: Complete book catalog count
- **Total Equipment**: Available equipment items
- **Active Sessions**: Currently active student activities

### Quick Actions
- **Add Student**: Quickly add a new student
- **Scan Activity**: Start barcode scanning for student check-in/out
- **Generate Reports**: Access commonly used reports
- **System Health**: Check system status and performance

### Recent Activity Feed
Shows the latest 10 activities including:
- Student check-ins and check-outs
- Book circulations
- Equipment usage
- System notifications

## Student Management

### Adding a New Student
1. Navigate to the **Students** tab
2. Click **"Add Student"** button
3. Fill in the required information:
   - **Student ID**: Unique identifier (format: YYYY + 4-digit number)
   - **First Name**: Student's first name
   - **Last Name**: Student's last name
   - **Grade Level**: Current grade (e.g., "Grade 7")
   - **Grade Category**: Automatically selected based on grade level
   - **Section**: Class section (e.g., "7-A")
4. Click **"Save Student"**

### Searching for Students
1. In the Students tab, use the search bar
2. Search by:
   - Student ID
   - First name
   - Last name
   - Grade level
   - Section
3. Results update in real-time as you type

### Editing Student Information
1. Find the student using search or browse
2. Click the **Edit** button next to the student record
3. Update the required fields
4. Click **"Save Changes"**

### Student Status Management
- **Active**: Student can use all library services
- **Inactive**: Student cannot check in/out or use equipment
- **Deactivate**: Change status from Active to Inactive
- **Reactivate**: Change status from Inactive to Active

### Bulk Operations
1. Select multiple students using checkboxes
2. Choose from bulk actions:
   - **Export**: Download selected student data
   - **Deactivate**: Set multiple students to inactive
   - **Generate Barcodes**: Create barcodes for selected students

## Book Management

### Adding New Books
1. Navigate to the **Books** tab
2. Click **"Add Book"**
3. Enter book information:
   - **Accession Number**: Unique book identifier
   - **Title**: Book title
   - **Author**: Book author
   - **Publisher**: Publishing company
   - **ISBN**: ISBN-13 number (optional)
   - **Category**: Book category
   - **Location**: Physical location in library
4. Click **"Save Book"**

### Book Search and Filtering
- **Search**: Find books by title, author, or ISBN
- **Filter by Category**: Narrow down by book categories
- **Filter by Status**: Available, Checked Out, Maintenance, Lost
- **Filter by Location**: Books in specific library areas

### Book Checkout Process
1. Navigate to **Checkout** tab
2. Enter or scan the student ID
3. Enter or scan the book accession number
4. Set due date (automatically calculated based on settings)
5. Click **"Checkout Book"**

### Book Return Process
1. Navigate to **Checkout** tab
2. Enter or scan the book accession number
3. Select return condition (Good, Damaged, Lost)
4. Add any notes about the book condition
5. Click **"Return Book"**

### Checkout History
- View all checkouts and returns
- Filter by date range, student, or book
- Export checkout reports
- Track overdue books

## Equipment Management

### Adding Equipment
1. Navigate to **Equipment** tab
2. Click **"Add Equipment"**
3. Fill in equipment details:
   - **Name**: Equipment name
   - **Category**: Computer, Audio Visual, Furniture, Other
   - **Description**: Detailed description
   - **Location**: Where equipment is located
   - **Asset Tag**: Unique asset identifier
4. Click **"Save Equipment"**

### Equipment Checkout
1. Scan or enter student ID
2. Select equipment to check out
3. Specify purpose of use
4. Click **"Checkout Equipment"**

### Equipment Return
1. Scan or select equipment
2. Enter return condition
3. Add any notes about usage
4. Click **"Return Equipment"**

### Equipment Usage Tracking
- **Real-time Status**: See current availability
- **Usage History**: Track usage patterns
- **Maintenance Scheduling**: Plan equipment maintenance
- **Location Management**: Track equipment movement

## Activity Tracking

### Student Check-In/Out
There are two ways to track student activities:

#### Manual Entry
1. Navigate to **Activity** tab
2. Enter student ID manually
3. Select activity type:
   - **Study**: General library study
   - **Computer Use**: Computer workstation usage
   - **Research**: Research activities
   - **Reading**: Book reading
   - **Group Work**: Collaborative activities
4. Click **"Start Activity"**

#### Barcode Scanning
1. Use USB barcode scanner
2. Scan student ID barcode
3. System automatically starts activity
4. Activity type defaults to "Study" or last used type

### Activity Management
- **View Active Sessions**: See all currently active activities
- **End Activity**: Manually end student activities
- **Activity History**: View past activities
- **Time Tracking**: Automatic duration calculation

### Self-Service Mode
For allowing students to check themselves in/out:
1. Navigate to self-service URL or enable self-service mode
2. Students scan their ID cards
3. System automatically handles check-in/out
4. 30-minute cooldown prevents duplicate scans
5. Sound and visual feedback confirms successful scan

## Self-Service Mode

### Enabling Self-Service
1. Navigate to **Settings** → **Self-Service**
2. Enable self-service mode
3. Configure:
   - Default activity type
   - Time limits
   - Cooldown period (default: 30 minutes)
   - Sound feedback

### Student Experience
1. Student scans ID card at barcode scanner
2. System displays welcome message with student name
3. Check-in/out happens automatically
4. Visual and audio feedback confirms action
5. System prevents duplicate scans within cooldown period

### Benefits
- **Reduced Staff Workload**: Students handle their own check-ins
- **Faster Processing**: No manual data entry required
- **Accurate Time Tracking**: Automatic timestamps
- **24/7 Availability**: Self-service works outside staff hours

## Advanced Analytics

### Predictive Insights Dashboard
The Advanced Analytics system provides predictive insights to help optimize library operations:

#### Understanding Predictive Insights
- **Demand Forecast**: Predicts equipment usage and student visits
- **Peak Usage Prediction**: Identifies busiest times and days
- **Resource Optimization**: Suggests better resource allocation
- **Anomaly Detection**: Flags unusual activity patterns

#### Accessing Analytics
1. Navigate to **Analytics** tab
2. Select **Predictive Insights** from the sidebar
3. Choose timeframe: Day, Week, or Month
4. Review insights with confidence scores and recommendations

#### Interpreting Insights
- **Confidence Score**: 90-100% (Very High), 75-89% (High), 60-74% (Medium)
- **Impact Level**: High (critical actions needed), Medium (monitoring advised), Low (informational)
- **Recommendations**: Actionable suggestions based on data analysis

#### Acting on Recommendations
**High Priority Alerts:**
- Equipment utilization > 80%: Consider adding resources
- Peak hour predictions: Schedule staff breaks accordingly
- Demand increases: Prepare for additional capacity

### Usage Heat Maps
Visual representation of library usage patterns:

#### Features
- **Hour-by-Day Grid**: Shows intensity of usage throughout the week
- **Activity Types**: Filter by computer use, study sessions, etc.
- **Grade Level Analysis**: Usage patterns by student grade
- **Location Tracking**: Usage by library areas

#### Using Heat Maps
1. Select desired timeframe (Day/Week/Month)
2. Apply filters for activity type or grade level
3. Identify peak usage times (darker colors = higher usage)
4. Use insights for scheduling and resource planning

### Time Series Forecasts
Future predictions based on historical data:

#### Available Metrics
- **Student Visits**: Daily visitor count predictions
- **Equipment Usage**: Resource utilization forecasts
- **Book Circulation**: Borrowing/returning trends

#### Understanding Forecasts
- **Predicted Values**: Forecasted usage (blue line)
- **Confidence Bounds**: Upper and lower prediction limits
- **Time Periods**: Future predictions for next 7-30 days

### Resource Utilization Analysis
Monitor and optimize resource usage:

#### Key Metrics
- **Utilization Rate**: Percentage of time resources are in use
- **Risk Levels**: Low/Medium/High based on utilization
- **Capacity Planning**: Recommended resource additions

#### Optimization Strategies
- **Underutilized Resources**: Promote or repurpose (usage < 30%)
- **Overutilized Resources**: Add capacity or implement time limits (usage > 80%)
- **Balanced Usage**: Implement dynamic scheduling

## Real-Time Features

### Live Dashboard Updates
Experience real-time updates without manual refresh:

#### Real-Time Elements
- **Student Check-ins/Outs**: Instant activity updates
- **Equipment Status**: Live availability changes
- **System Notifications**: Immediate alerts and messages
- **Usage Statistics**: Real-time metric updates

#### Connection Status
- **Green Indicator**: Connected and receiving updates
- **Yellow Indicator**: Intermittent connection
- **Red Indicator**: Disconnected - last known data shown

### Real-Time Notifications
Stay informed with instant notifications:

#### Notification Types
- **Time Limit Warnings**: 10 minutes before session ends
- **Equipment Available**: Resources become free for use
- **System Alerts**: Maintenance or important updates
- **Emergency Notifications**: Critical system messages

#### Managing Notifications
- **View All**: See complete notification history
- **Mark as Read**: Clear processed notifications
- **Filter by Type**: Focus on specific notification categories
- **Sound Alerts**: Audio notification for important messages

### Multi-User Collaboration
Work simultaneously with other staff members:

#### Shared Features
- **Live Activity Feed**: See actions by other users
- **Real-Time Availability**: Know when resources are being used
- **Collaborative Editing**: Multiple users can update simultaneously
- **Conflict Prevention**: System prevents duplicate actions

#### Best Practices
- **Communicate Actions**: Use system chat for coordination
- **Check Availability**: Verify real-time status before assigning
- **Avoid Conflicts**: System prevents simultaneous check-ins
- **Stay Updated**: Monitor live feed for system changes

### WebSocket Connection Status
Monitor connection health:

#### Status Indicators
- **Connected**: Green dot with "Connected" text
- **Reconnecting**: Yellow dot with "Reconnecting..." text
- **Disconnected**: Red dot with "Disconnected" text

#### Troubleshooting Connections
- **Refresh Page**: Re-establish WebSocket connection
- **Check Internet**: Verify network connectivity
- **Contact Admin**: Report persistent connection issues

## Reports & Analytics

### Dashboard Analytics
Real-time statistics displayed on main dashboard:
- **Student Traffic**: Daily/weekly visitor counts
- **Resource Usage**: Most used books and equipment
- **Peak Hours**: Busiest times of day
- **Activity Trends**: Usage patterns over time

### Available Reports
1. **Student Activity Report**
   - Individual student usage statistics
   - Time spent in library
   - Most frequent visitors
   - Activity type breakdown

2. **Book Circulation Report**
   - Checkout statistics
   - Most popular books
   - Overdue reports
   - Category usage analysis

3. **Equipment Usage Report**
   - Equipment utilization rates
   - Maintenance schedules
   - Usage patterns by time
   - Location-based analysis

4. **System Performance Report**
   - System uptime statistics
   - Response times
   - Error rates
   - User activity metrics

### Export Options
- **PDF Reports**: Formatted reports for printing
- **Excel/CSV**: Raw data for further analysis
- **JSON**: API-compatible format
- **Scheduled Reports**: Automated email delivery

### Custom Reports
Create custom reports by:
1. Selecting data sources
2. Defining filters and parameters
3. Choosing report format
4. Scheduling automatic generation

## Barcode & QR Code Management

### Student Barcodes
#### Generating Student Barcodes
1. Navigate to **Barcodes** tab
2. Select students or grade levels
3. Choose barcode format (Code 128)
4. Configure layout options:
   - Sheet size (A4, Letter)
   - Barcodes per row/column
   - Include student information
5. Click **"Generate Barcodes"**
6. Download PDF for printing

#### Barcode Sheets
- **Professional Layout**: Clean, organized barcode sheets
- **Student Information**: Name, ID, grade, section
- **Print-Ready**: Optimized for standard label printers
- **Batch Generation**: Create barcodes for multiple students at once

### QR Codes
#### Equipment QR Codes
1. Select equipment items
2. Generate QR codes containing:
   - Equipment ID
   - Name and description
   - Current status
   - Quick check-in/out link
3. Print on durable labels
4. Attach to equipment items

#### Location QR Codes
- Place at library entrances/exits
- Link to self-service interface
- Include library hours information
- Contact information for help

### Mobile Integration
- **Camera Scanning**: Use device camera for QR codes
- **Barcode Scanner Support**: USB scanner compatibility
- **Offline Mode**: Basic functionality without internet
- **Cross-Platform**: Works on iOS, Android, and desktop

## Import & Export

### Data Import
#### Supported Formats
- **CSV Files**: Comma-separated values
- **Excel Files**: .xlsx format
- **Google Sheets**: Direct integration

#### Importing Students
1. Prepare CSV file with columns:
   ```
   Student ID,First Name,Last Name,Grade Level,Section
   2023001,John,Doe,Grade 7,7-A
   2023002,Jane,Smith,Grade 8,8-B
   ```
2. Navigate to **Import** tab
3. Select **"Import Students"**
4. Upload CSV file
5. Map columns if necessary
6. Preview data before import
7. Click **"Import Data"**

#### Importing Books
1. Prepare CSV with columns:
   ```
   Accession Number,Title,Author,Publisher,Category,Location
   ACC001,Book Title,Author Name,Publisher,Fiction,Main Library
   ```
2. Follow same import process as students

#### Validation and Error Handling
- **Duplicate Detection**: Prevents duplicate entries
- **Data Validation**: Checks required fields and formats
- **Error Reports**: Detailed error information
- **Rollback**: Undo failed imports

### Data Export
#### Export Options
- **Student Data**: Complete student records
- **Book Catalog**: Full book inventory
- **Activity Logs**: Student activity history
- **System Reports**: Analytics and statistics

#### Export Formats
- **CSV**: Excel-compatible format
- **PDF**: Formatted reports
- **JSON**: API data format
- **XML**: Structured data format

#### Scheduled Exports
1. Navigate to **Settings** → **Automation**
2. Configure export schedules:
   - Daily/weekly/monthly
   - Specific data ranges
   - Email delivery
   - File naming conventions

## Settings & Configuration

### System Settings
#### General Configuration
- **Library Information**: Name, address, contact details
- **Operating Hours**: Library open/closing times
- **Time Zones**: Configure local time zone
- **Date Formats**: Customize date display

#### User Management
1. Navigate to **Settings** → **Users**
2. **Add User**: Create new user accounts
3. **Role Assignment**:
   - **Super Admin**: Full system access
   - **Admin**: Library management access
   - **Librarian**: Daily operations access
   - **Staff**: Limited access for specific tasks
   - **Viewer**: Read-only access
4. **Permission Management**: Fine-tune access rights

### Barcode Configuration
#### Scanner Settings
- **Scanner Type**: USB barcode scanner configuration
- **Keyboard Wedge**: Input method settings
- **Scan Timeout**: Auto-submit delay
- **Sound Feedback**: Audio confirmation settings

#### Barcode Formats
- **Student IDs**: Custom ID format rules
- **Book Numbers**: Accession number patterns
- **Equipment Tags**: Asset tag formats

### Self-Service Settings
#### Mode Configuration
- **Enable/Disable**: Turn self-service on/off
- **Default Activity**: Pre-selected activity type
- **Time Limits**: Maximum session duration
- **Cooldown Period**: Prevent duplicate scans

#### Display Settings
- **Welcome Message**: Custom greeting text
- **Theme Options**: Visual customization
- **Language**: Interface language
- **Accessibility**: Screen reader support

### Backup and Recovery
#### Automatic Backups
1. Navigate to **Settings** → **Backup**
2. Configure backup schedule:
   - Daily automatic backups
   - Weekly full backups
   - Monthly archival
3. Set backup retention period
4. Configure backup location (local/cloud)

#### Manual Backup
1. Click **"Backup Now"** button
2. Choose backup type:
   - **Database Only**: User and activity data
   - **Full System**: Complete system backup
   - **Files Only**: Documents and media
3. Download backup file

#### Recovery Process
1. Navigate to **Settings** → **Recovery**
2. Upload backup file
3. Select recovery options:
   - **Complete Restore**: Full system recovery
   - **Partial Restore**: Selective data recovery
   - **Preview**: View backup contents before restore

## Security & Privacy

### User Authentication
Secure login system with multiple security features:

#### Login Security
- **Strong Passwords**: Minimum 8 characters with mixed types
- **Session Management**: Automatic timeout after inactivity
- **Failed Login Protection**: Lockout after multiple attempts
- **Secure Connection**: Encrypted HTTPS connections

#### Password Management
- **Regular Updates**: Change passwords periodically
- **Password Requirements**: Include uppercase, lowercase, numbers, symbols
- **Password History**: Prevent reuse of recent passwords
- **Two-Factor Authentication**: Optional additional security layer

### Data Privacy Protection
Student and library data protection measures:

#### Student Privacy
- **Personal Information**: Only necessary data collected
- **Data Minimization**: Limited to library operations needs
- **Access Control**: Role-based access to sensitive information
- **Data Retention**: Automatic cleanup of old records

#### Information Security
- **Encryption**: Data encrypted at rest and in transit
- **Audit Logging**: Complete record of data access
- **Secure Storage**: Protected database with encryption
- **Backup Security**: Encrypted backup files

### Role-Based Access Control
Different access levels for different user types:

#### User Roles
- **Super Admin**: Complete system access and user management
- **Admin**: Library operations and configuration management
- **Librarian**: Daily operations and student management
- **Assistant**: Limited access for specific tasks
- **Teacher**: Read-only access to class data
- **Viewer**: Read-only access to public information

#### Permission Levels
- **Read Access**: View data and reports
- **Write Access**: Create and edit records
- **Delete Access**: Remove records (with confirmation)
- **Admin Access**: System configuration and user management

### Audit Trail
Complete tracking of all system activities:

#### What is Tracked
- **User Logins**: Successful and failed attempts
- **Data Changes**: All create, update, delete operations
- **Access Logs**: Who viewed what data and when
- **System Actions**: Configuration changes and administrative tasks

#### Viewing Audit Logs
1. Navigate to **Settings** → **Audit Logs**
2. Filter by date range, user, or action type
3. Export logs for compliance reporting
4. Search for specific events

### Security Best Practices
Recommended practices for maintaining system security:

#### Daily Security Habits
- **Strong Passwords**: Use unique, complex passwords
- **Secure Logout**: Always log out when finished
- **Screen Lock**: Lock computer when away from desk
- **Report Issues**: Immediately report suspicious activity

#### Data Protection
- **Limited Access**: Only access data needed for your role
- **Secure Sharing**: Use system features for data sharing
- **Backup Verification**: Regularly check backup systems
- **Update Software**: Keep browsers and systems updated

#### Privacy Protection
- **Student Data**: Handle student information with care
- **Public Screens**: Avoid displaying sensitive data publicly
- **Printed Reports**: Securely dispose of printed documents
- **Mobile Devices**: Use secure practices on phones/tablets

### Incident Response
What to do if you encounter security issues:

#### Suspicious Activity
1. **Stop**: Cease using the system immediately
2. **Report**: Contact administrator immediately
3. **Document**: Note what you observed and when
4. **Preserve**: Don't delete any evidence or logs

#### Data Breach Response
- **Immediate Notification**: Alert administrators right away
- **Password Change**: Change your password immediately
- **Account Review**: Review your account for unauthorized access
- **Follow Instructions**: Cooperate with security investigation

#### System Security Alerts
- **Take Seriously**: All security warnings are important
- **Don't Ignore**: Address alerts promptly
- **Ask Questions**: Contact IT if unsure about security messages
- **Stay Informed**: Keep up with security updates

## Troubleshooting

### Common Issues

#### Login Problems
**Issue**: Cannot log in to system
**Solutions**:
- Check username and password spelling
- Verify account is active
- Clear browser cache and cookies
- Try different browser
- Contact administrator if account locked

#### Barcode Scanner Not Working
**Issue**: Scanner not reading barcodes
**Solutions**:
- Check USB connection
- Verify scanner is in keyboard wedge mode
- Test with different barcodes
- Check barcode quality and contrast
- Restart scanner and computer

#### Slow Performance
**Issue**: System running slowly
**Solutions**:
- Check internet connection speed
- Clear browser cache
- Close unnecessary browser tabs
- Restart browser
- Contact administrator for server issues

#### Missing Data
**Issue**: Cannot find student or book records
**Solutions**:
- Check spelling in search
- Try different search terms
- Verify data was imported correctly
- Check filters applied to search
- Look in inactive records if applicable

#### Import Failures
**Issue**: Data import not working
**Solutions**:
- Verify CSV file format is correct
- Check for required columns
- Ensure data doesn't contain special characters
- Check file size limits
- Try importing smaller batches

### Error Messages

#### Common Error Codes
- **AUTHENTICATION_ERROR**: Login credentials invalid
- **PERMISSION_DENIED**: Insufficient access rights
- **VALIDATION_ERROR**: Required data missing or invalid
- **DUPLICATE_ENTRY**: Record already exists
- **NOT_FOUND**: Requested resource doesn't exist

#### Connection Errors
- **NETWORK_ERROR**: Internet connection problem
- **SERVER_ERROR**: Server temporarily unavailable
- **TIMEOUT_ERROR**: Request took too long
- **DATABASE_ERROR**: Data storage issue

### Getting Help

#### Self-Service Resources
- **Help Menu**: Access via Ctrl+/ or F1
- **Documentation**: Online user guides
- **FAQ Section**: Common questions and answers
- **Status Page**: System availability status

#### Contact Support
1. **Create Support Ticket**: Describe the issue in detail
2. **Include Error Messages**: Copy exact error text
3. **Screenshot**: Provide visual context if possible
4. **System Information**: Browser, OS, and version details
5. **Steps to Reproduce**: Detailed description of actions taken

#### Administrator Contact
- **Email**: library-support@school.edu
- **Phone**: (555) 123-4567
- **Office Hours**: Monday-Friday, 8:00 AM - 4:00 PM
- **Emergency**: After-hours support available for critical issues

### Best Practices

#### Daily Operations
- **Regular Backups**: End-of-day backup verification
- **Data Validation**: Check for duplicate or missing records
- **Performance Monitoring**: Watch for slow operations
- **User Feedback**: Collect and address user issues

#### Security Practices
- **Password Security**: Regular password updates
- **Access Control**: Review user permissions periodically
- **Data Privacy**: Protect sensitive student information
- **Session Management**: Log out when finished using system

#### Data Management
- **Regular Imports**: Keep data up-to-date
- **Clean Records**: Remove outdated or incorrect data
- **Documentation**: Keep records of system changes
- **Testing**: Test new features before full deployment