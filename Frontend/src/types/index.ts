// Core type definitions for enhanced type safety

// Base entity interface with common fields
interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

// API response wrapper types
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
}

// HTTP methods for type safety
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// Request configuration with proper typing
interface ApiRequestConfig {
  method: HttpMethod;
  url: string;
  data?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, string | number>;
  timeout?: number;
  retries?: number;
}

// Enhanced error types
interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: Record<string, unknown>;
}

// Book entity with strict typing
interface Book extends BaseEntity {
  isbn?: string;
  accessionNo: string;
  title: string;
  author: string;
  publisher?: string;
  category: string;
  subcategory?: string;
  location?: string;
  totalCopies: number;
  availableCopies: number;
  barcodeImage?: string;
  description?: string;
  publishYear?: number;
  language?: string;
  pages?: number;
  subjects?: string[];
}

// Student entity
interface Student extends BaseEntity {
  studentId: string;
  firstName: string;
  lastName: string;
  grade: GradeCategory;
  section?: string;
  email?: string;
  phone?: string;
  address?: string;
  guardianName?: string;
  guardianContact?: string;
  barcodeImage?: string;
  notes?: string;
  gender?: string;
  designation?: string;
}

// Grade categories
type GradeCategory = 'PRIMARY' | 'GRADE_SCHOOL' | 'JUNIOR_HIGH' | 'SENIOR_HIGH';

// User roles with specific permissions
type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'LIBRARIAN'
  | 'TEACHER'
  | 'STUDENT_AIDE'
  | 'VIEWER';

// User entity
interface User extends BaseEntity {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  lastLogin?: string;
  permissions: Permission[];
}

// Permission system
type Permission =
  | 'users.read'
  | 'users.write'
  | 'users.delete'
  | 'books.read'
  | 'books.write'
  | 'books.delete'
  | 'students.read'
  | 'students.write'
  | 'students.delete'
  | 'equipment.read'
  | 'equipment.write'
  | 'equipment.delete'
  | 'reports.read'
  | 'reports.write'
  | 'system.admin'
  | 'analytics.read';

// Activity tracking
interface StudentActivity extends BaseEntity {
  studentId: string;
  bookId?: string;
  equipmentId?: string;
  activityType: ActivityType;
  description: string;
  value?: number;
  metadata?: Record<string, unknown>;
  performedBy: string;
}

type ActivityType =
  | 'BOOK_CHECKOUT'
  | 'BOOK_CHECKIN'
  | 'BOOK_RENEWAL'
  | 'BOOK_RESERVATION'
  | 'EQUIPMENT_CHECKOUT'
  | 'EQUIPMENT_CHECKIN'
  | 'FINE_PAYMENT'
  | 'PROFILE_UPDATE'
  | 'LOGIN'
  | 'LOGOUT';

// Equipment tracking
interface Equipment extends BaseEntity {
  name: string;
  category: string;
  description?: string;
  location?: string;
  totalUnits: number;
  availableUnits: number;
  condition: EquipmentCondition;
  requiresSupervision: boolean;
  maxCheckoutHours: number;
  barcodeImage?: string;
  specs?: string; // Equipment specifications
  notes?: string; // Additional notes
}

type EquipmentCondition =
  | 'EXCELLENT'
  | 'GOOD'
  | 'FAIR'
  | 'POOR'
  | 'MAINTENANCE_REQUIRED';

// Equipment sessions
interface EquipmentSession extends BaseEntity {
  equipmentId: string;
  studentId: string;
  startTime: string;
  endTime?: string;
  expectedReturnTime: string;
  status: SessionStatus;
  notes?: string;
  supervisedBy?: string;
}

type SessionStatus = 'ACTIVE' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';

// Fine management
interface Fine extends BaseEntity {
  studentId: string;
  bookId?: string;
  equipmentId?: string;
  type: FineType;
  amount: number;
  reason: string;
  status: FineStatus;
  dueDate: string;
  paidDate?: string;
  paymentMethod?: PaymentMethod;
  notes?: string;
}

type FineType =
  | 'OVERDUE_BOOK'
  | 'DAMAGED_BOOK'
  | 'LOST_BOOK'
  | 'OVERDUE_EQUIPMENT'
  | 'DAMAGED_EQUIPMENT'
  | 'OTHER';

type FineStatus = 'PENDING' | 'PAID' | 'WAIVED' | 'DISPUTED';
type PaymentMethod = 'CASH' | 'CHECK' | 'ONLINE' | 'WAVE';

// System configuration
interface SystemConfig extends BaseEntity {
  key: string;
  value: string | number | boolean;
  description?: string;
  category: ConfigCategory;
  isPublic: boolean;
}

type ConfigCategory =
  | 'GENERAL'
  | 'LIBRARY'
  | 'STUDENTS'
  | 'EQUIPMENT'
  | 'NOTIFICATIONS'
  | 'SECURITY'
  | 'INTEGRATIONS';

