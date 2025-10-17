# Database Setup Guide

This document provides instructions for setting up the databases required for CLMS.

## Overview

CLMS uses two MySQL databases:

- **CLMS Database**: For storing student activities, equipment sessions, and application data
- **Koha Database**: Read-only access to existing library system (optional)

### 🚀 New in Version 2.0 (October 2025)

- **Repository Pattern Implementation**: New data access layer with flexible ID handling
- **Enhanced ID Management**: Support for multiple identifier types (database IDs, external identifiers)
- **Improved Performance**: Optimized database operations with better indexing
- **Type-Safe Database Operations**: Full TypeScript support with Prisma

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

## Repository Pattern and Flexible ID Handling

### Database Schema for Flexible ID Handling

The CLMS database schema is designed to support multiple identifier types for each entity, enabling flexible ID resolution through the repository pattern.

### ID Resolution Tables

#### Entity ID Mappings
```sql
-- Table to store all identifier mappings for entities
CREATE TABLE entity_id_mappings (
    id CHAR(25) PRIMARY KEY,
    entity_type ENUM('student', 'book', 'equipment', 'user') NOT NULL,
    entity_id CHAR(25) NOT NULL,         -- Reference to the entity
    identifier_type ENUM('database_id', 'external_id', 'barcode', 'qr_code', 'isbn') NOT NULL,
    identifier_value VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_entity_type (entity_type),
    INDEX idx_entity_id (entity_id),
    INDEX idx_identifier (identifier_type, identifier_value),
    INDEX idx_is_active (is_active),
    
    UNIQUE KEY unique_entity_identifier (entity_type, entity_id, identifier_type, identifier_value)
);
```

#### Enhanced Student Table
```sql
-- Updated student table with flexible ID support
CREATE TABLE students (
    id CHAR(25) PRIMARY KEY,                -- Internal database ID (UUID)
    student_id VARCHAR(50) UNIQUE NOT NULL, -- External student identifier
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    grade_level VARCHAR(20) NOT NULL,
    grade_category ENUM('primary','gradeSchool','juniorHigh','seniorHigh'),
    section VARCHAR(50),
    barcode VARCHAR(32),                    -- Barcode value (defaults to student_id)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_student_id (student_id),
    INDEX idx_grade_category (grade_category),
    INDEX idx_is_active (is_active),
    INDEX idx_barcode (barcode)
);
```

#### Enhanced Book Table
```sql
-- Updated book table with flexible ID support
CREATE TABLE books (
    id CHAR(25) PRIMARY KEY,                -- Internal database ID (UUID)
    accession_no VARCHAR(50) UNIQUE NOT NULL, -- External accession number
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    isbn VARCHAR(20),                       -- ISBN number
    publisher VARCHAR(100),
    publication_year INT,
    category VARCHAR(50),
    location VARCHAR(100),
    status ENUM('available','checked_out','reserved','maintenance') DEFAULT 'available',
    barcode VARCHAR(32),                    -- Barcode value (defaults to accession_no)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_accession_no (accession_no),
    INDEX idx_isbn (isbn),
    INDEX idx_status (status),
    INDEX idx_barcode (barcode),
    INDEX idx_is_active (is_active)
);
```

#### Enhanced Equipment Table
```sql
-- Updated equipment table with flexible ID support
CREATE TABLE equipment (
    id CHAR(25) PRIMARY KEY,                -- Internal database ID (UUID)
    equipment_id VARCHAR(50) UNIQUE NOT NULL, -- External equipment identifier
    type ENUM('computer','gaming','avr','printer','scanner','other') NOT NULL,
    name VARCHAR(100) NOT NULL,
    status ENUM('available','in-use','maintenance','offline') DEFAULT 'available',
    location VARCHAR(100),
    max_time_minutes INT,
    requires_supervision BOOLEAN DEFAULT FALSE,
    description TEXT,
    barcode VARCHAR(32),                    -- Barcode value (defaults to equipment_id)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_equipment_id (equipment_id),
    INDEX idx_type (type),
    INDEX idx_status (status),
    INDEX idx_barcode (barcode),
    INDEX idx_is_active (is_active)
);
```

### Repository Pattern Database Views

