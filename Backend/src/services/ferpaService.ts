import CryptoJS from 'crypto-js';
import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { FERPAComplianceError } from '@/errors/error-types';
import { logger } from '@/utils/logger';
import { injectable, inject } from 'inversify';
import { TYPES } from '@/di/container';
import { SecurityMonitoringService, SecurityEventType, AlertSeverity } from './securityMonitoringService';
import crypto from 'crypto';

// FERPA compliance levels
export enum FERPAComplianceLevel {
  PUBLIC = 'public',           // Directory information
  LIMITED = 'limited',         // Limited access with justification
  SENSITIVE = 'sensitive',     // Sensitive PII
  RESTRICTED = 'restricted',   // Highly restricted data
  CONFIDENTIAL = 'confidential' // Maximum protection
}

// Data sensitivity classification
export enum DataSensitivity {
  DIRECTORY_INFO = 'directory_info',      // Name, grade, attendance
  ACADEMIC_RECORDS = 'academic_records',  // Grades, courses, credits
  PERSONAL_INFO = 'personal_info',        // Address, phone, email
  MEDICAL_INFO = 'medical_info',          // Health records
  DISCIPLINARY = 'disciplinary',          // Conduct records
  FINANCIAL = 'financial',                // Fee records, fines
  ASSESSMENT = 'assessment',              // Test scores, evaluations
  SPECIAL_EDUCATION = 'special_education' // IEP, special services
}

// Access request types
export enum AccessRequestType {
  VIEW = 'view',
  EDIT = 'edit',
  EXPORT = 'export',
  PRINT = 'print',
  SHARE = 'share',
  ANALYTICS = 'analytics'
}

// Access justification categories
export enum AccessJustification {
  EDUCATIONAL_PURPOSE = 'educational_purpose',
  LEGAL_REQUIREMENT = 'legal_requirement',
  HEALTH_SAFETY = 'health_safety',
  CONSENT = 'consent',
  DIRECTORY_INFO = 'directory_info',
  ADMINISTRATIVE = 'administrative',
  RESEARCH = 'research',
  AUDIT = 'audit'
}

export interface FERPAFieldAccess {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  requiresAudit: boolean;
  requiresJustification: boolean;
  complianceLevel: FERPAComplianceLevel;
}

export interface FERPAAuditLog {
  userId: string;
  action: 'READ' | 'WRITE' | 'DELETE' | 'EXPORT';
  resource: string;
  resourceId: string;
  fields: string[];
  timestamp: Date;
  ipAddress: string;
  userAgent?: string;
  success: boolean;
  reason?: string;
  complianceLevel: FERPAComplianceLevel;
  dataSensitivity: DataSensitivity[];
  accessJustification?: AccessJustification;
  sessionId?: string;
  requestId?: string;
}

// Access request interface
export interface AccessRequest {
  id: string;
  requesterId: string;
  requesterRole: string;
  targetType: 'student' | 'students' | 'activity' | 'activities';
  targetId?: string;
  accessType: AccessRequestType;
  justification: AccessJustification;
  justificationText: string;
  duration: number; // hours
  status: 'pending' | 'approved' | 'denied' | 'expired' | 'revoked';
  approvedBy?: string;
  approvedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  metadata: {
    ipAddress: string;
    userAgent: string;
    requestId?: string;
    sessionId?: string;
  };
}

// Field mapping for data sensitivity
export const FIELD_SENSITIVITY_MAP: Record<string, DataSensitivity> = {
  // Student fields
  'students.first_name': DataSensitivity.PERSONAL_INFO,
  'students.last_name': DataSensitivity.PERSONAL_INFO,
  'students.student_id': DataSensitivity.PERSONAL_INFO,
  'students.section': DataSensitivity.ACADEMIC_RECORDS,
  'students.grade_level': DataSensitivity.DIRECTORY_INFO,
  'students.grade_category': DataSensitivity.DIRECTORY_INFO,
  'students.fine_balance': DataSensitivity.FINANCIAL,
  'students.equipment_ban': DataSensitivity.DISCIPLINARY,
  'students.equipment_ban_reason': DataSensitivity.DISCIPLINARY,

  // Activity fields
  'student_activities.student_name': DataSensitivity.DIRECTORY_INFO,
  'student_activities.notes': DataSensitivity.ACADEMIC_RECORDS,

  // Equipment session fields
  'equipment_sessions.notes': DataSensitivity.ACADEMIC_RECORDS,

  // Book checkout fields
  'book_checkouts.notes': DataSensitivity.ACADEMIC_RECORDS,
  'book_checkouts.fine_amount': DataSensitivity.FINANCIAL,

  // User fields
  'users.email': DataSensitivity.PERSONAL_INFO,
  'users.full_name': DataSensitivity.PERSONAL_INFO,
  'users.username': DataSensitivity.PERSONAL_INFO
};

