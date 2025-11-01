import { randomUUID } from 'crypto';
import type { TransformableInfo } from 'logform';

/**
 * Common utility functions consolidated from across the codebase
 * This file reduces duplication by providing a single source of truth for common operations
 */

// ==================== ID GENERATION ====================

/**
 * Generate a UUID v4
 */
export const generateUUID = (): string => {
  return randomUUID();
};

/**
 * Generate a timestamp-based ID
 */
export const generateTimestampId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `${timestamp}-${random}`;
};

/**
 * Generate a short ID (8 characters)
 */
export const generateShortId = (): string => {
  return Math.random().toString(36).substring(2, 10);
};

/**
 * Generate a numeric ID (12 digits)
 */
export const generateNumericId = (): string => {
  return Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');
};

/**
 * Generate a unique test student ID
 */
export const generateTestStudentId = (testName: string): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 5);
  return `TEST-${testName}-${timestamp}-${random}`;
};

/**
 * Generate a secure token
 */
export const generateSecureToken = (length: number = 32): string => {
  const crypto = require('crypto');
  return crypto.randomBytes(length).toString('hex');
};

// ==================== VALIDATION ====================

/**
 * Validate UUID format
 */
export const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Check if a string is a valid email
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Check if a string is a valid phone number
 */
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
};

/**
 * Check if a value is empty (null, undefined, empty string, empty array, empty object)
 */
export const isEmpty = (value: any): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
};

// ==================== DATE UTILITIES ====================

/**
 * Format date for database storage
 */
export const formatDateForDB = (date: Date): string => {
  return date.toISOString().slice(0, 19).replace('T', ' ');
};

/**
 * Parse date from database format
 */
export const parseDateFromDB = (dateString: string): Date => {
  return new Date(dateString);
};

/**
 * Check if a date is within the last N days
 */
export const isWithinLastNDays = (date: Date, days: number): boolean => {
  const now = new Date();
  const nDaysAgo = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
  return date >= nDaysAgo;
};

/**
 * Get current timestamp in ISO format
 */
export const getCurrentTimestamp = (): string => {
  return new Date().toISOString();
};

// ==================== STRING UTILITIES ====================

/**
 * Sanitize string for database storage
 */
export const sanitizeString = (str: string): string => {
  return str.replace(/['"\\]/g, '').trim();
};

/**
 * Generate a slug from a string
 */
export const generateSlug = (str: string): string => {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Truncate text to specified length
 */
export const truncateText = (text: string, maxLength: number, suffix: string = '...'): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
};

/**
 * Capitalize first letter of each word
 */
export const capitalizeWords = (str: string): string => {
  return str.replace(/\b\w/g, char => char.toUpperCase());
};

/**
 * Convert string to title case
 */
export const toTitleCase = (str: string): string => {
  return str.replace(/\w\S*/g, (txt) =>
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
};

// ==================== DATA TRANSFORMATION ====================

/**
 * Deep clone an object
 */
export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T;
  if (typeof obj === 'object') {
    const cloned = {} as T;
    Object.keys(obj).forEach(key => {
      cloned[key as keyof T] = deepClone(obj[key as keyof T]);
    });
    return cloned;
  }
  return obj;
};

// ==================== ASYNC UTILITIES ====================

/**
 * Retry function with exponential backoff
 */
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries) throw error;

      const delay = baseDelay * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Max retries exceeded');
};

/**
 * Wait for condition with timeout
 */
export const waitFor = async (
  condition: () => Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error('Timeout waiting for condition');
};

/**
 * Wait for specified time
 */
export const wait = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Create test-specific timeout
 */
export const createTestTimeout = (ms: number): Promise<never> => {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Test timed out after ${ms}ms`)), ms);
  });
};

// ==================== FUNCTIONAL UTILITIES ====================

/**
 * Debounce function
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Throttle function
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// ==================== PERFORMANCE UTILITIES ====================

/**
 * Measure execution time of async function
 */
export const measureExecutionTime = async <T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> => {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  
  return { result, duration };
};

/**
 * Calculate standard deviation
 */
export const calculateStandardDeviation = (values: number[]): number => {
  const mean = values.reduce((a, b) => a + b) / values.length;
  const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b) / values.length;
  return Math.sqrt(avgSquaredDiff);
};

// ==================== FORMATTING UTILITIES ====================

/**
 * Format file size
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Generate a random color
 */
export const generateRandomColor = (): string => {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};

// ==================== LOGGING UTILITIES ====================

/**
 * Build log entry for Winston logger
 */
export const buildLogEntry = (info: TransformableInfo): string => {
  const { level, message, stack, ...meta } = info;
  const timestamp =
    typeof info.timestamp === 'string'
      ? info.timestamp
      : new Date().toISOString();
  const levelLabel =
    typeof level === 'string' ? level.toUpperCase() : String(level);
  const text = typeof message === 'string' ? message : JSON.stringify(message);

  let log = `${timestamp} [${levelLabel}]: ${text}`;

  if (Object.keys(meta).length > 0) {
    log += ` ${JSON.stringify(meta)}`;
  }

  if (stack) {
    const stackTrace =
      typeof stack === 'string' ? stack : JSON.stringify(stack, null, 2);
    log += `\n${stackTrace}`;
  }

  return log;
};

// ==================== SNAPSHOT UTILITIES ====================

/**
 * Create JSON snapshot for testing
 */
export const createSnapshot = (data: any): string => {
  return JSON.stringify(data, null, 2);
};

/**
 * Compare two snapshots
 */
export const compareSnapshots = (snapshot1: string, snapshot2: string): boolean => {
  return snapshot1 === snapshot2;
};

// ==================== GENERATION UTILITIES ====================

/**
 * Generate audit ID
 */
export const generateAuditId = (): string => {
  return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Generate mock students for testing
 */
export const generateMockStudents = (count: number) => {
  const gradeCategories = ['PRIMARY', 'GRADE_SCHOOL', 'JUNIOR_HIGH', 'SENIOR_HIGH'];
  const gradeLevels = ['Grade 1', 'Grade 3', 'Grade 5', 'Grade 7', 'Grade 9', 'Grade 11'];

  return Array.from({ length: count }, (_, i) => ({
    studentId: `STU${String(i + 1).padStart(4, '0')}`,
    firstName: `Student${i + 1}`,
    lastName: `Test${i + 1}`,
    gradeLevel: gradeLevels[i % gradeLevels.length],
    gradeCategory: gradeCategories[i % gradeCategories.length],
    email: `student${i + 1}@test.com`,
    isActive: true
  }));
};

/**
 * Generate mock books for testing
 */
export const generateMockBooks = (count: number) => {
  const categories = ['Fiction', 'Non-Fiction', 'Science', 'History', 'Mathematics'];
  
  return Array.from({ length: count }, (_, i) => ({
    title: `Test Book ${i + 1}`,
    author: `Author ${i + 1}`,
    isbn: `ISBN${String(i + 1).padStart(13, '0')}`,
    accessionNumber: `ACC${String(i + 1).padStart(6, '0')}`,
    category: categories[i % categories.length],
    status: 'AVAILABLE'
  }));
};

/**
 * Generate mock equipment for testing
 */
export const generateMockEquipment = (count: number) => {
  const types = ['COMPUTER', 'GAMING', 'AVR', 'TABLET'];
  
  return Array.from({ length: count }, (_, i) => ({
    equipmentId: `EQ${String(i + 1).padStart(3, '0')}`,
    name: `Equipment ${i + 1}`,
    type: types[i % types.length],
    status: 'AVAILABLE'
  }));
};