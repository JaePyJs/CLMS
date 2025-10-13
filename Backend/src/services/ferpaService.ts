import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '@/utils/logger';
import { encryptData, decryptData } from '@/utils/encryption';
import { generateUUID } from '@/utils/helpers';

// Initialize Prisma Client
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'info', 'warn'] : ['error'],
});

// FERPA compliance interfaces
export interface FerpaAccessRequest {
  studentId: string;
  userId: string;
  dataCategories: string[];
  accessLevel: string;
  purpose: string;
  urgencyLevel?: string;
}

export interface FerpaAccessResult {
  granted: boolean;
  reason?: string;
  conditions?: any[];
  expiresAt?: Date;
  maskedFields?: string[];
  redactedData?: any;
}

export interface ConsentRequirement {
  required: boolean;
  consentType: string;
  validConsent?: boolean;
  expiresAt?: Date;
  guardianConsent?: boolean;
}

export interface FieldAccessControl {
  fieldName: string;
  accessLevel: string;
  encryptionRequired: boolean;
  maskingEnabled: boolean;
  minUserRole?: string;
  consentRequired: boolean;
  retentionDays?: number;
  auditLevel: string;
}

export interface FerpaViolationReport {
  studentId?: string;
  userId: string;
  violationType: string;
  severityLevel: string;
  description: string;
  incidentDate: Date;
  reportedBy: string;
  impactAssessment?: any;
  preventiveMeasures?: any;
}

/**
 * Comprehensive FERPA Compliance Service
 *
 * This service provides centralized FERPA compliance functionality including:
 * - Access control enforcement
 * - Consent management
 * - Data privacy enforcement
 * - Audit logging
 * - Violation detection and reporting
 * - Data retention management
 */
export class FerpaComplianceService {
  private instance: FerpaComplianceService;

  constructor() {
    this.instance = this;
  }

  /**
   * Check if user has access to specific student data
   */
  async checkStudentDataAccess(
    studentId: string,
    userId: string,
    dataCategories: string[],
    accessLevel: string = 'READ_ONLY',
    context?: {
      sessionId?: string;
      ipAddress?: string;
      userAgent?: string;
      requestId?: string;
    }
  ): Promise<FerpaAccessResult> {
    try {
      // Get user information
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { id: true, role: true, username: true, is_active: true }
      });

      if (!user || !user.is_active) {
        await this.logDataAccess({
          studentId,
          userId,
          accessType: 'VIEW',
          dataCategory: 'PERSONAL',
          accessLevel,
          accessGranted: false,
          denialReason: 'User not found or inactive',
          sessionId: context?.sessionId,
          ipAddress: context?.ipAddress,
          userAgent: context?.user_agent,
          requestId: context?.requestId
        });

        return { granted: false, reason: 'User not found or inactive' };
      }

      // Get student privacy settings
      const privacySettings = await this.getStudentPrivacySettings(studentId);
      if (!privacySettings) {
        return { granted: false, reason: 'Student privacy settings not found' };
      }

      // Check consent requirements for each data category
      for (const category of dataCategories) {
        const consentCheck = await this.checkConsentRequirements(studentId, category, user.role);
        if (!consentCheck.validConsent) {
          await this.logDataAccess({
            studentId,
            userId,
            accessType: 'VIEW',
            dataCategory: category,
            accessLevel,
            accessGranted: false,
            denialReason: `Missing required consent: ${consentCheck.consentType}`,
            sessionId: context?.sessionId,
            ipAddress: context?.ipAddress,
            userAgent: context?.user_agent,
            requestId: context?.requestId
          });

          return {
            granted: false,
            reason: `Missing required consent: ${consentCheck.consentType}`
          };
        }
      }

      // Check role-based access
      const roleCheck = await this.checkRoleBasedAccess(user.role, accessLevel, dataCategories);
      if (!roleCheck.granted) {
        await this.logDataAccess({
          studentId,
          userId,
          accessType: 'VIEW',
          dataCategory: dataCategories.join(','),
          accessLevel,
          accessGranted: false,
          denialReason: roleCheck.reason,
          sessionId: context?.sessionId,
          ipAddress: context?.ipAddress,
          userAgent: context?.user_agent,
          requestId: context?.requestId
        });

        return roleCheck;
      }

      // Get fields that require masking/redaction
      const maskedFields = await this.getMaskedFields(studentId, user.role, dataCategories);

      // Calculate access expiration based on retention policies
      const expiresAt = await this.calculateAccessExpiration(studentId, dataCategories);

