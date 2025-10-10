import { Request } from 'express'

// Database types from Prisma
export * from '@prisma/client'

// Application-specific types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp: string
}

export interface PaginationParams {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  items: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    userId: string
    username: string
    role: string
  }
}

// Student management types
export interface StudentCreateInput {
  studentId: string
  firstName: string
  lastName: string
  gradeLevel: string
  gradeCategory: string
  section?: string
}

export interface StudentUpdateInput {
  firstName?: string
  lastName?: string
  gradeLevel?: string
  gradeCategory?: string
  section?: string
  isActive?: boolean
}

// Book management types
export interface BookCreateInput {
  isbn?: string
  accessionNo: string
  title: string
  author: string
  publisher?: string
  category: string
  subcategory?: string
  location?: string
  totalCopies?: number
}

export interface BookUpdateInput {
  isbn?: string
  title?: string
  author?: string
  publisher?: string
  category?: string
  subcategory?: string
  location?: string
  totalCopies?: number
  isActive?: boolean
}

// Equipment management types
export interface EquipmentSessionInput {
  equipmentId: string
  studentId: string
  plannedDurationMinutes?: number
}

export interface EquipmentSessionExtension {
  additionalMinutes: number
  reason?: string
}

// Activity types
export interface ActivityCreateInput {
  studentId: string
  activityType: string
  equipmentId?: string
  timeLimitMinutes?: number
  notes?: string
}

export interface ActivityUpdateInput {
  endTime?: Date
  durationMinutes?: number
  status?: string
  notes?: string
}

// Google Sheets integration types
export interface GoogleSheetsConfig {
  spreadsheetId: string
  clientEmail: string
  privateKeyPath: string
}

export interface GoogleSheetRow {
  timestamp: string
  [key: string]: any
}

export interface SyncResult {
  success: boolean
  rowsSynced: number
  errors: string[]
  duration: number
}

// Automation types
export interface JobConfig {
  [key: string]: any
}

export interface JobExecutionResult {
  success: boolean
  recordsProcessed?: number
  errorMessage?: string
  duration: number
  metadata?: Record<string, any>
}

// Import/Export types
export interface ImportResult {
  success: boolean
  totalRows: number
  importedRows: number
  skippedRows: number
  errorRows: number
  errors: ImportError[]
}

export interface ImportError {
  row: number
  field?: string
  message: string
  value?: any
}

export interface BarcodeGenerationOptions {
  format: 'CODE128' | 'CODE39' | 'QR_CODE' | 'EAN13'
  width: number
  height: number
  includeText: boolean
  fontSize?: number
}

export interface BarcodeInfo {
  id: string
  barcodeData: string
  format: string
  imageData: string // Base64 encoded
  filename: string
}

// System configuration types
export interface SystemSettings {
  library: {
    name: string
    timezone: string
    hoursStart: string
    hoursEnd: string
  }
  timeLimits: {
    primary: number
    gradeSchool: number
    juniorHigh: number
    seniorHigh: number
  }
  equipment: {
    computerStations: number
    gamingStations: number
    avrRooms: number
  }
  backup: {
    enabled: boolean
    schedule: string
    retentionDays: number
  }
  googleSheets: {
    enabled: boolean
    spreadsheetId: string
    syncInterval: number
  }
  notifications: {
    enabled: boolean
    schedule: string
    email?: string
  }
}

// Error types
export interface ValidationError {
  field: string
  message: string
  value?: any
}

export interface AppError extends Error {
  statusCode: number
  isOperational: boolean
  code?: string
  details?: any
}

// Statistics and reporting types
export interface DailyStatistics {
  date: string
  totalStudents: number
  totalActivities: number
  totalSessions: number
  totalCheckouts: number
  averageSessionDuration: number
  equipmentUtilization: Record<string, number>
  gradeCategoryBreakdown: Record<string, number>
  activityTypeBreakdown: Record<string, number>
}

export interface SystemHealth {
  database: {
    connected: boolean
    responseTime: number
  }
  googleSheets: {
    connected: boolean
    lastSync: string
  }
  automation: {
    running: number
    failed: number
    lastRun: string
  }
  memory: {
    used: number
    total: number
  }
  uptime: number
}

// Queue and job processing types
export interface QueueJob {
  id: string
  type: string
  data: any
  options: {
    attempts?: number
    delay?: number
    priority?: number
  }
}

// Barcode scanner types
export interface ScanResult {
  format: string
  text: string
  timestamp: Date
}

export interface ScannerConfig {
  enabledFormats: string[]
  scanInterval: number
  autoSubmit: boolean
}

// Notification types
export interface Notification {
  id: string
  type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS'
  title: string
  message: string
  timestamp: Date
  isRead: boolean
  actionUrl?: string
  metadata?: Record<string, any>
}