// Notifications
interface AppNotification extends BaseEntity {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  priority: NotificationPriority;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

type NotificationType =
  | 'INFO'
  | 'SUCCESS'
  | 'WARNING'
  | 'ERROR'
  | 'BOOK_DUE'
  | 'OVERDUE'
  | 'RESERVATION_READY'
  | 'FINE_DUE'
  | 'SYSTEM';

type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

// Audit logging
interface AuditLog extends BaseEntity {
  userId: string;
  action: string;
  entity: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

// Analytics and reporting
interface AnalyticsMetric {
  name: string;
  value: number;
  change?: number;
  changeType?: 'increase' | 'decrease';
  period: string;
}

interface ReportConfig {
  id: string;
  name: string;
  description: string;
  type: ReportType;
  filters: ReportFilter[];
  columns: ReportColumn[];
  groupBy?: string[];
  orderBy?: OrderByConfig[];
}

type ReportType =
  | 'BOOKS'
  | 'STUDENTS'
  | 'ACTIVITIES'
  | 'EQUIPMENT'
  | 'FINES'
  | 'OVERDUE'
  | 'CUSTOM';

interface ReportFilter {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'between'
  | 'in'
  | 'not_in';

interface ReportColumn {
  field: string;
  header: string;
  type: ColumnType;
  width?: number;
  sortable?: boolean;
  filterable?: boolean;
}

type ColumnType =
  | 'text'
  | 'number'
  | 'date'
  | 'boolean'
  | 'currency'
  | 'percentage';

interface OrderByConfig {
  field: string;
  direction: 'asc' | 'desc';
}

// Theme and UI types
type Theme = 'light' | 'dark' | 'system';

interface UIConfig {
  theme: Theme;
  sidebarCollapsed: boolean;
  compactMode: boolean;
  showNotifications: boolean;
  autoRefresh: boolean;
  refreshInterval: number;
  language: string;
  timezone: string;
}

// Form types for strict validation
interface FormField<T = unknown> {
  name: string;
  label: string;
  type: FormFieldType;
  value: T;
  required: boolean;
  disabled?: boolean;
  placeholder?: string;
  validation?: ValidationRule[];
  options?: FormOption[];
}

type FormFieldType =
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'radio'
  | 'textarea'
  | 'date'
  | 'file';

interface FormOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

interface ValidationRule {
  type: ValidationType;
  value?: unknown;
  message: string;
}

type ValidationType =
  | 'required'
  | 'minLength'
  | 'maxLength'
  | 'pattern'
  | 'min'
  | 'max'
  | 'email'
  | 'url'
  | 'custom';

// Utility types
type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
type IdOf<T> = T extends { id: infer U } ? U : never;

// Event types for type-safe event handling
interface AppEvent<T = unknown> {
  type: string;
  payload: T;
  timestamp: string;
  userId?: string;
  sessionId?: string;
}

// WebSocket event types for real-time updates
interface WebSocketMessageData {
  activityId?: string;
  studentId?: string;
  studentName?: string;
  equipmentId?: string;
  equipmentName?: string;
  dataType?: string;
  data?: unknown;
  gradeLevel?: string | number;
  purpose?: string;
  [key: string]: unknown;
}

interface ActivityUpdate {
  id: string;
  studentId?: string;
  studentName?: string;
  activityType: string;
  gradeLevel?: string;
  timestamp: string | number;
  equipmentName?: string;
  [key: string]: unknown;
}

interface DashboardStats {
  totalStudents?: number;
  activeStudents?: number;
  totalBooks?: number;
  todayActivities?: number;
  activeEquipment?: number;
  activeConnections?: number;
  systemLoad?: number;
  total_students?: number;
  active_students?: number;
  total_books?: number;
  today_activities?: number;
  total_equipment?: number;
  active_connections?: number;
  system_load?: number;
  students?: { total?: number; active?: number };
  books?: { total?: number };
  equipment?: { total?: number };
}

interface EquipmentStatusData {
  equipmentId: string;
  equipmentName?: string;
  equipmentType?: string;
  status: string;
  userId?: string;
  [key: string]: unknown;
}

// State management types
interface AppState {
  user: User | null;
  config: UIConfig;
  notifications: Notification[];
  loading: Record<string, boolean>;
  errors: Record<string, ApiError | null>;
}

// Export all types
export type {
  // Base types
  BaseEntity,
  ApiResponse,
  PaginatedResponse,
  ApiRequestConfig,
  ApiError,
  HttpMethod,

  // Entity types
  Book,
  Student,
  User,
  UserRole,
  Permission,
  StudentActivity,
  ActivityType,
  Equipment,
  EquipmentCondition,
  EquipmentSession,
  SessionStatus,
  Fine,
  FineType,
  FineStatus,
  PaymentMethod,
  SystemConfig,
  ConfigCategory,
  AppNotification,
  NotificationType,
  NotificationPriority,
  AuditLog,
  GradeCategory,

  // Analytics and reporting
  AnalyticsMetric,
  ReportConfig,
  ReportType,
  ReportFilter,
  FilterOperator,
  ReportColumn,
  ColumnType,
  OrderByConfig,

  // UI types
  Theme,
  UIConfig,

  // Form types
  FormField,
  FormFieldType,
  FormOption,
  ValidationRule,
  ValidationType,

  // Utility types
  Optional,
  RequiredBy,
  DeepPartial,
  IdOf,

  // Event and state types
  AppEvent,
  AppState,

  // WebSocket types
  WebSocketMessageData,
  ActivityUpdate,
  DashboardStats,
  EquipmentStatusData,
};