      // Log successful access
      await this.logDataAccess({
        studentId,
        userId,
        requestId: context?.requestId,
        accessType: 'VIEW',
        dataCategory: dataCategories.join(','),
        accessLevel,
        accessGranted: true,
        fieldsAccessed: maskedFields,
        retentionExpiresAt: expiresAt,
        sessionId: context?.sessionId,
        ipAddress: context?.ipAddress,
        userAgent: context?.user_agent
      });

      return {
        granted: true,
        conditions: roleCheck.conditions,
        expiresAt,
        maskedFields
      };

    } catch (error) {
      logger.error('Error checking student data access', {
        error: (error as Error).message,
        studentId,
        userId,
        dataCategories
      });

      // Log failed access check
      await this.logDataAccess({
        studentId,
        userId,
        requestId: context?.requestId,
        accessType: 'VIEW',
        dataCategory: dataCategories.join(','),
        accessLevel,
        accessGranted: false,
        denialReason: 'System error during access check',
        sessionId: context?.sessionId,
        ipAddress: context?.ipAddress,
        userAgent: context?.user_agent
      });

      return { granted: false, reason: 'System error during access check' };
    }
  }

  /**
   * Apply data masking/redaction based on privacy settings and user role
   */
  async applyDataMasking(
    data: any,
    studentId: string,
    userRole: string,
    dataCategories: string[]
  ): Promise<any> {
    try {
      const maskedData = { ...data };
      const privacySettings = await this.getStudentPrivacySettings(studentId);

      if (!privacySettings) {
        return data; // No privacy settings, return original data
      }

      // Get field access controls for the requested categories
      const fieldControls = await prisma.field_access_controls.findMany({
        where: {
          field_category: { in: dataCategories }
        }
      });

      for (const control of fieldControls) {
        const fieldName = control.field_name;
        if (fieldName in maskedData) {
          // Check if masking is enabled and user doesn't have sufficient role
          if (control.masking_enabled && !this.hasSufficientRole(userRole, control.min_user_role)) {
            maskedData[fieldName] = this.maskFieldValue(maskedData[fieldName], control.access_level);
          }

          // Check if encryption is required
          if (control.encryption_required && typeof maskedData[fieldName] === 'string') {
            try {
              maskedData[fieldName] = decryptData(maskedData[fieldName]);
            } catch (decryptError) {
              logger.warn('Failed to decrypt field', {
                field: fieldName,
                studentId,
                error: (decryptError as Error).message
              });
              maskedData[fieldName] = '[ENCRYPTED]';
            }
          }
        }
      }

      return maskedData;

    } catch (error) {
      logger.error('Error applying data masking', {
        error: (error as Error).message,
        studentId,
        userRole,
        dataCategories
      });
      return data; // Return original data on error
    }
  }

  /**
   * Create a formal data access request
   */
  async createDataAccessRequest(request: FerpaAccessRequest): Promise<string> {
    try {
      const requestId = generateUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // Default 30-day expiry

      const dataAccessRequest = await prisma.data_access_requests.create({
        data: {
          id: requestId,
          student_id: request.studentId,
          requester_id: request.userId,
          requester_email: '', // Will be filled from user record
          request_purpose: request.purpose,
          data_categories: request.dataCategories,
          access_level: request.accessLevel,
          urgency_level: request.urgencyLevel || 'NORMAL',
          status: 'PENDING',
          expires_at: expiresAt,
          created_at: new Date(),
          updated_at: new Date()
        }
      });

      logger.info('Data access request created', {
        requestId: dataAccessRequest.id,
        studentId: request.studentId,
        userId: request.userId,
        accessLevel: request.accessLevel
      });

      return dataAccessRequest.id;

    } catch (error) {
      logger.error('Error creating data access request', {
        error: (error as Error).message,
        request
      });
      throw error;
    }
  }

  /**
   * Check consent requirements for a specific data category
   */
  async checkConsentRequirements(
    studentId: string,
    dataCategory: string,
    userRole: string
  ): Promise<ConsentRequirement> {
    try {
      const privacySettings = await this.getStudentPrivacySettings(studentId);
      if (!privacySettings) {
        return { required: false, consentType: 'NONE' };
      }

      // Map data categories to consent requirements
      const consentMappings: Record<string, { required: boolean; type: string; guardian?: boolean }> = {
        'PERSONAL': { required: true, type: 'PERSONAL_INFO' },
        'ACADEMIC': { required: true, type: 'ACADEMIC_RECORD' },
        'PHOTO_MEDIA': { required: true, type: 'PHOTO_MEDIA' },
        'MEDICAL': { required: true, type: 'MEDICAL', guardian: true },
        'FINANCIAL': { required: true, type: 'DATA_SHARING' },
        'CONTACT': { required: true, type: 'PERSONAL_INFO' }
      };

      const mapping = consentMappings[dataCategory];
      if (!mapping) {
        return { required: false, consentType: 'NONE' };
      }

      // Check if consent exists and is valid
      const existingConsent = await prisma.student_consents.findFirst({
        where: {
          student_id: studentId,
          consent_types: {
            category: mapping.type
          },
          consent_value: true,
          OR: [
            { expires_at: null },
            { expires_at: { gt: new Date() } }
          ]
        },
        include: {
          consent_types: true
        }
      });

      return {
        required: mapping.required,
        consentType: mapping.type,
        validConsent: !!existingConsent,
        expiresAt: existingConsent?.expires_at,
        guardianConsent: mapping.guardian || false
      };

    } catch (error) {
      logger.error('Error checking consent requirements', {
        error: (error as Error).message,
        studentId,
        dataCategory,
        userRole
      });

      return {
        required: true,
        consentType: 'ERROR',
        validConsent: false
      };
    }
  }

  /**
   * Log data access for FERPA compliance
   */
  async logDataAccess(logData: {
    studentId: string;
    userId: string;
    requestId?: string;
    accessType: string;
    dataCategory: string;
    accessLevel: string;
    accessGranted: boolean;
    fieldsAccessed?: any;
    recordsCount?: number;
    accessPurpose?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    denialReason?: string;
    retentionExpiresAt?: Date;
  }): Promise<void> {
    try {
      await prisma.data_access_logs.create({
        data: {
          id: generateUUID(),
          student_id: logData.studentId,
          user_id: logData.userId,
          request_id: logData.requestId,
          access_type: logData.accessType,
          data_category: logData.dataCategory,
          access_level: logData.accessLevel,
          fields_accessed: logData.fieldsAccessed,
          records_count: logData.recordsCount || 1,
          access_purpose: logData.accessPurpose,
          session_id: logData.sessionId,
          ip_address: logData.ipAddress,
          user_agent: logData.userAgent,
          access_granted: logData.accessGranted,
          denial_reason: logData.denialReason,
          retention_expires_at: logData.retentionExpiresAt,
          created_at: new Date()
        }
      });

    } catch (error) {
      logger.error('Error logging data access', {
        error: (error as Error).message,
        logData
      });
      // Don't throw error for logging failures
    }
  }

  /**
   * Report a FERPA violation
   */
  async reportViolation(violation: FerpaViolationReport): Promise<string> {
    try {
      const violationId = generateUUID();

      await prisma.ferpa_violations.create({
        data: {
          id: violationId,
          violation_type: violation.violationType,
          severity_level: violation.severityLevel,
          student_id: violation.studentId,
          user_id: violation.userId,
          description: violation.description,
          incident_date: violation.incidentDate,
          reported_by: violation.reportedBy,
          impact_assessment: violation.impactAssessment,
          preventive_measures: violation.preventiveMeasures,
          created_at: new Date(),
          updated_at: new Date()
        }
      });

      logger.warn('FERPA violation reported', {
        violationId,
        violationType: violation.violationType,
        severityLevel: violation.severityLevel,
        studentId: violation.studentId,
        userId: violation.userId
      });

      return violationId;

    } catch (error) {
      logger.error('Error reporting FERPA violation', {
        error: (error as Error).message,
        violation
      });
      throw error;
    }
  }

  /**
   * Get student privacy settings
   */
  private async getStudentPrivacySettings(studentId: string): Promise<any> {
    try {
      return await prisma.student_privacy_settings.findUnique({
        where: { student_id: studentId },
        include: {
          student_consents: {
            include: {
              consent_types: true
            }
          }
        }
      });
    } catch (error) {
      logger.error('Error getting student privacy settings', {
        error: (error as Error).message,
        studentId
      });
      return null;
    }
  }

  /**
   * Check role-based access permissions
   */
  private async checkRoleBasedAccess(
    userRole: string,
    accessLevel: string,
    dataCategories: string[]
  ): Promise<FerpaAccessResult> {
    // Role hierarchy: SUPER_ADMIN > ADMIN > LIBRARIAN > ASSISTANT > TEACHER > VIEWER

    const roleHierarchy: Record<string, number> = {
      'SUPER_ADMIN': 6,
      'ADMIN': 5,
      'LIBRARIAN': 4,
      'ASSISTANT': 3,
      'TEACHER': 2,
      'VIEWER': 1
    };

    const accessLevelHierarchy: Record<string, number> = {
      'READ_ONLY': 1,
      'SUMMARY': 2,
      'DETAILED': 3,
      'ANALYTICAL': 4
    };

    const userRoleLevel = roleHierarchy[userRole] || 0;
    const requiredAccessLevel = accessLevelHierarchy[accessLevel] || 0;

    // Check if user has sufficient role for requested access level
    if (userRoleLevel < requiredAccessLevel) {
      return {
        granted: false,
        reason: `Insufficient role privileges. Required: ${accessLevel}, User role: ${userRole}`
      };
    }

    // Additional checks for sensitive data categories
    if (dataCategories.includes('MEDICAL') && userRoleLevel < 5) {
      return {
        granted: false,
        reason: 'Medical data access requires ADMIN or SUPER_ADMIN role'
      };
    }

    if (dataCategories.includes('FINANCIAL') && userRoleLevel < 4) {
      return {
        granted: false,
        reason: 'Financial data access requires LIBRARIAN, ADMIN, or SUPER_ADMIN role'
      };
    }

    return {
      granted: true,
      conditions: userRoleLevel < 4 ? ['Limited access, supervisor notification required'] : undefined
    };
  }

  /**
   * Get fields that require masking based on privacy settings
   */
  private async getMaskedFields(
    studentId: string,
    userRole: string,
    dataCategories: string[]
  ): Promise<string[]> {
    try {
      const fieldControls = await prisma.field_access_controls.findMany({
        where: {
          field_category: { in: dataCategories },
          masking_enabled: true
        }
      });

      return fieldControls
        .filter(control => !this.hasSufficientRole(userRole, control.min_user_role))
        .map(control => control.field_name);

    } catch (error) {
      logger.error('Error getting masked fields', {
        error: (error as Error).message,
        studentId,
        userRole,
        dataCategories
      });
      return [];
    }
  }

  /**
   * Calculate access expiration based on retention policies
   */
  private async calculateAccessExpiration(
    studentId: string,
    dataCategories: string[]
  ): Promise<Date> {
    try {
      // Get retention policies for the requested data categories
      const policies = await prisma.data_retention_policies.findMany({
        where: {
          data_category: { in: dataCategories },
          is_active: true
        }
      });

      if (policies.length === 0) {
        // Default retention period of 1 year
        const defaultExpiry = new Date();
        defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 1);
        return defaultExpiry;
      }

      // Use the shortest retention period among applicable policies
      const minRetentionDays = Math.min(...policies.map(p => p.retention_days));
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + minRetentionDays);

      return expiresAt;

    } catch (error) {
      logger.error('Error calculating access expiration', {
        error: (error as Error).message,
        studentId,
        dataCategories
      });

      // Default to 1 year if calculation fails
      const defaultExpiry = new Date();
      defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 1);
      return defaultExpiry;
    }
  }

  /**
   * Check if user has sufficient role for field access
   */
  private hasSufficientRole(userRole: string, minUserRole?: string): boolean {
    if (!minUserRole) return true;

    const roleHierarchy: Record<string, number> = {
      'SUPER_ADMIN': 6,
      'ADMIN': 5,
      'LIBRARIAN': 4,
      'ASSISTANT': 3,
      'TEACHER': 2,
      'VIEWER': 1
    };

    const userRoleLevel = roleHierarchy[userRole] || 0;
    const requiredRoleLevel = roleHierarchy[minUserRole] || 0;

    return userRoleLevel >= requiredRoleLevel;
  }

  /**
   * Mask field value based on access level
   */
  private maskFieldValue(value: any, accessLevel: string): string {
    if (value === null || value === undefined) return value;

    const stringValue = String(value);

    switch (accessLevel) {
      case 'PUBLIC':
        return '[HIDDEN]';
      case 'INTERNAL':
        return stringValue.length > 4 ?
          stringValue.substring(0, 2) + '*'.repeat(stringValue.length - 2) :
          '*'.repeat(stringValue.length);
      case 'RESTRICTED':
        return stringValue.length > 8 ?
          stringValue.substring(0, 4) + '*'.repeat(stringValue.length - 4) :
          '*'.repeat(stringValue.length);
      case 'CONFIDENTIAL':
        return stringValue.substring(0, 1) + '*'.repeat(stringValue.length - 1);
      default:
        return '[RESTRICTED]';
    }
  }

  /**
   * Initialize default FERPA compliance settings
   */
  async initializeDefaultSettings(): Promise<void> {
    try {
      // Create default consent types
      const defaultConsentTypes = [
        {
          id: generateUUID(),
          name: 'Personal Information Consent',
          description: 'Consent for collection and use of personal information',
          category: 'PERSONAL_INFO',
          is_required: true,
          min_age: 13,
          expiration_days: 365
        },
        {
          id: generateUUID(),
          name: 'Academic Records Access',
          description: 'Consent for access to academic records and performance data',
          category: 'ACADEMIC_RECORD',
          is_required: true,
          min_age: 13,
          expiration_days: 365
        },
        {
          id: generateUUID(),
          name: 'Photo and Media Consent',
          description: 'Consent for taking and using photos/videos of students',
          category: 'PHOTO_MEDIA',
          is_required: false,
          min_age: 13,
          expiration_days: 365
        },
        {
          id: generateUUID(),
          name: 'Data Sharing Consent',
          description: 'Consent for sharing data with educational partners',
          category: 'DATA_SHARING',
          is_required: true,
          min_age: 18,
          expiration_days: 180
        }
      ];

      for (const consentType of defaultConsentTypes) {
        await prisma.consent_types.upsert({
          where: { name: consentType.name },
          update: consentType,
          create: consentType
        });
      }

      // Create default field access controls
      const defaultFieldControls = [
        {
          id: generateUUID(),
          field_name: 'first_name',
          field_category: 'PERSONAL',
          access_level: 'INTERNAL',
          encryption_required: false,
          masking_enabled: true,
          min_user_role: 'TEACHER',
          consent_required: true,
          retention_days: 1825, // 5 years
          audit_level: 'STANDARD',
          description: 'Student first name'
        },
        {
          id: generateUUID(),
          field_name: 'last_name',
          field_category: 'PERSONAL',
          access_level: 'INTERNAL',
          encryption_required: false,
          masking_enabled: true,
          min_user_role: 'TEACHER',
          consent_required: true,
          retention_days: 1825,
          audit_level: 'STANDARD',
          description: 'Student last name'
        },
        {
          id: generateUUID(),
          field_name: 'grade_level',
          field_category: 'ACADEMIC',
          access_level: 'INTERNAL',
          encryption_required: false,
          masking_enabled: false,
          min_user_role: 'TEACHER',
          consent_required: true,
          retention_days: 1825,
          audit_level: 'DETAILED',
          description: 'Student grade level'
        },
        {
          id: generateUUID(),
          field_name: 'student_id',
          field_category: 'PERSONAL',
          access_level: 'ENCRYPTED',
          encryption_required: true,
          masking_enabled: true,
          min_user_role: 'LIBRARIAN',
          consent_required: true,
          retention_days: 1825,
          audit_level: 'COMPREHENSIVE',
          description: 'Official school student ID'
        }
      ];

      for (const fieldControl of defaultFieldControls) {
        await prisma.field_access_controls.upsert({
          where: { field_name: fieldControl.field_name },
          update: fieldControl,
          create: fieldControl
        });
      }

      // Create default data retention policies
      const defaultRetentionPolicies = [
        {
          id: generateUUID(),
          name: 'Student Personal Information',
          description: 'Retention policy for student personal information',
          data_category: 'PERSONAL',
          retention_days: 1825, // 5 years after student leaves
          archival_action: 'ANONYMIZE',
          notification_days: 90
        },
        {
          id: generateUUID(),
          name: 'Academic Records',
          description: 'Retention policy for academic records',
          data_category: 'ACADEMIC',
          retention_days: 3650, // 10 years
          archival_action: 'ARCHIVE',
          notification_days: 180
        },
        {
          id: generateUUID(),
          name: 'Activity Logs',
          description: 'Retention policy for student activity logs',
          data_category: 'ACTIVITY',
          retention_days: 1095, // 3 years
          archival_action: 'DELETE',
          notification_days: 30
        }
      ];

      for (const policy of defaultRetentionPolicies) {
        await prisma.data_retention_policies.upsert({
          where: { name: policy.name },
          update: policy,
          create: policy
        });
      }

      logger.info('FERPA compliance default settings initialized successfully');

    } catch (error) {
      logger.error('Error initializing FERPA compliance settings', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Generate FERPA compliance report
   */
  async generateComplianceReport(
    startDate: Date,
    endDate: Date,
    reportType: 'ACCESS_LOG' | 'VIOLATIONS' | 'CONSENT_STATUS' | 'RETENTION' = 'ACCESS_LOG'
  ): Promise<any> {
    try {
      switch (reportType) {
        case 'ACCESS_LOG':
          return await this.generateAccessLogReport(startDate, endDate);
        case 'VIOLATIONS':
          return await this.generateViolationsReport(startDate, endDate);
        case 'CONSENT_STATUS':
          return await this.generateConsentStatusReport();
        case 'RETENTION':
          return await this.generateRetentionReport();
        default:
          throw new Error(`Unknown report type: ${reportType}`);
      }
    } catch (error) {
      logger.error('Error generating compliance report', {
        error: (error as Error).message,
        reportType,
        startDate,
        endDate
      });
      throw error;
    }
  }

  private async generateAccessLogReport(startDate: Date, endDate: Date): Promise<any> {
    const accessLogs = await prisma.data_access_logs.findMany({
      where: {
        created_at: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        data_access_requests: true
      },
      orderBy: { created_at: 'desc' }
    });

    const summary = {
      totalRequests: accessLogs.length,
      grantedAccess: accessLogs.filter(log => log.access_granted).length,
      deniedAccess: accessLogs.filter(log => !log.access_granted).length,
      byAccessLevel: {} as Record<string, number>,
      byDataCategory: {} as Record<string, number>,
      byUserRole: {} as Record<string, number>,
      violationsDetected: accessLogs.filter(log => !log.access_granted).length
    };

    // Aggregate data
    accessLogs.forEach(log => {
      summary.byAccessLevel[log.access_level] = (summary.byAccessLevel[log.access_level] || 0) + 1;
      summary.byDataCategory[log.data_category] = (summary.byDataCategory[log.data_category] || 0) + 1;
      // Note: user role would need to be joined from users table
    });

    return {
      reportType: 'ACCESS_LOG',
      period: { startDate, endDate },
      summary,
      details: accessLogs
    };
  }

  private async generateViolationsReport(startDate: Date, endDate: Date): Promise<any> {
    const violations = await prisma.ferpa_violations.findMany({
      where: {
        incident_date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { incident_date: 'desc' }
    });

    const summary = {
      totalViolations: violations.length,
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      resolvedCount: violations.filter(v => v.resolved_at).length,
      pendingResolution: violations.filter(v => !v.resolved_at).length
    };

    violations.forEach(violation => {
      summary.byType[violation.violation_type] = (summary.byType[violation.violation_type] || 0) + 1;
      summary.bySeverity[violation.severity_level] = (summary.bySeverity[violation.severity_level] || 0) + 1;
    });

    return {
      reportType: 'VIOLATIONS',
      period: { startDate, endDate },
      summary,
      details: violations
    };
  }

  private async generateConsentStatusReport(): Promise<any> {
    const consentStatus = await prisma.student_consents.findMany({
      include: {
        consent_types: true,
        students: {
          select: {
            student_id: true,
            first_name: true,
            last_name: true,
            grade_level: true
          }
        }
      }
    });

    const summary = {
      totalConsents: consentStatus.length,
      activeConsents: consentStatus.filter(c => c.consent_value && (!c.expires_at || c.expires_at > new Date())).length,
      expiredConsents: consentStatus.filter(c => c.expires_at && c.expires_at <= new Date()).length,
      revokedConsents: consentStatus.filter(c => !c.consent_value).length,
      byType: {} as Record<string, number>
    };

    consentStatus.forEach(consent => {
      summary.byType[consent.consent_types.name] = (summary.byType[consent.consent_types.name] || 0) + 1;
    });

    return {
      reportType: 'CONSENT_STATUS',
      summary,
      details: consentStatus
    };
  }

  private async generateRetentionReport(): Promise<any> {
    const policies = await prisma.data_retention_policies.findMany({
      where: { is_active: true },
      include: {
        retention_schedules: true
      }
    });

    const schedules = await prisma.retention_schedules.findMany({
      include: {
        data_retention_policies: true
      },
      orderBy: { next_run_at: 'asc' }
    });

    return {
      reportType: 'RETENTION',
      policies,
      schedules,
      summary: {
        activePolicies: policies.length,
        scheduledRuns: schedules.length,
        nextScheduledRun: schedules[0]?.next_run_at
      }
    };
  }
}

// Export singleton instance
export const ferpaComplianceService = new FerpaComplianceService();
export default ferpaComplianceService;