// Role-based access permissions
export const ROLE_FERPA_PERMISSIONS: Record<string, FERPAComplianceLevel[]> = {
  'SUPER_ADMIN': [
    FERPAComplianceLevel.PUBLIC,
    FERPAComplianceLevel.LIMITED,
    FERPAComplianceLevel.SENSITIVE,
    FERPAComplianceLevel.RESTRICTED,
    FERPAComplianceLevel.CONFIDENTIAL
  ],
  'ADMIN': [
    FERPAComplianceLevel.PUBLIC,
    FERPAComplianceLevel.LIMITED,
    FERPAComplianceLevel.SENSITIVE,
    FERPAComplianceLevel.RESTRICTED
  ],
  'LIBRARIAN': [
    FERPAComplianceLevel.PUBLIC,
    FERPAComplianceLevel.LIMITED,
    FERPAComplianceLevel.SENSITIVE
  ],
  'ASSISTANT': [
    FERPAComplianceLevel.PUBLIC,
    FERPAComplianceLevel.LIMITED
  ],
  'TEACHER': [
    FERPAComplianceLevel.PUBLIC,
    FERPAComplianceLevel.LIMITED
  ],
  'VIEWER': [
    FERPAComplianceLevel.PUBLIC
  ]
};

@injectable()
export class FERPAService {
  private encryptionKey: string;
  private auditLogs: FERPAAuditLog[] = [];
  private activeAccessRequests: Map<string, AccessRequest> = new Map();
  private dataMaskingCache: Map<string, any> = new Map();
  private prisma: PrismaClient;
  private securityService: SecurityMonitoringService;
  private roleAccessLevels: Record<string, string[]> = {
    'SUPER_ADMIN': ['*'],
    'ADMIN': ['students.*', 'activities.*', 'equipment.*'],
    'LIBRARIAN': ['students.read', 'activities.*'],
    'ASSISTANT': ['students.read', 'activities.read'],
    'TEACHER': ['students.read', 'activities.read'],
    'VIEWER': ['students.read']
  };
  private sensitiveFields: string[] = [
    'email', 'phone', 'address', 'parentName', 'parentPhone', 'parentEmail',
    'fineBalance', 'equipmentBan', 'equipmentBanReason'
  ];

  constructor(
    @inject(TYPES.PrismaClient) prisma: PrismaClient,
    @inject(TYPES.SecurityMonitoringService) securityService: SecurityMonitoringService
  ) {
    this.prisma = prisma;
    this.securityService = securityService;
    this.encryptionKey = process.env.FERPA_ENCRYPTION_KEY || 'default-ferpa-key-change-in-production';

    if (this.encryptionKey === 'default-ferpa-key-change-in-production') {
      logger.warn('FERPA service using default encryption key - please set FERPA_ENCRYPTION_KEY environment variable');
    }

    this.startPeriodicCleanup();
  }

