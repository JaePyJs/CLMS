import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '@/utils/logger';
import { injectable } from 'inversify';
import { prisma as sharedPrisma } from '@/utils/prisma';
import crypto from 'crypto';

export interface DataAccessResult {
  granted: boolean;
  maskedFields?: string[];
  reason?: string;
  expiresAt?: Date;
}

export interface ConsentRequirement {
  required: boolean;
  validConsent: boolean;
  consentType: string;
  guardianConsent?: boolean;
}

export interface DataAccessLog {
  studentId: string;
  userId: string;
  requestId?: string;
  accessType: string;
  dataCategory: string;
  accessLevel: string;
  accessGranted: boolean;
  recordsCount: number;
  accessPurpose?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  denialReason?: string;
  retentionExpiresAt?: Date;
}

@injectable()
export class FERPAComplianceService {
  private prisma: PrismaClient;
  private accessCache: Map<
    string,
    { result: DataAccessResult; expires: Date }
  > = new Map();

  constructor(prismaClient: PrismaClient = sharedPrisma) {
    this.prisma = prismaClient;
    this.startCacheCleanup();
  }

  /**
   * Check if user has FERPA-compliant access to student data
   */
  public async checkStudentDataAccess(
    studentId: string,
    userId: string,
    dataCategories: string[],
    accessLevel: string,
    context: {
      sessionId?: string;
      ipAddress?: string;
      userAgent?: string;
      requestId?: string;
    } = {},
  ): Promise<DataAccessResult> {
    try {
      const cacheKey = this.generateCacheKey(
        studentId,
        userId,
        dataCategories,
        accessLevel,
      );

      // Check cache first
      const cached = this.accessCache.get(cacheKey);
      if (cached && cached.expires > new Date()) {
        return cached.result;
      }

      // Get user and student information
      const user = await this.prisma.users.findUnique({
        where: { id: userId },
        select: { role: true, username: true },
      });

      if (!user) {
        return { granted: false, reason: 'User not found' };
      }

      const student = await this.prisma.students.findUnique({
        where: { id: studentId },
        select: { grade_category: true, is_active: true },
      });

      if (!student) {
        return { granted: false, reason: 'Student not found' };
      }

      // Check role-based access permissions
      const accessResult = await this.evaluateRoleBasedAccess(
        user.role,
        dataCategories,
        accessLevel,
        studentId,
        user.username,
      );

      // Cache the result for 5 minutes
      this.accessCache.set(cacheKey, {
        result: accessResult,
        expires: new Date(Date.now() + 5 * 60 * 1000),
      });

      // Log the access attempt
      const logEntry: DataAccessLog = {
        studentId,
        userId,
        accessType: accessLevel,
        dataCategory: dataCategories.join(','),
        accessLevel,
        accessGranted: accessResult.granted,
        recordsCount: 1,
      };

      if (context.requestId) {
        logEntry.requestId = context.requestId;
      }

      if (context.sessionId) {
        logEntry.sessionId = context.sessionId;
      }

      if (context.ipAddress) {
        logEntry.ipAddress = context.ipAddress;
      }

      if (context.userAgent) {
        logEntry.userAgent = context.userAgent;
      }

      if (!accessResult.granted && accessResult.reason) {
        logEntry.denialReason = accessResult.reason;
      }

      await this.logDataAccess(logEntry);

      return accessResult;
    } catch (error) {
      logger.error('FERPA compliance check failed', {
        error: (error as Error).message,
        studentId,
        userId,
        dataCategories,
      });

      return {
        granted: false,
        reason: 'System error during compliance check',
      };
    }
  }

  /**
   * Check consent requirements for student data access
   */
  public async checkConsentRequirements(
    studentId: string,
    consentType: string,
    userRole: string,
  ): Promise<ConsentRequirement> {
    try {
      // For most educational purposes, consent is implied for directory information
      if (
        consentType === 'PERSONAL_INFO' &&
        this.isDirectoryInfoAccess(userRole)
      ) {
        return {
          required: false,
          validConsent: true,
          consentType,
        };
      }

      // For sensitive information, check if consent is required
      const student = await this.prisma.students.findUnique({
        where: { id: studentId },
        select: { grade_category: true },
      });

      if (!student) {
        return {
          required: true,
          validConsent: false,
          consentType,
        };
      }

      // Minor students require guardian consent for sensitive data
      const requiresGuardianConsent = this.isMinorStudent(
        student.grade_category,
      );

      return {
        required: requiresGuardianConsent,
        validConsent: !requiresGuardianConsent, // Simplified - in real implementation, check consent records
        consentType,
        guardianConsent: !requiresGuardianConsent,
      };
    } catch (error) {
      logger.error('Consent check failed', {
        error: (error as Error).message,
        studentId,
        consentType,
      });

      return {
        required: true,
        validConsent: false,
        consentType,
      };
    }
  }