#### Flexible ID Resolution Views
```sql
-- View for flexible student ID resolution
CREATE VIEW v_student_id_resolution AS
SELECT
    s.id as database_id,
    s.student_id as external_id,
    s.barcode as barcode,
    CONCAT('{"type":"student","id":"', s.student_id, '"}') as qr_code,
    s.first_name,
    s.last_name,
    s.grade_level,
    s.grade_category,
    s.section,
    s.is_active
FROM students s
WHERE s.is_active = TRUE;

-- View for flexible book ID resolution
CREATE VIEW v_book_id_resolution AS
SELECT
    b.id as database_id,
    b.accession_no as external_id,
    b.barcode as barcode,
    CASE
        WHEN b.isbn IS NOT NULL THEN CONCAT('{"type":"book","id":"', b.accession_no, '","isbn":"', b.isbn, '"}')
        ELSE CONCAT('{"type":"book","id":"', b.accession_no, '"}')
    END as qr_code,
    b.title,
    b.author,
    b.isbn,
    b.publisher,
    b.publication_year,
    b.category,
    b.location,
    b.status,
    b.is_active
FROM books b
WHERE b.is_active = TRUE;

-- View for flexible equipment ID resolution
CREATE VIEW v_equipment_id_resolution AS
SELECT
    e.id as database_id,
    e.equipment_id as external_id,
    e.barcode as barcode,
    CONCAT('{"type":"equipment","id":"', e.equipment_id, '"}') as qr_code,
    e.type,
    e.name,
    e.status,
    e.location,
    e.max_time_minutes,
    e.requires_supervision,
    e.description,
    e.is_active
FROM equipment e
WHERE e.is_active = TRUE;
```

### Database Triggers for ID Mapping

#### Trigger for Student ID Mapping
```sql
-- Trigger to maintain ID mappings for students
DELIMITER //
CREATE TRIGGER tr_student_id_mapping
AFTER INSERT ON students
FOR EACH ROW
BEGIN
    -- Insert external ID mapping
    INSERT INTO entity_id_mappings (
        id, entity_type, entity_id, identifier_type, identifier_value
    ) VALUES (
        UUID(), 'student', NEW.id, 'external_id', NEW.student_id
    );
    
    -- Insert barcode mapping (if different from student_id)
    IF NEW.barcode IS NOT NULL AND NEW.barcode != NEW.student_id THEN
        INSERT INTO entity_id_mappings (
            id, entity_type, entity_id, identifier_type, identifier_value
        ) VALUES (
            UUID(), 'student', NEW.id, 'barcode', NEW.barcode
        );
    END IF;
END//
DELIMITER ;
```

#### Trigger for Book ID Mapping
```sql
-- Trigger to maintain ID mappings for books
DELIMITER //
CREATE TRIGGER tr_book_id_mapping
AFTER INSERT ON books
FOR EACH ROW
BEGIN
    -- Insert external ID mapping
    INSERT INTO entity_id_mappings (
        id, entity_type, entity_id, identifier_type, identifier_value
    ) VALUES (
        UUID(), 'book', NEW.id, 'external_id', NEW.accession_no
    );
    
    -- Insert barcode mapping (if different from accession_no)
    IF NEW.barcode IS NOT NULL AND NEW.barcode != NEW.accession_no THEN
        INSERT INTO entity_id_mappings (
            id, entity_type, entity_id, identifier_type, identifier_value
        ) VALUES (
            UUID(), 'book', NEW.id, 'barcode', NEW.barcode
        );
    END IF;
    
    -- Insert ISBN mapping (if available)
    IF NEW.isbn IS NOT NULL THEN
        INSERT INTO entity_id_mappings (
            id, entity_type, entity_id, identifier_type, identifier_value
        ) VALUES (
            UUID(), 'book', NEW.id, 'isbn', NEW.isbn
        );
    END IF;
END//
DELIMITER ;
```

### Stored Procedures for ID Resolution

