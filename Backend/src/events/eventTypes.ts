import { z } from 'zod';
import { EventTypeRegistry } from './eventBus';
import {
  // Base event types
  BaseWebSocketEvent,
  EventMetadata,
  EventError,
  EventResponse,
  
  // Student event payloads
  StudentCreatePayload,
  StudentUpdatePayload,
  StudentDeletePayload,
  StudentCheckoutPayload,
  StudentReturnPayload,
  
  // Book event payloads
  BookCreatePayload,
  BookUpdatePayload,
  BookDeletePayload,
  BookCheckoutPayload,
  BookReturnPayload,
  BookReservePayload,
  
  // Equipment event payloads
  EquipmentCreatePayload,
  EquipmentUpdatePayload,
  EquipmentDeletePayload,
  EquipmentCheckoutPayload,
  EquipmentReturnPayload,
  EquipmentReservePayload,
  
  // System event payloads
  SystemNotificationPayload,
  SystemAlertPayload,
  SystemStatusPayload,
  
  // Import event payloads
  ImportStartPayload,
  ImportProgressPayload,
  ImportCompletionPayload,
  
  // User event payloads
  UserLoginPayload,
  UserLogoutPayload,
  UserPermissionsPayload,
  UserPreferencesPayload,
  
  // Scanner event payloads
  ScannerScanPayload,
  ScannerResultPayload,
  
  // Specific event interfaces
  StudentCreateEvent,
  StudentUpdateEvent,
  StudentDeleteEvent,
  StudentCheckoutEvent,
  StudentReturnEvent,
  BookCreateEvent,
  BookUpdateEvent,
  BookDeleteEvent,
  BookCheckoutEvent,
  BookReturnEvent,
  BookReserveEvent,
  EquipmentCreateEvent,
  EquipmentUpdateEvent,
  EquipmentDeleteEvent,
  EquipmentCheckoutEvent,
  EquipmentReturnEvent,
  EquipmentReserveEvent,
  SystemNotificationEvent,
  SystemAlertEvent,
  SystemStatusEvent,
  ImportStartEvent,
  ImportProgressEvent,
  ImportCompletionEvent,
  UserLoginEvent,
  UserLogoutEvent,
  UserPermissionsEvent,
  UserPreferencesEvent,
  ScannerScanEvent,
  ScannerResultEvent
} from '../websocket/eventTypes';

// ============================================================================
// ZOD SCHEMAS FOR EVENT VALIDATION
// ============================================================================

// Base schemas
const EventMetadataSchema = z.object({
  source: z.enum(['client', 'server']),
  version: z.string(),
  correlationId: z.string().optional(),
  retryCount: z.number().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  tags: z.array(z.string()).optional(),
});

const EventErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.any().optional(),
  stack: z.string().optional(),
});

// Student event schemas
const StudentCreatePayloadSchema = z.object({
  studentId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  gradeLevel: z.string(),
  section: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

const StudentUpdatePayloadSchema = z.object({
  studentId: z.string(),
  updates: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    gradeLevel: z.string().optional(),
    section: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    isActive: z.boolean().optional(),
  }),
});

const StudentDeletePayloadSchema = z.object({
  studentId: z.string(),
  reason: z.string().optional(),
});

const StudentCheckoutPayloadSchema = z.object({
  studentId: z.string(),
  bookIds: z.array(z.string()).optional(),
  equipmentIds: z.array(z.string()).optional(),
  dueDate: z.date().optional(),
});

const StudentReturnPayloadSchema = z.object({
  studentId: z.string(),
  bookIds: z.array(z.string()).optional(),
  equipmentIds: z.array(z.string()).optional(),
  condition: z.enum(['good', 'damaged', 'lost']).optional(),
  notes: z.string().optional(),
});

// Book event schemas
const BookCreatePayloadSchema = z.object({
  bookId: z.string(),
  title: z.string(),
  author: z.string(),
  isbn: z.string().optional(),
  category: z.string(),
  totalCopies: z.number().min(1),
  availableCopies: z.number().min(0),
  location: z.string().optional(),
});

const BookUpdatePayloadSchema = z.object({
  bookId: z.string(),
  updates: z.object({
    title: z.string().optional(),
    author: z.string().optional(),
    isbn: z.string().optional(),
    category: z.string().optional(),
    totalCopies: z.number().min(1).optional(),
    availableCopies: z.number().min(0).optional(),
    location: z.string().optional(),
    status: z.enum(['available', 'checked-out', 'reserved', 'maintenance']).optional(),
  }),
});

