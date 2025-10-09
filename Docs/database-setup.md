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
    n8n_synced BOOLEAN DEFAULT FALSE,
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
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    grade_level VARCHAR(5) NOT NULL,
    grade_category ENUM('primary','gradeSchool','juniorHigh','seniorHigh'),
    barcode VARCHAR(13) UNIQUE NOT NULL,
    koha_id VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_barcode (barcode),
    INDEX idx_student_id (student_id)
);
```

### Equipment Table
```sql
CREATE TABLE equipment (
    id INT PRIMARY KEY AUTO_INCREMENT,
    equipment_id VARCHAR(20) UNIQUE NOT NULL,
    type ENUM('computer','gaming','avr') NOT NULL,
    name VARCHAR(100) NOT NULL,
    status ENUM('available','in-use','maintenance','offline') DEFAULT 'available',
    location VARCHAR(100),
    specifications JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_type (type),
    INDEX idx_status (status)
);
```

### Equipment Sessions Table
```sql
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
    status ENUM('active','completed','expired','extended') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_equipment_id (equipment_id),
    INDEX idx_student_id (student_id),
    INDEX idx_status (status)
);
```

### n8n Workflow Logs Table
```sql
CREATE TABLE n8n_workflow_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    workflow_name VARCHAR(100) NOT NULL,
    execution_id VARCHAR(100),
    status ENUM('running','completed','failed','queued'),
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP NULL,
    error_message TEXT,
    data_processed INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_workflow_name (workflow_name),
    INDEX idx_status (status),
    INDEX idx_start_time (start_time)
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
```
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
DELETE FROM student_activities
WHERE start_time < DATE_SUB(NOW(), INTERVAL 2 YEAR);

-- Optimize tables
OPTIMIZE TABLE student_activities, students, equipment, equipment_sessions, n8n_workflow_logs;
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
```
http://localhost:3001/health
```

This will return database connection status and other system information.