#### Procedure to Resolve Entity by Any ID
```sql
-- Stored procedure to resolve entity by any identifier
DELIMITER //
CREATE PROCEDURE sp_resolve_entity_by_id(
    IN p_identifier VARCHAR(255),
    IN p_entity_type VARCHAR(20),
    OUT p_result JSON
)
BEGIN
    DECLARE v_found BOOLEAN DEFAULT FALSE;
    DECLARE v_entity_id CHAR(25);
    DECLARE v_identifier_type VARCHAR(20);
    
    -- Try to find the entity by any identifier
    SELECT
        eim.entity_id,
        eim.identifier_type
    INTO v_entity_id, v_identifier_type
    FROM entity_id_mappings eim
    WHERE eim.identifier_value = p_identifier
    AND eim.entity_type = p_entity_type
    AND eim.is_active = TRUE
    LIMIT 1;
    
    -- If found, return the entity data
    IF v_entity_id IS NOT NULL THEN
        CASE p_entity_type
            WHEN 'student' THEN
                SELECT JSON_OBJECT(
                    'success', TRUE,
                    'data', JSON_OBJECT(
                        'id', s.id,
                        'studentId', s.student_id,
                        'firstName', s.first_name,
                        'lastName', s.last_name,
                        'gradeLevel', s.grade_level,
                        'gradeCategory', s.grade_category,
                        'section', s.section,
                        'barcode', s.barcode,
                        'isActive', s.is_active
                    ),
                    'identifierType', v_identifier_type
                ) INTO p_result
                FROM students s
                WHERE s.id = v_entity_id;
            
            WHEN 'book' THEN
                SELECT JSON_OBJECT(
                    'success', TRUE,
                    'data', JSON_OBJECT(
                        'id', b.id,
                        'accessionNo', b.accession_no,
                        'title', b.title,
                        'author', b.author,
                        'isbn', b.isbn,
                        'publisher', b.publisher,
                        'publicationYear', b.publication_year,
                        'category', b.category,
                        'location', b.location,
                        'status', b.status,
                        'barcode', b.barcode,
                        'isActive', b.is_active
                    ),
                    'identifierType', v_identifier_type
                ) INTO p_result
                FROM books b
                WHERE b.id = v_entity_id;
            
            WHEN 'equipment' THEN
                SELECT JSON_OBJECT(
                    'success', TRUE,
                    'data', JSON_OBJECT(
                        'id', e.id,
                        'equipmentId', e.equipment_id,
                        'type', e.type,
                        'name', e.name,
                        'status', e.status,
                        'location', e.location,
                        'maxTimeMinutes', e.max_time_minutes,
                        'requiresSupervision', e.requires_supervision,
                        'description', e.description,
                        'barcode', e.barcode,
                        'isActive', e.is_active
                    ),
                    'identifierType', v_identifier_type
                ) INTO p_result
                FROM equipment e
                WHERE e.id = v_entity_id;
        END CASE;
        
        SET v_found = TRUE;
    ELSE
        -- Entity not found
        SELECT JSON_OBJECT(
            'success', FALSE,
            'error', CONCAT(p_entity_type, ' not found'),
            'identifier', p_identifier
        ) INTO p_result;
    END IF;
END//
DELIMITER ;
```

### Database Performance Optimization

#### Indexes for Flexible ID Resolution
```sql
-- Optimized indexes for ID resolution queries
CREATE INDEX idx_entity_id_mappings_composite ON entity_id_mappings(
    entity_type,
    identifier_type,
    identifier_value,
    is_active
);

-- Full-text search indexes for better text-based ID resolution
CREATE FULLTEXT INDEX idx_books_title_author ON books(title, author);
CREATE FULLTEXT INDEX idx_students_name ON students(first_name, last_name);
```

#### Partitioning for Large Tables
```sql
-- Partition student_activities table by date for better performance
ALTER TABLE student_activities
PARTITION BY RANGE (YEAR(start_time)) (
    PARTITION p2023 VALUES LESS THAN (2024),
    PARTITION p2024 VALUES LESS THAN (2025),
    PARTITION p2025 VALUES LESS THAN (2026),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);
```

### Database Migration for Repository Pattern