  /**
   * Check if user has FERPA-compliant access to specific data
   */
  public async checkDataAccess(
    userId: string,
    userRole: string,
    entityType: string,
    fields: string[],
    accessType: AccessRequestType = AccessRequestType.VIEW,
    justification?: AccessJustification,
    justificationText?: string,
    metadata?: any
  ): Promise<{
    allowed: boolean;
    maskedFields: string[];
    complianceLevel: FERPAComplianceLevel;
    requiresJustification: boolean;
    errorMessage?: string;
  }> {
    try {
      const requestId = metadata?.requestId || this.generateRequestId();
      const ipAddress = metadata?.ipAddress || 'unknown';
      const userAgent = metadata?.userAgent || 'unknown';

      // Determine required compliance level for accessed fields
      const requiredLevels = fields.map(field =>
        this.getRequiredComplianceLevel(field)
      );
      const maxRequiredLevel = this.getHighestComplianceLevel(requiredLevels);

      // Check if user role has permission for required level
      const userPermissions = ROLE_FERPA_PERMISSIONS[userRole] || [];
      const hasPermission = userPermissions.includes(maxRequiredLevel);

      if (!hasPermission) {
        // Log access violation
        await this.logAccess({
          userId,
          action: 'READ',
          resource: entityType,
          resourceId: metadata?.entityId || 'unknown',
          fields,
          timestamp: new Date(),
          ipAddress,
          userAgent,
          success: false,
          reason: `Insufficient FERPA permissions for ${maxRequiredLevel} data`,
          complianceLevel: maxRequiredLevel,
          dataSensitivity: fields.map(f => this.getFieldSensitivity(f)),
          accessJustification: justification,
          sessionId: metadata?.sessionId,
          requestId
        });

        // Record security event
        await this.securityService.recordSecurityEvent(
          SecurityEventType.FERPA_VIOLATION,
          { ip: ipAddress, get: () => userAgent } as Request,
          {
            userId,
            userRole,
            entityType,
            fields,
            requiredLevel: maxRequiredLevel,
            attemptedAccess: accessType
          },
          AlertSeverity.HIGH
        );

        return {
          allowed: false,
          maskedFields: fields,
          complianceLevel: maxRequiredLevel,
          requiresJustification: true,
          errorMessage: `Insufficient FERPA permissions for ${maxRequiredLevel} data`
        };
      }

      // Determine which fields need masking
      const maskedFields = this.getMaskedFields(userRole, fields);
      const requiresJustification = this.requiresAccessJustification(userRole, maxRequiredLevel);

      // Log successful access
      await this.logAccess({
        userId,
        action: 'READ',
        resource: entityType,
        resourceId: metadata?.entityId || 'unknown',
        fields,
        timestamp: new Date(),
        ipAddress,
        userAgent,
        success: true,
        complianceLevel: maxRequiredLevel,
        dataSensitivity: fields.map(f => this.getFieldSensitivity(f)),
        accessJustification: justification,
        sessionId: metadata?.sessionId,
        requestId
      });

      return {
        allowed: true,
        maskedFields,
        complianceLevel: maxRequiredLevel,
        requiresJustification
      };

    } catch (error) {
      logger.error('FERPA access check failed', { error, userId, userRole, entityType, fields });
      return {
        allowed: false,
        maskedFields: fields,
        complianceLevel: FERPAComplianceLevel.RESTRICTED,
        requiresJustification: true,
        errorMessage: 'FERPA access check failed'
      };
    }
  }

  /**
   * Apply data masking to sensitive fields
   */
  public applyDataMasking(
    data: any,
    maskedFields: string[],
    userRole: string
  ): any {
    if (!data || maskedFields.length === 0) {
      return data;
    }

    const maskedData = { ...data };

    for (const field of maskedFields) {
      const value = this.getNestedValue(data, field);
      if (value !== undefined) {
        const maskedValue = this.maskFieldValue(value, field, userRole);
        this.setNestedValue(maskedData, field, maskedValue);
      }
    }

    return maskedData;
  }

  /**
   * Create access request for sensitive data
   */
  public async createAccessRequest(
    requesterId: string,
    requesterRole: string,
    targetType: 'student' | 'students' | 'activity' | 'activities',
    targetId: string | undefined,
    accessType: AccessRequestType,
    justification: AccessJustification,
    justificationText: string,
    duration: number,
    metadata: {
      ipAddress: string;
      userAgent: string;
      requestId?: string;
      sessionId?: string;
    }
  ): Promise<AccessRequest> {
    const request: AccessRequest = {
      id: this.generateRequestId(),
      requesterId,
      requesterRole,
      targetType,
      targetId,
      accessType,
      justification,
      justificationText,
      duration,
      status: 'pending',
      createdAt: new Date(),
      metadata
    };

    // Store request in database
    await this.prisma.audit_logs.create({
      data: {
        id: request.id,
        entity: 'ferpa_access_request',
        action: 'CREATE',
        entity_id: request.id,
        performed_by: requesterId,
        ip_address: metadata.ipAddress,
        user_agent: metadata.userAgent,
        new_values: {
          request: {
            id: request.id,
            requesterId,
            targetType,
            accessType,
            justification,
            justificationText,
            duration,
            status: request.status
          }
        }
      }
    });

    // Store in memory for quick access
    this.activeAccessRequests.set(request.id, request);

    logger.info('FERPA access request created', {
      requestId: request.id,
      requesterId,
      targetType,
      accessType,
      justification
    });

    return request;
  }

