# Database Setup Guide

This document provides instructions for setting up the databases required for CLMS.

## Overview

CLMS uses two MySQL databases:

- **CLMS Database**: For storing student activities, equipment sessions, and application data
- **Koha Database**: Read-only access to existing library system (optional)

## 1. MySQL Server Installation

### Ubuntu/Debian

```bash
sudo apt update
sudo apt install mysql-server
sudo mysql_secure_installation
```

### Windows

1. Download MySQL Installer from https://dev.mysql.com/downloads/installer/
2. Run the installer and select "Server only"
3. Follow the installation wizard
4. Set root password and configure security

## 2. Database Creation

### Connect to MySQL

```bash
mysql -u root -p
```

### Create CLMS Database

```sql
CREATE DATABASE clms_database CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'clms_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON clms_database.* TO 'clms_user'@'localhost';
FLUSH PRIVILEGES;
```

### Create Koha Database User (Optional)

```sql
CREATE USER 'koha_user'@'localhost' IDENTIFIED BY 'koha_password';
GRANT SELECT ON koha_database.* TO 'koha_user'@'localhost';
FLUSH PRIVILEGES;
```

## 3. Table Structure

### Student Activities Table

```sql
USE clms_database;

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
    google_synced BOOLEAN DEFAULT FALSE,
    sync_attempts INT DEFAULT 0,
    processed_by VARCHAR(50) DEFAULT 'Sophia',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_student_id (student_id),
    INDEX idx_start_time (start_time),
    INDEX idx_status (status),
    INDEX idx_grade_category (grade_category),
    INDEX idx_activity_type (activity_type)
);
```

### Students Table

```sql
CREATE TABLE students (
    id CHAR(25) PRIMARY KEY,
    student_id VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    grade_level VARCHAR(20) NOT NULL,
    grade_category ENUM('primary','gradeSchool','juniorHigh','seniorHigh'),
    section VARCHAR(50),
    barcode VARCHAR(32),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_student_id (student_id),
    INDEX idx_grade_category (grade_category),
    INDEX idx_is_active (is_active)
);
```

### Equipment Table

```sql
CREATE TABLE equipment (
    id CHAR(25) PRIMARY KEY,
    equipment_id VARCHAR(50) UNIQUE NOT NULL,
    type ENUM('computer','gaming','avr','printer','scanner','other') NOT NULL,
    name VARCHAR(100) NOT NULL,
    status ENUM('available','in-use','maintenance','offline') DEFAULT 'available',
    location VARCHAR(100),
    max_time_minutes INT,
    requires_supervision BOOLEAN DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_type (type),
    INDEX idx_status (status)
);
```

### Equipment Sessions Table

```sql
CREATE TABLE equipment_sessions (
    id CHAR(25) PRIMARY KEY,
    equipment_id CHAR(25) NOT NULL,
    student_id CHAR(25) NOT NULL,
    session_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_end TIMESTAMP NULL,
    planned_end TIMESTAMP NULL,
    actual_duration INT,
    status ENUM('active','completed','expired','extended','terminated') DEFAULT 'active',
    extensions INT DEFAULT 0,
    notes TEXT,
    processed_by VARCHAR(100) DEFAULT 'Sophia',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_equipment_id (equipment_id),
    INDEX idx_student_id (student_id),
    INDEX idx_status (status)
);
```

### Automation Jobs Table

```sql
CREATE TABLE automation_jobs (
    id CHAR(25) PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    type ENUM('DAILY_BACKUP','TEACHER_NOTIFICATIONS','GOOGLE_SHEETS_SYNC','SESSION_EXPIRY_CHECK','OVERDUE_NOTIFICATIONS','WEEKLY_CLEANUP','MONTHLY_REPORT','INTEGRITY_AUDIT') NOT NULL,
    schedule VARCHAR(50) NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMP NULL,
    next_run_at TIMESTAMP NULL,
    status ENUM('idle','running','completed','failed','cancelled','retrying') DEFAULT 'idle',
    total_runs INT DEFAULT 0,
    success_count INT DEFAULT 0,
    failure_count INT DEFAULT 0,
    average_duration_ms INT,
    config JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_type (type),
    INDEX idx_is_enabled (is_enabled),
    INDEX idx_status (status)
);
```

