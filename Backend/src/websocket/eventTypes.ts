import { z } from 'zod';

// ============================================================================
// BASE EVENT TYPES
// ============================================================================

/**
 * Base WebSocket event interface with common properties
 */
export interface BaseWebSocketEvent<TPayload = any> {
  id: string;
  type: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  payload: TPayload;
  metadata?: EventMetadata;
}

/**
 * Event metadata containing additional information
 */
export interface EventMetadata {
  source: 'client' | 'server';
  version: string;
  correlationId?: string;
  retryCount?: number;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  tags?: string[];
}

/**
 * Event response interface for request/response patterns
 */
export interface EventResponse<TPayload = any> {
  eventId: string;
  success: boolean;
  timestamp: Date;
  payload?: TPayload;
  error?: EventError;
}

/**
 * Event error interface
 */
export interface EventError {
  code: string;
  message: string;
  details?: any;
  stack?: string;
}

// ============================================================================
// EVENT PAYLOAD TYPES
// ============================================================================

// Student Events
export interface StudentCreatePayload {
  studentId: string;
  firstName: string;
  lastName: string;
  gradeLevel: string;
  section?: string;
  email?: string;
  phone?: string;
}

export interface StudentUpdatePayload {
  studentId: string;
  updates: Partial<{
    firstName: string;
    lastName: string;
    gradeLevel: string;
    section: string;
    email: string;
    phone: string;
    isActive: boolean;
  }>;
}

export interface StudentDeletePayload {
  studentId: string;
  reason?: string;
}

export interface StudentCheckoutPayload {
  studentId: string;
  bookIds?: string[];
  equipmentIds?: string[];
  dueDate?: Date;
}

export interface StudentReturnPayload {
  studentId: string;
  bookIds?: string[];
  equipmentIds?: string[];
  condition?: 'good' | 'damaged' | 'lost';
  notes?: string;
}

// Book Events
export interface BookCreatePayload {
  bookId: string;
  title: string;
  author: string;
  isbn?: string;
  category: string;
  totalCopies: number;
  availableCopies: number;
  location?: string;
}

export interface BookUpdatePayload {
  bookId: string;
  updates: Partial<{
    title: string;
    author: string;
    isbn: string;
    category: string;
    totalCopies: number;
    availableCopies: number;
    location: string;
    status: 'available' | 'checked-out' | 'reserved' | 'maintenance';
  }>;
}

export interface BookDeletePayload {
  bookId: string;
  reason?: string;
}

export interface BookCheckoutPayload {
  bookId: string;
  studentId: string;
  dueDate: Date;
}

export interface BookReturnPayload {
  bookId: string;
  studentId: string;
  condition?: 'good' | 'damaged' | 'lost';
  notes?: string;
}

export interface BookReservePayload {
  bookId: string;
  studentId: string;
  priority?: number;
}

// Equipment Events
export interface EquipmentCreatePayload {
  equipmentId: string;
  name: string;
  type: string;
  description?: string;
  location?: string;
  status: 'available' | 'in-use' | 'maintenance' | 'malfunctioning';
}

export interface EquipmentUpdatePayload {
  equipmentId: string;
  updates: Partial<{
    name: string;
    type: string;
    description: string;
    location: string;
    status: 'available' | 'in-use' | 'maintenance' | 'malfunctioning';
  }>;
}

export interface EquipmentDeletePayload {
  equipmentId: string;
  reason?: string;
}

export interface EquipmentCheckoutPayload {
  equipmentId: string;
  studentId: string;
  timeLimitMinutes: number;
  purpose?: string;
}

export interface EquipmentReturnPayload {
  equipmentId: string;
  studentId: string;
  condition?: 'good' | 'damaged' | 'needs-maintenance';
  notes?: string;
}

export interface EquipmentReservePayload {
  equipmentId: string;
  studentId: string;
  startTime: Date;
  endTime: Date;
  purpose?: string;
}

// System Events
export interface SystemNotificationPayload {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  priority: 'low' | 'medium' | 'high' | 'critical';
  targetRole?: string;
  targetUserId?: string;
  actionUrl?: string;
}