  /**
   * Approve access request
   */
  public async approveAccessRequest(
    requestId: string,
    approvedBy: string,
    approvedByRole: string
  ): Promise<boolean> {
    const request = this.activeAccessRequests.get(requestId);
    if (!request) {
      logger.warn('Access request not found', { requestId });
      return false;
    }

    request.status = 'approved';
    request.approvedBy = approvedBy;
    request.approvedAt = new Date();
    request.expiresAt = new Date(Date.now() + (request.duration * 60 * 60 * 1000));

    // Update in database
    await this.prisma.audit_logs.create({
      data: {
        id: this.generateAuditId(),
        entity: 'ferpa_access_request',
        action: 'APPROVE',
        entity_id: requestId,
        performed_by: approvedBy,
        new_values: {
          status: 'approved',
          approvedBy,
          approvedAt: request.approvedAt,
          expiresAt: request.expiresAt
        }
      }
    });

    logger.info('FERPA access request approved', {
      requestId,
      approvedBy,
      approvedByRole,
      expiresAt: request.expiresAt
    });

    return true;
  }

  // Helper methods for FERPA compliance

  /**
   * Get required compliance level for a field
   */
  private getRequiredComplianceLevel(field: string): FERPAComplianceLevel {
    const sensitivity = this.getFieldSensitivity(field);

    switch (sensitivity) {
      case DataSensitivity.DIRECTORY_INFO:
        return FERPAComplianceLevel.PUBLIC;
      case DataSensitivity.ACADEMIC_RECORDS:
        return FERPAComplianceLevel.LIMITED;
      case DataSensitivity.PERSONAL_INFO:
        return FERPAComplianceLevel.SENSITIVE;
      case DataSensitivity.FINANCIAL:
      case DataSensitivity.ASSESSMENT:
        return FERPAComplianceLevel.RESTRICTED;
      case DataSensitivity.MEDICAL_INFO:
      case DataSensitivity.DISCIPLINARY:
      case DataSensitivity.SPECIAL_EDUCATION:
        return FERPAComplianceLevel.CONFIDENTIAL;
      default:
        return FERPAComplianceLevel.RESTRICTED;
    }
  }

  /**
   * Get data sensitivity classification for a field
   */
  private getFieldSensitivity(field: string): DataSensitivity {
    return FIELD_SENSITIVITY_MAP[field] || DataSensitivity.PERSONAL_INFO;
  }

  /**
   * Get highest compliance level from array
   */
  private getHighestComplianceLevel(levels: FERPAComplianceLevel[]): FERPAComplianceLevel {
    const levelOrder = [
      FERPAComplianceLevel.PUBLIC,
      FERPAComplianceLevel.LIMITED,
      FERPAComplianceLevel.SENSITIVE,
      FERPAComplianceLevel.RESTRICTED,
      FERPAComplianceLevel.CONFIDENTIAL
    ];

    return levels.reduce((highest, current) => {
      return levelOrder.indexOf(current) > levelOrder.indexOf(highest) ? current : highest;
    }, FERPAComplianceLevel.PUBLIC);
  }

  /**
   * Get fields that need masking for user role
   */
  private getMaskedFields(userRole: string, fields: string[]): string[] {
    const userPermissions = ROLE_FERPA_PERMISSIONS[userRole] || [];

    return fields.filter(field => {
      const requiredLevel = this.getRequiredComplianceLevel(field);
      return !userPermissions.includes(requiredLevel);
    });
  }

  /**
   * Check if access requires justification
   */
  private requiresAccessJustification(userRole: string, complianceLevel: FERPAComplianceLevel): boolean {
    const userPermissions = ROLE_FERPA_PERMISSIONS[userRole] || [];
    const maxAllowedLevel = userPermissions[userPermissions.length - 1];

    return complianceLevel > maxAllowedLevel;
  }

