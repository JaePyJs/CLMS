-- Performance Optimization Migration
-- Created: November 5, 2025
-- Purpose: Add database indexes for improved query performance

-- Students table indexes
CREATE INDEX idx_students_grade_level ON students(grade_level);
CREATE INDEX idx_students_is_active ON students(is_active);
CREATE INDEX idx_students_created_at ON students(created_at DESC);
CREATE INDEX idx_students_barcode ON students(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_students_grade_category ON students(grade_category);

-- Books table indexes
CREATE INDEX idx_books_category ON books(category);
CREATE INDEX idx_books_is_active ON books(is_active);
CREATE INDEX idx_books_created_at ON books(created_at DESC);
CREATE INDEX idx_books_isbn ON books(isbn) WHERE isbn IS NOT NULL;
CREATE INDEX idx_books_available_copies ON books(available_copies);

-- Book checkouts table indexes (critical for analytics)
CREATE INDEX idx_book_checkouts_status ON book_checkouts(status);
CREATE INDEX idx_book_checkouts_due_date ON book_checkouts(due_date);
CREATE INDEX idx_book_checkouts_checkout_date ON book_checkouts(checkout_date DESC);
CREATE INDEX idx_book_checkouts_student_id ON book_checkouts(student_id);
CREATE INDEX idx_book_checkouts_book_id ON book_checkouts(book_id);
CREATE INDEX idx_book_checkouts_status_due_date ON book_checkouts(status, due_date);
CREATE INDEX idx_book_checkouts_active_overdue ON book_checkouts(status, due_date)
    WHERE status = 'ACTIVE' AND due_date < NOW();

-- Equipment table indexes
CREATE INDEX idx_equipment_status ON equipment(status);
CREATE INDEX idx_equipment_category ON equipment(category);
CREATE INDEX idx_equipment_is_active ON equipment(is_active);

-- Student activities table indexes
CREATE INDEX idx_student_activities_student_id ON student_activities(student_id);
CREATE INDEX idx_student_activities_activity_type ON student_activities(activity_type);
CREATE INDEX idx_student_activities_created_at ON student_activities(created_at DESC);

-- Composite indexes for common query patterns
-- Dashboard analytics: Active students by grade level
CREATE INDEX idx_students_grade_active ON students(grade_level, is_active);

-- Book availability: Active books by category
CREATE INDEX idx_books_category_active ON books(category, is_active);

-- Overdue checkouts: Active with past due date
CREATE INDEX idx_checkouts_overdue ON book_checkouts(status, due_date)
    WHERE status = 'ACTIVE' AND due_date < NOW();

-- Recent checkouts for analytics
CREATE INDEX idx_checkouts_recent ON book_checkouts(checkout_date DESC, status);

-- Performance note:
-- These indexes are designed for the most common query patterns:
-- 1. Filtering by status (ACTIVE, AVAILABLE, etc.)
-- 2. Filtering by category (grade level, book category, equipment category)
-- 3. Ordering by created_at for recent items
-- 4. Date-based filtering (due_date for overdue items)
-- 5. Barcode lookups for scanning workflows