export interface SystemAlertPayload {
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action?: string;
  actionUrl?: string;
  autoDismiss?: boolean;
  dismissAfter?: number; // seconds
}

export interface SystemStatusPayload {
  component: string;
  status: 'healthy' | 'degraded' | 'down';
  message?: string;
  metrics?: Record<string, any>;
}

// Import Events
export interface ImportStartPayload {
  importType: 'students' | 'books' | 'equipment';
  fileName: string;
  fileSize: number;
  mapping?: Record<string, string>;
}

export interface ImportProgressPayload {
  importId: string;
  progress: number; // 0-100
  processed: number;
  total: number;
  currentRow?: number;
  errors?: string[];
  warnings?: string[];
}

export interface ImportCompletionPayload {
  importId: string;
  success: boolean;
  processed: number;
  total: number;
  created: number;
  updated: number;
  errors: string[];
  warnings: string[];
  summary: {
    duration: number; // milliseconds
    recordsPerSecond: number;
  };
}

// User Events
export interface UserLoginPayload {
  userId: string;
  username: string;
  role: string;
  loginTime: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface UserLogoutPayload {
  userId: string;
  logoutTime: Date;
  sessionDuration: number; // milliseconds
}

export interface UserPermissionsPayload {
  userId: string;
  permissions: string[];
  role: string;
  lastUpdated: Date;
}

export interface UserPreferencesPayload {
  userId: string;
  preferences: Record<string, any>;
  lastUpdated: Date;
}

// Scanner Events
export interface ScannerScanPayload {
  code: string;
  scannerType: 'barcode' | 'qr' | 'usb';
  scannedBy?: string;
  timestamp: Date;
}

export interface ScannerResultPayload {
  success: boolean;
  code: string;
  result?: any;
  type: 'student' | 'book' | 'equipment' | 'unknown';
  timestamp: Date;
}

// ============================================================================
// EVENT TYPE DEFINITIONS
// ============================================================================

export type WebSocketEvent = 
  // Student Events
  | StudentCreateEvent
  | StudentUpdateEvent
  | StudentDeleteEvent
  | StudentCheckoutEvent
  | StudentReturnEvent
  
  // Book Events
  | BookCreateEvent
  | BookUpdateEvent
  | BookDeleteEvent
  | BookCheckoutEvent
  | BookReturnEvent
  | BookReserveEvent
  
  // Equipment Events
  | EquipmentCreateEvent
  | EquipmentUpdateEvent
  | EquipmentDeleteEvent
  | EquipmentCheckoutEvent
  | EquipmentReturnEvent
  | EquipmentReserveEvent
  
  // System Events
  | SystemNotificationEvent
  | SystemAlertEvent
  | SystemStatusEvent
  
  // Import Events
  | ImportStartEvent
  | ImportProgressEvent
  | ImportCompletionEvent
  
  // User Events
  | UserLoginEvent
  | UserLogoutEvent
  | UserPermissionsEvent
  | UserPreferencesEvent
  