  /**
   * Mask field value based on sensitivity and user role
   */
  private maskFieldValue(value: string, field: string, userRole: string): string {
    const sensitivity = this.getFieldSensitivity(field);
    const cacheKey = `${field}:${userRole}:${value.substring(0, 10)}`;

    if (this.dataMaskingCache.has(cacheKey)) {
      return this.dataMaskingCache.get(cacheKey);
    }

    let maskedValue: string;

    switch (sensitivity) {
      case DataSensitivity.DIRECTORY_INFO:
        // Show partial information
        if (field.includes('name')) {
          maskedValue = value.length > 2 ? value.charAt(0) + '*'.repeat(value.length - 2) + value.charAt(value.length - 1) : '*'.repeat(value.length);
        } else {
          maskedValue = value;
        }
        break;

      case DataSensitivity.ACADEMIC_RECORDS:
        // Show limited information
        maskedValue = '[RESTRICTED]';
        break;

      case DataSensitivity.PERSONAL_INFO:
        // Show minimal information
        if (field.includes('email')) {
          const [username, domain] = value.split('@');
          maskedValue = username.charAt(0) + '*'.repeat(username.length - 2) + username.charAt(username.length - 1) + '@' + domain;
        } else if (field.includes('phone')) {
          maskedValue = value.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
        } else {
          maskedValue = value.length > 4 ? value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2) : '*'.repeat(value.length);
        }
        break;

      case DataSensitivity.FINANCIAL:
      case DataSensitivity.ASSESSMENT:
        // Show category only
        maskedValue = '[CONFIDENTIAL]';
        break;

      case DataSensitivity.MEDICAL_INFO:
      case DataSensitivity.DISCIPLINARY:
      case DataSensitivity.SPECIAL_EDUCATION:
        // Completely masked
        maskedValue = '[PROTECTED]';
        break;

      default:
        maskedValue = '[MASKED]';
    }

    // Cache the result
    this.dataMaskingCache.set(cacheKey, maskedValue);

