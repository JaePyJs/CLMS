/**
 * Repositories Module
 * 
 * Exports all repository classes and instances for the application.
 * This module provides a clean abstraction layer over database operations
 * with automatic field population, error handling, and logging.
 */

// Base repository class
export { BaseRepository } from './base.repository';

// Books repository
export { BooksRepository, booksRepository } from './books.repository';

// Students repository
export { StudentsRepository, studentsRepository } from './students.repository';

// Equipment repository
export { EquipmentRepository, equipmentRepository } from './equipment.repository';

// Users repository
export { UsersRepository, usersRepository } from './users.repository';

// Notifications repository
export { NotificationsRepository, notificationsRepository } from './notifications.repository';

// Types for repositories
export type {
  // Re-export Prisma types for convenience
  students,
  students_grade_category,
  books,
  book_checkouts_status,
  equipment,
  equipment_status,
  equipment_type,
  equipment_condition_rating,
  users,
  users_role,
  notifications,
  notifications_type,
  notifications_priority,
  Prisma,
} from '@prisma/client';