const BookDeletePayloadSchema = z.object({
  bookId: z.string(),
  reason: z.string().optional(),
});

const BookCheckoutPayloadSchema = z.object({
  bookId: z.string(),
  studentId: z.string(),
  dueDate: z.date(),
});

const BookReturnPayloadSchema = z.object({
  bookId: z.string(),
  studentId: z.string(),
  condition: z.enum(['good', 'damaged', 'lost']).optional(),
  notes: z.string().optional(),
});

const BookReservePayloadSchema = z.object({
  bookId: z.string(),
  studentId: z.string(),
  priority: z.number().min(1).optional(),
});

// Equipment event schemas
const EquipmentCreatePayloadSchema = z.object({
  equipmentId: z.string(),
  name: z.string(),
  type: z.string(),
  description: z.string().optional(),
  location: z.string().optional(),
  status: z.enum(['available', 'in-use', 'maintenance', 'malfunctioning']),
});

const EquipmentUpdatePayloadSchema = z.object({
  equipmentId: z.string(),
  updates: z.object({
    name: z.string().optional(),
    type: z.string().optional(),
    description: z.string().optional(),
    location: z.string().optional(),
    status: z.enum(['available', 'in-use', 'maintenance', 'malfunctioning']).optional(),
  }),
});

const EquipmentDeletePayloadSchema = z.object({
  equipmentId: z.string(),
  reason: z.string().optional(),
});

const EquipmentCheckoutPayloadSchema = z.object({
  equipmentId: z.string(),
  studentId: z.string(),
  timeLimitMinutes: z.number().min(1),
  purpose: z.string().optional(),
});

const EquipmentReturnPayloadSchema = z.object({
  equipmentId: z.string(),
  studentId: z.string(),
  condition: z.enum(['good', 'damaged', 'needs-maintenance']).optional(),
  notes: z.string().optional(),
});

const EquipmentReservePayloadSchema = z.object({
  equipmentId: z.string(),
  studentId: z.string(),
  startTime: z.date(),
  endTime: z.date(),
  purpose: z.string().optional(),
});

