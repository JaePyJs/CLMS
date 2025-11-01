/**
 * Utility helper functions - Re-exports from common utilities
 * This file maintains backward compatibility while consolidating duplicates
 */

// Re-export all common utilities for backward compatibility
export {
  generateUUID,
  generateTimestampId,
  generateShortId,
  generateNumericId,
  isValidUUID,
  formatDateForDB,
  parseDateFromDB,
  isWithinLastNDays,
  sanitizeString,
  generateSlug,
  isEmpty,
  deepClone,
  retryWithBackoff,
  debounce,
  throttle,
  formatFileSize,
  generateRandomColor,
  isValidEmail,
  isValidPhone,
  truncateText,
  capitalizeWords,
  toTitleCase,
  generateSecureToken,
  generateTestStudentId,
  getCurrentTimestamp,
  waitFor,
  wait,
  createTestTimeout,
  measureExecutionTime,
  calculateStandardDeviation,
  buildLogEntry,
  createSnapshot,
  compareSnapshots,
  generateAuditId,
  generateMockStudents,
  generateMockBooks,
  generateMockEquipment
} from './common';