### Automation Logs Table

```sql
CREATE TABLE automation_logs (
    id CHAR(25) PRIMARY KEY,
    job_id CHAR(25) NOT NULL,
    execution_id VARCHAR(100) UNIQUE NOT NULL,
    status ENUM('idle','running','completed','failed','cancelled','retrying') NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    duration_ms INT,
    success BOOLEAN NOT NULL,
    records_processed INT,
    error_message TEXT,
    error_details JSON,
    triggered_by VARCHAR(50) DEFAULT 'SCHEDULED',
    INDEX idx_job_id (job_id),
    INDEX idx_status (status),
    INDEX idx_started_at (started_at),
    INDEX idx_success (success)
);
```

## 4. Initial Data

### Insert Equipment

```sql
INSERT INTO equipment (equipment_id, type, name, location) VALUES
('PC001', 'computer', 'Computer Station 1', 'Main Library'),
('PC002', 'computer', 'Computer Station 2', 'Main Library'),
('PC003', 'computer', 'Computer Station 3', 'Main Library'),
('PC004', 'computer', 'Computer Station 4', 'Main Library'),
('PC005', 'computer', 'Computer Station 5', 'Main Library'),
('PC006', 'computer', 'Computer Station 6', 'Main Library'),
('PC007', 'computer', 'Computer Station 7', 'Main Library'),
('PC008', 'computer', 'Computer Station 8', 'Main Library'),
('PS001', 'gaming', 'PlayStation 1', 'Gaming Room'),
('PS002', 'gaming', 'PlayStation 2', 'Gaming Room'),
('PS003', 'gaming', 'PlayStation 3', 'Gaming Room'),
('PS004', 'gaming', 'PlayStation 4', 'Gaming Room'),
('VR001', 'avr', 'VR Station 1', 'AVR Room'),
('VR002', 'avr', 'VR Station 2', 'AVR Room');
```

## 5. Environment Configuration

Update the `.env` file in the Backend directory:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=clms_user
DB_PASSWORD=your_password
DB_NAME=clms_database

# Koha Integration (Optional)
KOHA_DB_HOST=localhost
KOHA_DB_PORT=3306
KOHA_DB_USER=koha_user
KOHA_DB_PASSWORD=koha_password
KOHA_DB_NAME=koha_database
```

## 6. Testing the Connection

Start the backend server to test the database connection:

```bash
cd Backend
npm install
npm run dev
```

The server should display:

```text
✅ Database connections established
🚀 CLMS Backend Server running on port 3001
```

## 7. Backup and Recovery

### Backup the Database

```bash
mysqldump -u clms_user -p clms_database > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore the Database

```bash
mysql -u clms_user -p clms_database < backup_20241009_200000.sql
```

## 8. Maintenance

### Regular Maintenance Tasks

- Clear old activity logs (keep last 2 years)
- Optimize tables monthly
- Check disk space usage
- Monitor slow queries

### Sample Maintenance Query

```sql
-- Delete activities older than 2 years
DELETE FROM activities
WHERE start_time < DATE_SUB(NOW(), INTERVAL 2 YEAR);

-- Optimize tables
OPTIMIZE TABLE activities, students, equipment, equipment_sessions, automation_logs;
```

## Troubleshooting

### Common Issues

1. **Connection Refused**

   - Check if MySQL server is running
   - Verify credentials in .env file
   - Check firewall settings

2. **Permission Denied**

   - Ensure database user has correct privileges
   - Check username and password

3. **Table Doesn't Exist**
   - Run the table creation scripts
   - Verify you're using the correct database

### Health Check

You can check database health by visiting:

```text
http://localhost:3001/health
```

This will return database connection status and other system information.