  /**
   * Apply data masking based on user role and sensitivity
   */
  public applyDataMasking<T>(
    data: T,
    _studentId: string,
    userRole: string,
    dataCategories: string[],
  ): T {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = this.getSensitiveFields(userRole, dataCategories);

    const maskValue = (rawValue: unknown, fieldType: string): unknown => {
      if (rawValue === null || rawValue === undefined) {
        return rawValue;
      }

      if (typeof rawValue !== 'string') {
        return fieldType === 'financial' ? '[CONFIDENTIAL]' : '[MASKED]';
      }

      const value = rawValue;

      switch (fieldType) {
        case 'email': {
          const [username, domain] = value.split('@');

          if (!username || !domain) {
            return '[MASKED]';
          }

          if (username.length <= 2) {
            return `${username.charAt(0)}*@${domain}`;
          }

          const mask = '*'.repeat(Math.max(0, username.length - 2));
          return `${username.charAt(0)}${mask}${username.charAt(username.length - 1)}@${domain}`;
        }

        case 'phone':
          return value.length >= 7
            ? value.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
            : '****';

        case 'name':
          return value.length > 2
            ? `${value.charAt(0)}${'*'.repeat(value.length - 2)}${value.charAt(value.length - 1)}`
            : '***';

        case 'address':
          return '[RESTRICTED]';

        case 'financial':
          return '[CONFIDENTIAL]';

        default:
          return '[MASKED]';
      }
    };

    const applyMasking = (obj: unknown): unknown => {
      if (Array.isArray(obj)) {
        return obj.map(item => applyMasking(item));
      }

      if (obj && typeof obj === 'object') {
        const result: Record<string, unknown> = {
          ...(obj as Record<string, unknown>),
        };

        for (const [key, value] of Object.entries(result)) {
          const fieldPath = key.toLowerCase();
          const matchingField = sensitiveFields.find(sensitive =>
            fieldPath.includes(sensitive.toLowerCase()),
          );

          if (matchingField) {
            result[key] = maskValue(value, matchingField);
            continue;
          }

          if (value && typeof value === 'object') {
            result[key] = applyMasking(value);
          }
        }

        return result;
      }

      return obj;
    };

    const clonedData: unknown = Array.isArray(data)
      ? [...(data as unknown[])]
      : { ...(data as Record<string, unknown>) };

    return applyMasking(clonedData) as T;
  }

  /**
   * Log data access for audit purposes
   */
  public async logDataAccess(logEntry: DataAccessLog): Promise<void> {
    try {
      const newValues: Prisma.JsonObject = {
        dataCategory: logEntry.dataCategory,
        accessLevel: logEntry.accessLevel,
        accessGranted: logEntry.accessGranted,
        recordsCount: logEntry.recordsCount,
      };

      if (logEntry.accessPurpose) {
        newValues.accessPurpose = logEntry.accessPurpose;
      }

      if (logEntry.requestId) {
        newValues.requestId = logEntry.requestId;
      }

      if (logEntry.sessionId) {
        newValues.sessionId = logEntry.sessionId;
      }

      if (logEntry.denialReason) {
        newValues.denialReason = logEntry.denialReason;
      }

      if (logEntry.retentionExpiresAt) {
        newValues.retentionExpiresAt =
          logEntry.retentionExpiresAt.toISOString();
      }

      await this.prisma.audit_logs.create({
        data: {
          id: this.generateAuditId(),
          entity: 'student_data_access',
          action: logEntry.accessType,
          entity_id: logEntry.studentId,
          performed_by: logEntry.userId,
          ip_address: logEntry.ipAddress ?? 'unknown',
          user_agent: logEntry.userAgent ?? 'unknown',
          new_values: newValues,
        },
      });

      logger.info('FERPA data access logged', {
        studentId: logEntry.studentId,
        userId: logEntry.userId,
        accessType: logEntry.accessType,
        accessGranted: logEntry.accessGranted,
      });
    } catch (error) {
      logger.error('Failed to log FERPA data access', {
        error: (error as Error).message,
        logEntry,
      });
    }
  }

  /**
   * Evaluate role-based access permissions
   */
  private async evaluateRoleBasedAccess(
    userRole: string,
    dataCategories: string[],
    accessLevel: string,
    studentId: string,
    username: string,
  ): Promise<DataAccessResult> {
    // Self-access rule
    if (username === studentId && accessLevel === 'READ_ONLY') {
      return { granted: true, maskedFields: [] };
    }

    // Role-based permissions
    const rolePermissions = this.getRolePermissions(userRole);
    const requiredLevel = this.getRequiredAccessLevel(
      dataCategories,
      accessLevel,
    );

    if (rolePermissions.includes(requiredLevel)) {
      return {
        granted: true,
        maskedFields: this.getMaskedFields(userRole, dataCategories),
      };
    }

    return {
      granted: false,
      reason: `Insufficient privileges. Required: ${requiredLevel}, User role: ${userRole}`,
    };
  }