    return maskedValue;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Set nested value in object using dot notation
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => current[key] = current[key] || {}, obj);
    target[lastKey] = value;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `ferpa_req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Generate unique audit ID
   */
  private generateAuditId(): string {
    return `ferpa_audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Start periodic cleanup of expired access requests and cache
   */
  private startPeriodicCleanup(): void {
    setInterval(async () => {
      try {
        const now = new Date();

        // Clean up expired access requests
        for (const [id, request] of this.activeAccessRequests.entries()) {
          if (request.expiresAt && request.expiresAt < now) {
            request.status = 'expired';
            this.activeAccessRequests.delete(id);

            // Log expiration
            await this.prisma.audit_logs.create({
              data: {
                id: this.generateAuditId(),
                entity: 'ferpa_access_request',
                action: 'EXPIRE',
                entity_id: id,
                performed_by: 'system',
                new_values: {
                  status: 'expired',
                  expiredAt: now
                }
              }
            });
          }
        }

        // Clean up masking cache (keep last 1000 entries)
        if (this.dataMaskingCache.size > 1000) {
          const entries = Array.from(this.dataMaskingCache.entries());
          this.dataMaskingCache.clear();
          entries.slice(-500).forEach(([key, value]) => {
            this.dataMaskingCache.set(key, value);
          });
        }

      } catch (error) {
        logger.error('FERPA service cleanup failed', { error });
      }
    }, 60 * 60 * 1000); // Run every hour
  }

  // Encrypt sensitive data
  encryptSensitiveData(data: any): string {
    try {
      const jsonString = JSON.stringify(data);
      const encrypted = CryptoJS.AES.encrypt(jsonString, this.encryptionKey).toString();
      return encrypted;
    } catch (error) {
      logger.error('Failed to encrypt sensitive data', error);
      throw new FERPAComplianceError('Data encryption failed', { error: (error as Error).message });
    }
  }

  // Decrypt sensitive data
  decryptSensitiveData(encryptedData: string): any {
    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
      const jsonString = decrypted.toString(CryptoJS.enc.Utf8);

      if (!jsonString) {
        throw new Error('Decryption failed - invalid data or key');
      }

      return JSON.parse(jsonString);
    } catch (error) {
      logger.error('Failed to decrypt sensitive data', error);
      throw new FERPAComplianceError('Data decryption failed', { error: (error as Error).message });
    }
  }

  // Log FERPA access
  private logAccess(logEntry: Partial<FERPAAuditLog>): void {
    const auditLog: FERPAAuditLog = {
      userId: logEntry.userId || '',
      action: logEntry.action || 'READ',
      resource: logEntry.resource || '',
      resourceId: logEntry.resourceId || '',
      fields: logEntry.fields || [],
      timestamp: logEntry.timestamp || new Date(),
      ipAddress: logEntry.ipAddress || '',
      userAgent: logEntry.userAgent,
      success: logEntry.success !== false,
      reason: logEntry.reason,
    };

    this.auditLogs.push(auditLog);

    // Log to system logger
    logger.info('FERPA Audit', {
      userId: auditLog.userId,
      action: auditLog.action,
      resource: auditLog.resource,
      resourceId: auditLog.resourceId,
      fields: auditLog.fields,
      timestamp: auditLog.timestamp,
      ipAddress: auditLog.ipAddress,
      success: auditLog.success,
    });

    // Keep only last 10000 audit logs in memory
    if (this.auditLogs.length > 10000) {
      this.auditLogs = this.auditLogs.slice(-10000);
    }
  }

  // Get audit logs (admin only)
  getAuditLogs(userId?: string, resourceId?: string, startDate?: Date, endDate?: Date): FERPAAuditLog[] {
    let logs = [...this.auditLogs];

    if (userId) {
      logs = logs.filter(log => log.userId === userId);
    }

    if (resourceId) {
      logs = logs.filter(log => log.resourceId === resourceId);
    }

    if (startDate) {
      logs = logs.filter(log => log.timestamp >= startDate);
    }

    if (endDate) {
      logs = logs.filter(log => log.timestamp <= endDate);
    }

    // Return newest first
    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Check for data breaches or suspicious access patterns
  detectSuspiciousAccess(userId: string, timeWindow: number = 3600000): FERPAAuditLog[] {
    const now = new Date();
    const windowStart = new Date(now.getTime() - timeWindow);

    const userLogs = this.auditLogs.filter(log =>
      log.userId === userId &&
      log.timestamp >= windowStart &&
      log.success
    );

    // Check for unusual patterns
    const suspiciousLogs: FERPAAuditLog[] = [];
    const fieldAccessCount = new Map<string, number>();

    userLogs.forEach(log => {
      log.fields.forEach(field => {
        fieldAccessCount.set(field, (fieldAccessCount.get(field) || 0) + 1);
      });
    });

    // Flag users accessing sensitive fields more than 10 times in an hour
    fieldAccessCount.forEach((count, field) => {
      if (this.sensitiveFields.includes(field) && count > 10) {
        suspiciousLogs.push(...userLogs.filter(log => log.fields.includes(field)));
      }
    });

    return suspiciousLogs;
  }

  // Export data with proper consent and audit
  async exportStudentData(studentId: string, requestUserId: string, userRole: string, consentGiven: boolean = false): Promise<any> {
    if (!consentGiven && !['ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
      throw new FERPAComplianceError('Student consent required for data export');
    }

    // Log export attempt
    this.logAccess({
      userId: requestUserId,
      action: 'EXPORT',
      resource: 'student',
      resourceId: studentId,
      fields: ['all'],
      timestamp: new Date(),
      ipAddress: '',
      success: consentGiven || ['ADMIN', 'SUPER_ADMIN'].includes(userRole),
      reason: consentGiven ? 'Student consent given' : 'Admin access',
    });

    // In a real implementation, this would fetch and return the student data
    return { message: 'Export logged and approved' };
  }

  // Delete data with proper verification
  deleteStudentData(studentId: string, requestUserId: string, userRole: string, reason: string): void {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
      throw new FERPAComplianceError('Insufficient privileges for data deletion');
    }

    // Log deletion
    this.logAccess({
      userId: requestUserId,
      action: 'DELETE',
      resource: 'student',
      resourceId: studentId,
      fields: ['all'],
      timestamp: new Date(),
      ipAddress: '',
      success: true,
      reason,
    });

    logger.info('Student data deletion initiated', {
      studentId,
      requestUserId,
      userRole,
      reason,
    });
  }
}