#### Migration Script
```sql
-- Migration script to add repository pattern support
-- Run this script to update existing database to support repository pattern

-- Step 1: Create entity_id_mappings table
CREATE TABLE IF NOT EXISTS entity_id_mappings (
    id CHAR(25) PRIMARY KEY,
    entity_type ENUM('student', 'book', 'equipment', 'user') NOT NULL,
    entity_id CHAR(25) NOT NULL,
    identifier_type ENUM('database_id', 'external_id', 'barcode', 'qr_code', 'isbn') NOT NULL,
    identifier_value VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_entity_type (entity_type),
    INDEX idx_entity_id (entity_id),
    INDEX idx_identifier (identifier_type, identifier_value),
    INDEX idx_is_active (is_active),
    
    UNIQUE KEY unique_entity_identifier (entity_type, entity_id, identifier_type, identifier_value)
);

-- Step 2: Populate ID mappings for existing students
INSERT IGNORE INTO entity_id_mappings (
    id, entity_type, entity_id, identifier_type, identifier_value
)
SELECT
    UUID() as id,
    'student' as entity_type,
    s.id as entity_id,
    'external_id' as identifier_type,
    s.student_id as identifier_value
FROM students s;

-- Step 3: Populate ID mappings for existing books
INSERT IGNORE INTO entity_id_mappings (
    id, entity_type, entity_id, identifier_type, identifier_value
)
SELECT
    UUID() as id,
    'book' as entity_type,
    b.id as entity_id,
    'external_id' as identifier_type,
    b.accession_no as identifier_value
FROM books b;

-- Step 4: Populate ID mappings for existing equipment
INSERT IGNORE INTO entity_id_mappings (
    id, entity_type, entity_id, identifier_type, identifier_value
)
SELECT
    UUID() as id,
    'equipment' as entity_type,
    e.id as entity_id,
    'external_id' as identifier_type,
    e.equipment_id as identifier_value
FROM equipment e;

-- Step 5: Create ID resolution views
CREATE OR REPLACE VIEW v_student_id_resolution AS
SELECT
    s.id as database_id,
    s.student_id as external_id,
    s.barcode as barcode,
    CONCAT('{"type":"student","id":"', s.student_id, '"}') as qr_code,
    s.first_name,
    s.last_name,
    s.grade_level,
    s.grade_category,
    s.section,
    s.is_active
FROM students s
WHERE s.is_active = TRUE;

CREATE OR REPLACE VIEW v_book_id_resolution AS
SELECT
    b.id as database_id,
    b.accession_no as external_id,
    b.barcode as barcode,
    CASE
        WHEN b.isbn IS NOT NULL THEN CONCAT('{"type":"book","id":"', b.accession_no, '","isbn":"', b.isbn, '"}')
        ELSE CONCAT('{"type":"book","id":"', b.accession_no, '"}')
    END as qr_code,
    b.title,
    b.author,
    b.isbn,
    b.publisher,
    b.publication_year,
    b.category,
    b.location,
    b.status,
    b.is_active
FROM books b
WHERE b.is_active = TRUE;

CREATE OR REPLACE VIEW v_equipment_id_resolution AS
SELECT
    e.id as database_id,
    e.equipment_id as external_id,
    e.barcode as barcode,
    CONCAT('{"type":"equipment","id":"', e.equipment_id, '"}') as qr_code,
    e.type,
    e.name,
    e.status,
    e.location,
    e.max_time_minutes,
    e.requires_supervision,
    e.description,
    e.is_active
FROM equipment e
WHERE e.is_active = TRUE;

-- Step 6: Create stored procedures for ID resolution
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS sp_resolve_entity_by_id(
    IN p_identifier VARCHAR(255),
    IN p_entity_type VARCHAR(20),
    OUT p_result JSON
)
BEGIN
    -- Implementation as shown above
END//
DELIMITER ;
```

### Using the Repository Pattern with Database

#### Example Queries
```sql
-- Find student by any identifier
CALL sp_resolve_entity_by_id('STU001', 'student', @result);
SELECT @result;

-- Find book by any identifier
CALL sp_resolve_entity_by_id('ACC-001', 'book', @result);
SELECT @result;

-- Find equipment by any identifier
CALL sp_resolve_entity_by_id('PC001', 'equipment', @result);
SELECT @result;

-- Query all identifiers for a student
SELECT
    database_id,
    external_id,
    barcode,
    qr_code
FROM v_student_id_resolution
WHERE database_id = 'student-uuid-here';

-- Get ID mapping statistics
SELECT
    entity_type,
    identifier_type,
    COUNT(*) as count
FROM entity_id_mappings
WHERE is_active = TRUE
GROUP BY entity_type, identifier_type
ORDER BY entity_type, identifier_type;
```

This enhanced database setup provides the foundation for the flexible ID handling system used by the repository pattern in the CLMS application.