  // Scanner Events
  | ScannerScanEvent
  | ScannerResultEvent;

// ============================================================================
// SPECIFIC EVENT INTERFACES
// ============================================================================

// Student Events
export interface StudentCreateEvent extends BaseWebSocketEvent<StudentCreatePayload> {
  type: 'student:create';
}

export interface StudentUpdateEvent extends BaseWebSocketEvent<StudentUpdatePayload> {
  type: 'student:update';
}

export interface StudentDeleteEvent extends BaseWebSocketEvent<StudentDeletePayload> {
  type: 'student:delete';
}

export interface StudentCheckoutEvent extends BaseWebSocketEvent<StudentCheckoutPayload> {
  type: 'student:checkout';
}

export interface StudentReturnEvent extends BaseWebSocketEvent<StudentReturnPayload> {
  type: 'student:return';
}

// Book Events
export interface BookCreateEvent extends BaseWebSocketEvent<BookCreatePayload> {
  type: 'book:create';
}

export interface BookUpdateEvent extends BaseWebSocketEvent<BookUpdatePayload> {
  type: 'book:update';
}

export interface BookDeleteEvent extends BaseWebSocketEvent<BookDeletePayload> {
  type: 'book:delete';
}

export interface BookCheckoutEvent extends BaseWebSocketEvent<BookCheckoutPayload> {
  type: 'book:checkout';
}

export interface BookReturnEvent extends BaseWebSocketEvent<BookReturnPayload> {
  type: 'book:return';
}

export interface BookReserveEvent extends BaseWebSocketEvent<BookReservePayload> {
  type: 'book:reserve';
}

// Equipment Events
export interface EquipmentCreateEvent extends BaseWebSocketEvent<EquipmentCreatePayload> {
  type: 'equipment:create';
}

export interface EquipmentUpdateEvent extends BaseWebSocketEvent<EquipmentUpdatePayload> {
  type: 'equipment:update';
}

export interface EquipmentDeleteEvent extends BaseWebSocketEvent<EquipmentDeletePayload> {
  type: 'equipment:delete';
}

export interface EquipmentCheckoutEvent extends BaseWebSocketEvent<EquipmentCheckoutPayload> {
  type: 'equipment:checkout';
}

export interface EquipmentReturnEvent extends BaseWebSocketEvent<EquipmentReturnPayload> {
  type: 'equipment:return';
}

export interface EquipmentReserveEvent extends BaseWebSocketEvent<EquipmentReservePayload> {
  type: 'equipment:reserve';
}

// System Events
export interface SystemNotificationEvent extends BaseWebSocketEvent<SystemNotificationPayload> {
  type: 'system:notification';
}

export interface SystemAlertEvent extends BaseWebSocketEvent<SystemAlertPayload> {
  type: 'system:alert';
}

export interface SystemStatusEvent extends BaseWebSocketEvent<SystemStatusPayload> {
  type: 'system:status';
}

// Import Events
export interface ImportStartEvent extends BaseWebSocketEvent<ImportStartPayload> {
  type: 'import:start';
}

export interface ImportProgressEvent extends BaseWebSocketEvent<ImportProgressPayload> {
  type: 'import:progress';
}

export interface ImportCompletionEvent extends BaseWebSocketEvent<ImportCompletionPayload> {
  type: 'import:completion';
}

// User Events
export interface UserLoginEvent extends BaseWebSocketEvent<UserLoginPayload> {
  type: 'user:login';
}

export interface UserLogoutEvent extends BaseWebSocketEvent<UserLogoutPayload> {
  type: 'user:logout';
}

export interface UserPermissionsEvent extends BaseWebSocketEvent<UserPermissionsPayload> {
  type: 'user:permissions';
}

export interface UserPreferencesEvent extends BaseWebSocketEvent<UserPreferencesPayload> {
  type: 'user:preferences';
}

// Scanner Events
export interface ScannerScanEvent extends BaseWebSocketEvent<ScannerScanPayload> {
  type: 'scanner:scan';
}

export interface ScannerResultEvent extends BaseWebSocketEvent<ScannerResultPayload> {
  type: 'scanner:result';
}

// ============================================================================
// ZOD SCHEMAS FOR RUNTIME VALIDATION
// ============================================================================

// Base Schemas
export const EventMetadataSchema = z.object({
  source: z.enum(['client', 'server']),
  version: z.string(),
  correlationId: z.string().optional(),
  retryCount: z.number().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  tags: z.array(z.string()).optional(),
});

export const EventErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.any().optional(),
  stack: z.string().optional(),
});