// System event schemas
const SystemNotificationPayloadSchema = z.object({
  title: z.string(),
  message: z.string(),
  type: z.enum(['info', 'warning', 'error', 'success']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  targetRole: z.string().optional(),
  targetUserId: z.string().optional(),
  actionUrl: z.string().optional(),
});

const SystemAlertPayloadSchema = z.object({
  title: z.string(),
  message: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  action: z.string().optional(),
  actionUrl: z.string().optional(),
  autoDismiss: z.boolean().optional(),
  dismissAfter: z.number().optional(),
});

const SystemStatusPayloadSchema = z.object({
  component: z.string(),
  status: z.enum(['healthy', 'degraded', 'down']),
  message: z.string().optional(),
  metrics: z.record(z.string(), z.any()).optional(),
});

// Import event schemas
const ImportStartPayloadSchema = z.object({
  importType: z.enum(['students', 'books', 'equipment']),
  fileName: z.string(),
  fileSize: z.number().min(0),
  mapping: z.record(z.string(), z.string()).optional(),
});

const ImportProgressPayloadSchema = z.object({
  importId: z.string(),
  progress: z.number().min(0).max(100),
  processed: z.number().min(0),
  total: z.number().min(0),
  currentRow: z.number().optional(),
  errors: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
});

const ImportCompletionPayloadSchema = z.object({
  importId: z.string(),
  success: z.boolean(),
  processed: z.number().min(0),
  total: z.number().min(0),
  created: z.number().min(0),
  updated: z.number().min(0),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  summary: z.object({
    duration: z.number().min(0),
    recordsPerSecond: z.number().min(0),
  }),
});

// User event schemas
const UserLoginPayloadSchema = z.object({
  userId: z.string(),
  username: z.string(),
  role: z.string(),
  loginTime: z.date(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

const UserLogoutPayloadSchema = z.object({
  userId: z.string(),
  logoutTime: z.date(),
  sessionDuration: z.number().min(0),
});

const UserPermissionsPayloadSchema = z.object({
  userId: z.string(),
  permissions: z.array(z.string()),
  role: z.string(),
  lastUpdated: z.date(),
});

const UserPreferencesPayloadSchema = z.object({
  userId: z.string(),
  preferences: z.record(z.string(), z.any()),
  lastUpdated: z.date(),
});

// Scanner event schemas
const ScannerScanPayloadSchema = z.object({
  code: z.string(),
  scannerType: z.enum(['barcode', 'qr', 'usb']),
  scannedBy: z.string().optional(),
  timestamp: z.date(),
});

const ScannerResultPayloadSchema = z.object({
  success: z.boolean(),
  code: z.string(),
  result: z.any().optional(),
  type: z.enum(['student', 'book', 'equipment', 'unknown']),
  timestamp: z.date(),
});

// ============================================================================
// EVENT TYPE REGISTRATION
// ============================================================================

/**
 * Initialize and register all WebSocket event types with the event bus
 */
export function initializeEventTypes(): void {
  // Student events
  EventTypeRegistry.registerEventType(
    'student:create',
    StudentCreatePayloadSchema,
    StudentCreatePayload,
    'student'
  );
  
  EventTypeRegistry.registerEventType(
    'student:update',
    StudentUpdatePayloadSchema,
    StudentUpdatePayload,
    'student'
  );
  
  EventTypeRegistry.registerEventType(
    'student:delete',
    StudentDeletePayloadSchema,
    StudentDeletePayload,
    'student'
  );
  
  EventTypeRegistry.registerEventType(
    'student:checkout',
    StudentCheckoutPayloadSchema,
    StudentCheckoutPayload,
    'student'
  );
  
  EventTypeRegistry.registerEventType(
    'student:return',
    StudentReturnPayloadSchema,
    StudentReturnPayload,
    'student'
  );

  // Book events
  EventTypeRegistry.registerEventType(
    'book:create',
    BookCreatePayloadSchema,
    BookCreatePayload,
    'book'
  );
  
  EventTypeRegistry.registerEventType(
    'book:update',
    BookUpdatePayloadSchema,
    BookUpdatePayload,
    'book'
  );
  
  EventTypeRegistry.registerEventType(
    'book:delete',
    BookDeletePayloadSchema,
    BookDeletePayload,
    'book'
  );
  
  EventTypeRegistry.registerEventType(
    'book:checkout',
    BookCheckoutPayloadSchema,
    BookCheckoutPayload,
    'book'
  );
  
  EventTypeRegistry.registerEventType(
    'book:return',
    BookReturnPayloadSchema,
    BookReturnPayload,
    'book'
  );
  
  EventTypeRegistry.registerEventType(
    'book:reserve',
    BookReservePayloadSchema,
    BookReservePayload,
    'book'
  );

  // Equipment events
  EventTypeRegistry.registerEventType(
    'equipment:create',
    EquipmentCreatePayloadSchema,
    EquipmentCreatePayload,
    'equipment'
  );
  
  EventTypeRegistry.registerEventType(
    'equipment:update',
    EquipmentUpdatePayloadSchema,
    EquipmentUpdatePayload,
    'equipment'
  );
  
  EventTypeRegistry.registerEventType(
    'equipment:delete',
    EquipmentDeletePayloadSchema,
    EquipmentDeletePayload,
    'equipment'
  );
  
  EventTypeRegistry.registerEventType(
    'equipment:checkout',
    EquipmentCheckoutPayloadSchema,
    EquipmentCheckoutPayload,
    'equipment'
  );
  
  EventTypeRegistry.registerEventType(
    'equipment:return',
    EquipmentReturnPayloadSchema,
    EquipmentReturnPayload,
    'equipment'
  );
  
  EventTypeRegistry.registerEventType(
    'equipment:reserve',
    EquipmentReservePayloadSchema,
    EquipmentReservePayload,
    'equipment'
  );

  // System events
  EventTypeRegistry.registerEventType(
    'system:notification',
    SystemNotificationPayloadSchema,
    SystemNotificationPayload,
    'system'
  );
  
  EventTypeRegistry.registerEventType(
    'system:alert',
    SystemAlertPayloadSchema,
    SystemAlertPayload,
    'system'
  );
  
  EventTypeRegistry.registerEventType(
    'system:status',
    SystemStatusPayloadSchema,
    SystemStatusPayload,
    'system'
  );

  // Import events
  EventTypeRegistry.registerEventType(
    'import:start',
    ImportStartPayloadSchema,
    ImportStartPayload,
    'import'
  );
  
  EventTypeRegistry.registerEventType(
    'import:progress',
    ImportProgressPayloadSchema,
    ImportProgressPayload,
    'import'
  );
  
  EventTypeRegistry.registerEventType(
    'import:completion',
    ImportCompletionPayloadSchema,
    ImportCompletionPayload,
    'import'
  );

  // User events
  EventTypeRegistry.registerEventType(
    'user:login',
    UserLoginPayloadSchema,
    UserLoginPayload,
    'user'
  );
  
  EventTypeRegistry.registerEventType(
    'user:logout',
    UserLogoutPayloadSchema,
    UserLogoutPayload,
    'user'
  );
  
  EventTypeRegistry.registerEventType(
    'user:permissions',
    UserPermissionsPayloadSchema,
    UserPermissionsPayload,
    'user'
  );
  
  EventTypeRegistry.registerEventType(
    'user:preferences',
    UserPreferencesPayloadSchema,
    UserPreferencesPayload,
    'user'
  );

  // Scanner events
  EventTypeRegistry.registerEventType(
    'scanner:scan',
    ScannerScanPayloadSchema,
    ScannerScanPayload,
    'scanner'
  );
  
  EventTypeRegistry.registerEventType(
    'scanner:result',
    ScannerResultPayloadSchema,
    ScannerResultPayload,
    'scanner'
  );
}

// ============================================================================
// EVENT TYPE CONSTANTS
// ============================================================================

/**
 * Event type constants for type-safe event publishing
 */
export const EVENT_TYPES = {
  // Student events
  STUDENT_CREATE: 'student:create',
  STUDENT_UPDATE: 'student:update',
  STUDENT_DELETE: 'student:delete',
  STUDENT_CHECKOUT: 'student:checkout',
  STUDENT_RETURN: 'student:return',
  
  // Book events
  BOOK_CREATE: 'book:create',
  BOOK_UPDATE: 'book:update',
  BOOK_DELETE: 'book:delete',
  BOOK_CHECKOUT: 'book:checkout',
  BOOK_RETURN: 'book:return',
  BOOK_RESERVE: 'book:reserve',
  
  // Equipment events
  EQUIPMENT_CREATE: 'equipment:create',
  EQUIPMENT_UPDATE: 'equipment:update',
  EQUIPMENT_DELETE: 'equipment:delete',
  EQUIPMENT_CHECKOUT: 'equipment:checkout',
  EQUIPMENT_RETURN: 'equipment:return',
  EQUIPMENT_RESERVE: 'equipment:reserve',
  
  // System events
  SYSTEM_NOTIFICATION: 'system:notification',
  SYSTEM_ALERT: 'system:alert',
  SYSTEM_STATUS: 'system:status',
  
  // Import events
  IMPORT_START: 'import:start',
  IMPORT_PROGRESS: 'import:progress',
  IMPORT_COMPLETION: 'import:completion',
  
  // User events
  USER_LOGIN: 'user:login',
  USER_LOGOUT: 'user:logout',
  USER_PERMISSIONS: 'user:permissions',
  USER_PREFERENCES: 'user:preferences',
  
  // Scanner events
  SCANNER_SCAN: 'scanner:scan',
  SCANNER_RESULT: 'scanner:result',
} as const;

// ============================================================================
// EVENT CATEGORIES
// ============================================================================

/**
 * Event category constants
 */
export const EVENT_CATEGORIES = {
  STUDENT: 'student',
  BOOK: 'book',
  EQUIPMENT: 'equipment',
  SYSTEM: 'system',
  IMPORT: 'import',
  USER: 'user',
  SCANNER: 'scanner',
  GENERAL: 'general',
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get all event types for a specific category
 */
export function getEventTypesByCategory(category: string): string[] {
  return EventTypeRegistry.getEventTypesByCategory(category);
}

/**
 * Check if an event type exists
 */
export function isValidEventType(eventType: string): boolean {
  return EventTypeRegistry.getAllEventTypes().includes(eventType);
}

/**
 * Get category for an event type
 */
export function getEventTypeCategory(eventType: string): string | undefined {
  const definition = EventTypeRegistry.getTypeDefinition(eventType);
  return definition?.category;
}

/**
 * Validate an event payload
 */
export function validateEventPayload(eventType: string, payload: any): {
  valid: boolean;
  error?: string;
} {
  const schema = EventTypeRegistry.getSchema(eventType);
  if (!schema) {
    return { valid: true }; // No schema means no validation required
  }

  const result = schema.safeParse(payload);
  if (!result.success) {
    return {
      valid: false,
      error: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
    };
  }

  return { valid: true };
}

// Auto-initialize event types when this module is imported
initializeEventTypes();