  /**
   * Get permissions for each role
   */
  private getRolePermissions(userRole: string): string[] {
    const permissions: Record<string, string[]> = {
      SUPER_ADMIN: [
        'PUBLIC',
        'LIMITED',
        'SENSITIVE',
        'RESTRICTED',
        'CONFIDENTIAL',
      ],
      ADMIN: ['PUBLIC', 'LIMITED', 'SENSITIVE', 'RESTRICTED'],
      LIBRARIAN: ['PUBLIC', 'LIMITED', 'SENSITIVE'],
      ASSISTANT: ['PUBLIC', 'LIMITED'],
      TEACHER: ['PUBLIC', 'LIMITED'],
      VIEWER: ['PUBLIC'],
    };

    return permissions[userRole] || ['PUBLIC'];
  }

  /**
   * Get required access level based on data categories and access type
   */
  private getRequiredAccessLevel(
    dataCategories: string[],
    accessLevel: string,
  ): string {
    // If any sensitive categories are requested, require higher access
    const sensitiveCategories = [
      'PERSONAL',
      'MEDICAL',
      'FINANCIAL',
      'DISCIPLINARY',
    ];
    const hasSensitiveData = dataCategories.some(cat =>
      sensitiveCategories.some(sensitive => cat.includes(sensitive)),
    );

    if (hasSensitiveData) {
      return accessLevel === 'WRITE' ? 'CONFIDENTIAL' : 'RESTRICTED';
    }

    if (accessLevel === 'WRITE') {
      return 'SENSITIVE';
    }

    return 'LIMITED';
  }

  /**
   * Get fields that should be masked based on user role
   */
  private getMaskedFields(
    userRole: string,
    dataCategories: string[],
  ): string[] {
    const allFields: string[] = [];

    if (dataCategories.includes('PERSONAL')) {
      allFields.push(
        'email',
        'phone',
        'address',
        'parentName',
        'parentPhone',
        'parentEmail',
      );
    }

    if (dataCategories.includes('FINANCIAL')) {
      allFields.push('fineBalance');
    }

    if (dataCategories.includes('DISCIPLINARY')) {
      allFields.push('equipmentBan', 'equipmentBanReason');
    }

    // Role-based field visibility
    const userPermissions = this.getRolePermissions(userRole);
    const maxAllowedLevel = userPermissions[userPermissions.length - 1];

    if (maxAllowedLevel === 'PUBLIC') {
      return allFields; // Mask all sensitive fields
    }

    if (maxAllowedLevel === 'LIMITED') {
      return allFields.filter(field =>
        ['email', 'phone', 'address'].includes(field),
      );
    }

    return []; // No masking for higher-level roles
  }

  /**
   * Get sensitive fields that require masking
   */
  private getSensitiveFields(
    userRole: string,
    dataCategories: string[],
  ): string[] {
    const fields: string[] = [];

    if (dataCategories.includes('PERSONAL')) {
      fields.push('email', 'phone', 'name', 'address');
    }

    if (dataCategories.includes('FINANCIAL')) {
      fields.push('financial');
    }

    if (dataCategories.includes('ACADEMIC')) {
      fields.push('address'); // Home address is sensitive
    }

    return fields;
  }

  /**
   * Check if access is for directory information only
   */
  private isDirectoryInfoAccess(userRole: string): boolean {
    return ['VIEWER', 'TEACHER'].includes(userRole);
  }

  /**
   * Check if student is a minor requiring guardian consent
   */
  private isMinorStudent(gradeCategory: string): boolean {
    return ['PRIMARY', 'GRADE_SCHOOL', 'JUNIOR_HIGH'].includes(gradeCategory);
  }

  /**
   * Generate cache key for access checks
   */
  private generateCacheKey(
    studentId: string,
    userId: string,
    dataCategories: string[],
    accessLevel: string,
  ): string {
    return `ferpa_${studentId}_${userId}_${dataCategories.join('_')}_${accessLevel}`;
  }

  /**
   * Generate unique audit ID
   */
  private generateAuditId(): string {
    return `ferpa_audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Start periodic cleanup of expired cache entries
   */
  private startCacheCleanup(): void {
    setInterval(
      () => {
        const now = new Date();
        for (const [key, value] of this.accessCache.entries()) {
          if (value.expires < now) {
            this.accessCache.delete(key);
          }
        }
      },
      10 * 60 * 1000,
    ); // Clean up every 10 minutes
  }
}

// Export singleton instance
export const ferpaComplianceService = new FERPAComplianceService();