// Student Schemas
export const StudentCreatePayloadSchema = z.object({
  studentId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  gradeLevel: z.string(),
  section: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export const StudentUpdatePayloadSchema = z.object({
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

export const StudentDeletePayloadSchema = z.object({
  studentId: z.string(),
  reason: z.string().optional(),
});

export const StudentCheckoutPayloadSchema = z.object({
  studentId: z.string(),
  bookIds: z.array(z.string()).optional(),
  equipmentIds: z.array(z.string()).optional(),
  dueDate: z.date().optional(),
});

export const StudentReturnPayloadSchema = z.object({
  studentId: z.string(),
  bookIds: z.array(z.string()).optional(),
  equipmentIds: z.array(z.string()).optional(),
  condition: z.enum(['good', 'damaged', 'lost']).optional(),
  notes: z.string().optional(),
});

// Book Schemas
export const BookCreatePayloadSchema = z.object({
  bookId: z.string(),
  title: z.string(),
  author: z.string(),
  isbn: z.string().optional(),
  category: z.string(),
  totalCopies: z.number(),
  availableCopies: z.number(),
  location: z.string().optional(),
});

export const BookUpdatePayloadSchema = z.object({
  bookId: z.string(),
  updates: z.object({
    title: z.string().optional(),
    author: z.string().optional(),
    isbn: z.string().optional(),
    category: z.string().optional(),
    totalCopies: z.number().optional(),
    availableCopies: z.number().optional(),
    location: z.string().optional(),
    status: z.enum(['available', 'checked-out', 'reserved', 'maintenance']).optional(),
  }),
});

export const BookDeletePayloadSchema = z.object({
  bookId: z.string(),
  reason: z.string().optional(),
});

export const BookCheckoutPayloadSchema = z.object({
  bookId: z.string(),
  studentId: z.string(),
  dueDate: z.date(),
});

export const BookReturnPayloadSchema = z.object({
  bookId: z.string(),
  studentId: z.string(),
  condition: z.enum(['good', 'damaged', 'lost']).optional(),
  notes: z.string().optional(),
});

export const BookReservePayloadSchema = z.object({
  bookId: z.string(),
  studentId: z.string(),
  priority: z.number().optional(),
});

// Equipment Schemas
export const EquipmentCreatePayloadSchema = z.object({
  equipmentId: z.string(),
  name: z.string(),
  type: z.string(),
  description: z.string().optional(),
  location: z.string().optional(),
  status: z.enum(['available', 'in-use', 'maintenance', 'malfunctioning']),
});

export const EquipmentUpdatePayloadSchema = z.object({
  equipmentId: z.string(),
  updates: z.object({
    name: z.string().optional(),
    type: z.string().optional(),
    description: z.string().optional(),
    location: z.string().optional(),
    status: z.enum(['available', 'in-use', 'maintenance', 'malfunctioning']).optional(),
  }),
});

export const EquipmentDeletePayloadSchema = z.object({
  equipmentId: z.string(),
  reason: z.string().optional(),
});

export const EquipmentCheckoutPayloadSchema = z.object({
  equipmentId: z.string(),
  studentId: z.string(),
  timeLimitMinutes: z.number(),
  purpose: z.string().optional(),
});

export const EquipmentReturnPayloadSchema = z.object({
  equipmentId: z.string(),
  studentId: z.string(),
  condition: z.enum(['good', 'damaged', 'needs-maintenance']).optional(),
  notes: z.string().optional(),
});

export const EquipmentReservePayloadSchema = z.object({
  equipmentId: z.string(),
  studentId: z.string(),
  startTime: z.date(),
  endTime: z.date(),
  purpose: z.string().optional(),
});

// System Schemas
export const SystemNotificationPayloadSchema = z.object({
  title: z.string(),
  message: z.string(),
  type: z.enum(['info', 'warning', 'error', 'success']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  targetRole: z.string().optional(),
  targetUserId: z.string().optional(),
  actionUrl: z.string().optional(),
});

export const SystemAlertPayloadSchema = z.object({
  title: z.string(),
  message: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  action: z.string().optional(),
  actionUrl: z.string().optional(),
  autoDismiss: z.boolean().optional(),
  dismissAfter: z.number().optional(),
});

export const SystemStatusPayloadSchema = z.object({
  component: z.string(),
  status: z.enum(['healthy', 'degraded', 'down']),
  message: z.string().optional(),
  metrics: z.record(z.string(), z.any()).optional(),
});

// Import Schemas
export const ImportStartPayloadSchema = z.object({
  importType: z.enum(['students', 'books', 'equipment']),
  fileName: z.string(),
  fileSize: z.number(),
  mapping: z.record(z.string(), z.string()).optional(),
});

export const ImportProgressPayloadSchema = z.object({
  importId: z.string(),
  progress: z.number().min(0).max(100),
  processed: z.number(),
  total: z.number(),
  currentRow: z.number().optional(),
  errors: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
});

export const ImportCompletionPayloadSchema = z.object({
  importId: z.string(),
  success: z.boolean(),
  processed: z.number(),
  total: z.number(),
  created: z.number(),
  updated: z.number(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  summary: z.object({
    duration: z.number(),
    recordsPerSecond: z.number(),
  }),
});

// User Schemas
export const UserLoginPayloadSchema = z.object({
  userId: z.string(),
  username: z.string(),
  role: z.string(),
  loginTime: z.date(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

export const UserLogoutPayloadSchema = z.object({
  userId: z.string(),
  logoutTime: z.date(),
  sessionDuration: z.number(),
});

export const UserPermissionsPayloadSchema = z.object({
  userId: z.string(),
  permissions: z.array(z.string()),
  role: z.string(),
  lastUpdated: z.date(),
});

export const UserPreferencesPayloadSchema = z.object({
  userId: z.string(),
  preferences: z.record(z.string(), z.any()),
  lastUpdated: z.date(),
});

// Scanner Schemas
export const ScannerScanPayloadSchema = z.object({
  code: z.string(),
  scannerType: z.enum(['barcode', 'qr', 'usb']),
  scannedBy: z.string().optional(),
  timestamp: z.date(),
});

export const ScannerResultPayloadSchema = z.object({
  success: z.boolean(),
  code: z.string(),
  result: z.any().optional(),
  type: z.enum(['student', 'book', 'equipment', 'unknown']),
  timestamp: z.date(),
});

// ============================================================================
// EVENT TYPE GUARDS
// ============================================================================

export function isStudentCreateEvent(event: any): event is StudentCreateEvent {
  return event?.type === 'student:create';
}

export function isStudentUpdateEvent(event: any): event is StudentUpdateEvent {
  return event?.type === 'student:update';
}

export function isStudentDeleteEvent(event: any): event is StudentDeleteEvent {
  return event?.type === 'student:delete';
}

export function isStudentCheckoutEvent(event: any): event is StudentCheckoutEvent {
  return event?.type === 'student:checkout';
}

export function isStudentReturnEvent(event: any): event is StudentReturnEvent {
  return event?.type === 'student:return';
}

export function isBookCreateEvent(event: any): event is BookCreateEvent {
  return event?.type === 'book:create';
}

export function isBookUpdateEvent(event: any): event is BookUpdateEvent {
  return event?.type === 'book:update';
}

export function isBookDeleteEvent(event: any): event is BookDeleteEvent {
  return event?.type === 'book:delete';
}

export function isBookCheckoutEvent(event: any): event is BookCheckoutEvent {
  return event?.type === 'book:checkout';
}

export function isBookReturnEvent(event: any): event is BookReturnEvent {
  return event?.type === 'book:return';
}

export function isBookReserveEvent(event: any): event is BookReserveEvent {
  return event?.type === 'book:reserve';
}

export function isEquipmentCreateEvent(event: any): event is EquipmentCreateEvent {
  return event?.type === 'equipment:create';
}

export function isEquipmentUpdateEvent(event: any): event is EquipmentUpdateEvent {
  return event?.type === 'equipment:update';
}

export function isEquipmentDeleteEvent(event: any): event is EquipmentDeleteEvent {
  return event?.type === 'equipment:delete';
}

export function isEquipmentCheckoutEvent(event: any): event is EquipmentCheckoutEvent {
  return event?.type === 'equipment:checkout';
}

export function isEquipmentReturnEvent(event: any): event is EquipmentReturnEvent {
  return event?.type === 'equipment:return';
}

export function isEquipmentReserveEvent(event: any): event is EquipmentReserveEvent {
  return event?.type === 'equipment:reserve';
}

export function isSystemNotificationEvent(event: any): event is SystemNotificationEvent {
  return event?.type === 'system:notification';
}

export function isSystemAlertEvent(event: any): event is SystemAlertEvent {
  return event?.type === 'system:alert';
}

export function isSystemStatusEvent(event: any): event is SystemStatusEvent {
  return event?.type === 'system:status';
}

export function isImportStartEvent(event: any): event is ImportStartEvent {
  return event?.type === 'import:start';
}

export function isImportProgressEvent(event: any): event is ImportProgressEvent {
  return event?.type === 'import:progress';
}

export function isImportCompletionEvent(event: any): event is ImportCompletionEvent {
  return event?.type === 'import:completion';
}

export function isUserLoginEvent(event: any): event is UserLoginEvent {
  return event?.type === 'user:login';
}

export function isUserLogoutEvent(event: any): event is UserLogoutEvent {
  return event?.type === 'user:logout';
}

export function isUserPermissionsEvent(event: any): event is UserPermissionsEvent {
  return event?.type === 'user:permissions';
}

export function isUserPreferencesEvent(event: any): event is UserPreferencesEvent {
  return event?.type === 'user:preferences';
}

export function isScannerScanEvent(event: any): event is ScannerScanEvent {
  return event?.type === 'scanner:scan';
}

export function isScannerResultEvent(event: any): event is ScannerResultEvent {
  return event?.type === 'scanner:result';
}

// ============================================================================
// EVENT TYPE REGISTRY
// ============================================================================

export interface EventTypeDefinition<TPayload = any> {
  type: string;
  payloadSchema: z.ZodSchema<TPayload>;
  description: string;
  category: 'student' | 'book' | 'equipment' | 'system' | 'import' | 'user' | 'scanner';
  requiresAuth: boolean;
  allowedRoles?: string[];
}

export class EventTypeRegistry {
  private static eventTypes = new Map<string, EventTypeDefinition>();

  static register<TPayload>(definition: EventTypeDefinition<TPayload>): void {
    this.eventTypes.set(definition.type, definition);
  }

  static get(type: string): EventTypeDefinition | undefined {
    return this.eventTypes.get(type);
  }

  static getAll(): Map<string, EventTypeDefinition> {
    return new Map(this.eventTypes);
  }

  static getByCategory(category: string): EventTypeDefinition[] {
    return Array.from(this.eventTypes.values()).filter(
      eventType => eventType.category === category
    );
  }

  static validateEvent<TPayload>(event: any): { valid: boolean; error?: string } {
    const eventType = this.get(event.type);
    if (!eventType) {
      return { valid: false, error: `Unknown event type: ${event.type}` };
    }

    const result = eventType.payloadSchema.safeParse(event.payload);
    if (!result.success) {
      return { valid: false, error: result.error.message };
    }

    return { valid: true };
  }
}

// Register all event types
EventTypeRegistry.register({
  type: 'student:create',
  payloadSchema: StudentCreatePayloadSchema,
  description: 'Create a new student',
  category: 'student',
  requiresAuth: true,
  allowedRoles: ['admin', 'librarian'],
});

EventTypeRegistry.register({
  type: 'student:update',
  payloadSchema: StudentUpdatePayloadSchema,
  description: 'Update student information',
  category: 'student',
  requiresAuth: true,
  allowedRoles: ['admin', 'librarian'],
});

EventTypeRegistry.register({
  type: 'student:delete',
  payloadSchema: StudentDeletePayloadSchema,
  description: 'Delete a student',
  category: 'student',
  requiresAuth: true,
  allowedRoles: ['admin'],
});

EventTypeRegistry.register({
  type: 'student:checkout',
  payloadSchema: StudentCheckoutPayloadSchema,
  description: 'Checkout books or equipment to a student',
  category: 'student',
  requiresAuth: true,
  allowedRoles: ['admin', 'librarian'],
});

EventTypeRegistry.register({
  type: 'student:return',
  payloadSchema: StudentReturnPayloadSchema,
  description: 'Return books or equipment from a student',
  category: 'student',
  requiresAuth: true,
  allowedRoles: ['admin', 'librarian'],
});

EventTypeRegistry.register({
  type: 'book:create',
  payloadSchema: BookCreatePayloadSchema,
  description: 'Create a new book',
  category: 'book',
  requiresAuth: true,
  allowedRoles: ['admin', 'librarian'],
});

EventTypeRegistry.register({
  type: 'book:update',
  payloadSchema: BookUpdatePayloadSchema,
  description: 'Update book information',
  category: 'book',
  requiresAuth: true,
  allowedRoles: ['admin', 'librarian'],
});

EventTypeRegistry.register({
  type: 'book:delete',
  payloadSchema: BookDeletePayloadSchema,
  description: 'Delete a book',
  category: 'book',
  requiresAuth: true,
  allowedRoles: ['admin'],
});

EventTypeRegistry.register({
  type: 'book:checkout',
  payloadSchema: BookCheckoutPayloadSchema,
  description: 'Checkout a book to a student',
  category: 'book',
  requiresAuth: true,
  allowedRoles: ['admin', 'librarian'],
});

EventTypeRegistry.register({
  type: 'book:return',
  payloadSchema: BookReturnPayloadSchema,
  description: 'Return a book from a student',
  category: 'book',
  requiresAuth: true,
  allowedRoles: ['admin', 'librarian'],
});

EventTypeRegistry.register({
  type: 'book:reserve',
  payloadSchema: BookReservePayloadSchema,
  description: 'Reserve a book for a student',
  category: 'book',
  requiresAuth: true,
  allowedRoles: ['admin', 'librarian'],
});

EventTypeRegistry.register({
  type: 'equipment:create',
  payloadSchema: EquipmentCreatePayloadSchema,
  description: 'Create new equipment',
  category: 'equipment',
  requiresAuth: true,
  allowedRoles: ['admin', 'librarian'],
});

EventTypeRegistry.register({
  type: 'equipment:update',
  payloadSchema: EquipmentUpdatePayloadSchema,
  description: 'Update equipment information',
  category: 'equipment',
  requiresAuth: true,
  allowedRoles: ['admin', 'librarian'],
});

EventTypeRegistry.register({
  type: 'equipment:delete',
  payloadSchema: EquipmentDeletePayloadSchema,
  description: 'Delete equipment',
  category: 'equipment',
  requiresAuth: true,
  allowedRoles: ['admin'],
});

EventTypeRegistry.register({
  type: 'equipment:checkout',
  payloadSchema: EquipmentCheckoutPayloadSchema,
  description: 'Checkout equipment to a student',
  category: 'equipment',
  requiresAuth: true,
  allowedRoles: ['admin', 'librarian'],
});

EventTypeRegistry.register({
  type: 'equipment:return',
  payloadSchema: EquipmentReturnPayloadSchema,
  description: 'Return equipment from a student',
  category: 'equipment',
  requiresAuth: true,
  allowedRoles: ['admin', 'librarian'],
});

EventTypeRegistry.register({
  type: 'equipment:reserve',
  payloadSchema: EquipmentReservePayloadSchema,
  description: 'Reserve equipment for a student',
  category: 'equipment',
  requiresAuth: true,
  allowedRoles: ['admin', 'librarian'],
});

EventTypeRegistry.register({
  type: 'system:notification',
  payloadSchema: SystemNotificationPayloadSchema,
  description: 'Send system notification',
  category: 'system',
  requiresAuth: true,
  allowedRoles: ['admin', 'librarian'],
});

EventTypeRegistry.register({
  type: 'system:alert',
  payloadSchema: SystemAlertPayloadSchema,
  description: 'Send system alert',
  category: 'system',
  requiresAuth: true,
  allowedRoles: ['admin', 'librarian'],
});

EventTypeRegistry.register({
  type: 'system:status',
  payloadSchema: SystemStatusPayloadSchema,
  description: 'Update system status',
  category: 'system',
  requiresAuth: true,
  allowedRoles: ['admin'],
});

EventTypeRegistry.register({
  type: 'import:start',
  payloadSchema: ImportStartPayloadSchema,
  description: 'Start data import',
  category: 'import',
  requiresAuth: true,
  allowedRoles: ['admin', 'librarian'],
});

EventTypeRegistry.register({
  type: 'import:progress',
  payloadSchema: ImportProgressPayloadSchema,
  description: 'Update import progress',
  category: 'import',
  requiresAuth: true,
  allowedRoles: ['admin', 'librarian'],
});

EventTypeRegistry.register({
  type: 'import:completion',
  payloadSchema: ImportCompletionPayloadSchema,
  description: 'Complete data import',
  category: 'import',
  requiresAuth: true,
  allowedRoles: ['admin', 'librarian'],
});

EventTypeRegistry.register({
  type: 'user:login',
  payloadSchema: UserLoginPayloadSchema,
  description: 'User login event',
  category: 'user',
  requiresAuth: false,
});

EventTypeRegistry.register({
  type: 'user:logout',
  payloadSchema: UserLogoutPayloadSchema,
  description: 'User logout event',
  category: 'user',
  requiresAuth: false,
});

EventTypeRegistry.register({
  type: 'user:permissions',
  payloadSchema: UserPermissionsPayloadSchema,
  description: 'Update user permissions',
  category: 'user',
  requiresAuth: true,
  allowedRoles: ['admin'],
});

EventTypeRegistry.register({
  type: 'user:preferences',
  payloadSchema: UserPreferencesPayloadSchema,
  description: 'Update user preferences',
  category: 'user',
  requiresAuth: true,
});

EventTypeRegistry.register({
  type: 'scanner:scan',
  payloadSchema: ScannerScanPayloadSchema,
  description: 'Scanner scan event',
  category: 'scanner',
  requiresAuth: true,
});

EventTypeRegistry.register({
  type: 'scanner:result',
  payloadSchema: ScannerResultPayloadSchema,
  description: 'Scanner scan result',
  category: 'scanner',
  requiresAuth: false,
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a new WebSocket event with proper structure
 */
export function createWebSocketEvent<TPayload>(
  type: string,
  payload: TPayload,
  options: {
    id?: string;
    userId?: string;
    sessionId?: string;
    metadata?: Partial<EventMetadata>;
  } = {}
): BaseWebSocketEvent<TPayload> {
  return {
    id: options.id || crypto.randomUUID(),
    type,
    timestamp: new Date(),
    userId: options.userId || undefined,
    sessionId: options.sessionId || undefined,
    payload,
    metadata: {
      source: 'client',
      version: '1.0.0',
      ...options.metadata,
    },
  };
}

/**
 * Create an event response
 */
export function createEventResponse<TPayload>(
  eventId: string,
  success: boolean,
  payload?: TPayload,
  error?: EventError
): EventResponse<TPayload> {
  return {
    eventId,
    success,
    timestamp: new Date(),
    payload: payload || undefined,
    error,
  };
}

/**
 * Validate and parse a WebSocket event
 */
export function parseWebSocketEvent<TPayload>(
  event: any,
  schema: z.ZodSchema<TPayload>
): { success: boolean; data?: TPayload; error?: string } {
  try {
    const data = schema.parse(event.payload);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'Unknown validation error' };
  }
}

/**
 * Get all event types for a specific category
 */
export function getEventTypesByCategory(category: string): string[] {
  return EventTypeRegistry.getByCategory(category).map(eventType => eventType.type);
}

/**
 * Check if a user has permission to send an event type
 */
export function hasEventPermission(eventType: string, userRole: string): boolean {
  const definition = EventTypeRegistry.get(eventType);
  if (!definition) return false;
  
  if (!definition.requiresAuth) return true;
  if (!definition.allowedRoles) return true;
  
  return definition.allowedRoles.includes(userRole);
}