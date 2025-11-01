import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { fieldEncryption } from '../utils/fieldEncryption';
import { SecurityMonitoringService, SecurityEventType, AlertSeverity } from '../services/securityMonitoringService';
import { generateAuditId } from '../utils/common';

// Audit log entry interface
interface DataAccessAuditEntry {
  id: string;
  timestamp: Date;
  userId: string;
  userRole: string;
  sessionId?: string;
  requestId?: string;
  endpoint: string;
  method: string;
  ipAddress: string;
  userAgent?: string;
  entityType: string;
  entityId?: string;
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'SEARCH';
  fieldsAccessed: string[];
  sensitiveFieldsAccessed: string[];
  encryptedFieldsAccessed: string[];
  dataAccessLevel: 'PUBLIC' | 'LIMITED' | 'SENSITIVE' | 'RESTRICTED' | 'CONFIDENTIAL';
  recordsAffected: number;
  dataSize: number;
  responseStatus: number;
  success: boolean;
  errorType?: string;
  errorMessage?: string;
  duration: number;
  ferpaCompliance: {
    required: boolean;
    verified: boolean;
    justificationProvided: boolean;
  };
  securityFlags: {
    suspiciousActivity: boolean;
    unusualAccessPattern: boolean;
    dataExfiltrationRisk: boolean;
    privilegeEscalationAttempt: boolean;
    bruteForceIndicator: boolean;
  };
  metadata: {
    requestSize: number;
    responseSize: number;
    cacheHit: boolean;
    databaseQueryCount: number;
    apiRate: number;
  };
}

// Middleware configuration
interface AuditConfig {
  enabled: boolean;
  logLevel: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR';
  includeRequestBody: boolean;
  includeResponseBody: boolean;
  includeHeaders: boolean;
  maxBodySize: number;
  sampleRate: number; // 0-1, percentage of requests to audit
  excludePaths: string[];
  excludeUsers: string[];
  retentionDays: number;
}

// Default configuration
const DEFAULT_CONFIG: AuditConfig = {
  enabled: true,
  logLevel: 'INFO',
  includeRequestBody: false,
  includeResponseBody: false,
  includeHeaders: true,
  maxBodySize: 1024, // 1KB
  sampleRate: 1.0, // 100% sampling
  excludePaths: [
    '/health',
    '/metrics',
    '/favicon.ico',
    '/static'
  ],
  excludeUsers: [],
  retentionDays: 90
};

/**
 * Data Access Audit Middleware Factory
 * Provides comprehensive audit logging for all data access
 */
export const createDataAccessAuditMiddleware = (
  prisma: PrismaClient,
  securityService: SecurityMonitoringService,
  config: Partial<AuditConfig> = {}
) => {
  const auditConfig = { ...DEFAULT_CONFIG, ...config };

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip audit if disabled
    if (!auditConfig.enabled) {
      return next();
    }

    // Skip audit for excluded paths
    if (auditConfig.excludePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Skip audit based on sample rate
    if (Math.random() > auditConfig.sampleRate) {
      return next();
    }

    const startTime = Date.now();
    const auditId = generateAuditId();
    const user = (req as any).user;

    // Skip audit for excluded users
    if (user && auditConfig.excludeUsers.includes(user.id)) {
      return next();
    }

    // Store request data for audit
    const auditData: Partial<DataAccessAuditEntry> = {
      id: auditId,
      timestamp: new Date(),
      userId: user?.id || 'anonymous',
      userRole: user?.role || 'ANONYMOUS',
      sessionId: (req as any).sessionId,
      requestId: (req as any).requestId,
      endpoint: req.path,
      method: req.method,
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      action: getActionFromMethod(req.method),
      fieldsAccessed: [],
      sensitiveFieldsAccessed: [],
      encryptedFieldsAccessed: [],
      recordsAffected: 0,
      dataSize: 0,
      responseStatus: 0,
      success: false,
      duration: 0,
      ferpaCompliance: {
        required: false,
        verified: false,
        justificationProvided: false
      },
      securityFlags: {
        suspiciousActivity: false,
        unusualAccessPattern: false,
        dataExfiltrationRisk: false,
        privilegeEscalationAttempt: false,
        bruteForceIndicator: false
      },
      metadata: {
        requestSize: JSON.stringify(req.body).length,
        responseSize: 0,
        cacheHit: false,
        databaseQueryCount: 0,
        apiRate: 0
      }
    };

    // Analyze request for security flags
    analyzeRequestForSecurity(req, auditData);

    // Intercept response
    const originalSend = res.send;
    const originalJson = res.json;

    res.send = function(body: any) {
      return handleResponse.call(this, body, 'send');
    };

    res.json = function(body: any) {
      return handleResponse.call(this, body, 'json');
    };

    const handleResponse = function(body: any, method: 'send' | 'json') {
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Complete audit data
      auditData.responseStatus = res.statusCode;
      auditData.duration = duration;
      auditData.success = res.statusCode < 400;
      if (auditData.metadata) {
        auditData.metadata.responseSize = JSON.stringify(body).length;
      }

      // Analyze response for sensitive data
      if (auditData.success && body) {
        analyzeResponseForDataAccess(body, req, auditData);
      }

      // Check for security violations
      checkSecurityViolations(auditData, securityService);

      // Store audit log
      storeAuditLog(auditData as DataAccessAuditEntry, prisma, auditConfig);

      // Call original method
      return originalSend.call(res, body);
    };

    next();
  };
};

/**
 * Analyze request for security indicators
 */
function analyzeRequestForSecurity(req: Request, auditData: Partial<DataAccessAuditEntry>): void {
  const user = (req as any).user;

  // Check for suspicious user agents
  const suspiciousAgents = [
    /bot/i,
    /crawler/i,
    /scanner/i,
    /sqlmap/i,
    /nikto/i,
    /nmap/i
  ];

  if (req.get('User-Agent') && suspiciousAgents.some(pattern => pattern.test(req.get('User-Agent')!))) {
    auditData.securityFlags!.suspiciousActivity = true;
  }

  // Check for unusual access patterns
  if (user) {
    const accessCount = getRecentAccessCount(user.id);
    if (accessCount > 100) { // More than 100 requests in last hour
      auditData.securityFlags!.unusualAccessPattern = true;
    }
  }

  // Check for potential data exfiltration
  if (req.method === 'GET' && req.query.export === 'true') {
    auditData.securityFlags!.dataExfiltrationRisk = true;
  }

  // Check for privilege escalation attempts
  if (req.body && req.body.role && user && user.role !== 'SUPER_ADMIN') {
    auditData.securityFlags!.privilegeEscalationAttempt = true;
  }

  // Check for brute force indicators
  const authFailures = getRecentAuthFailures(req.ip || 'unknown');
  if (authFailures > 10) {
    auditData.securityFlags!.bruteForceIndicator = true;
  }

  // Determine entity type from path
  auditData.entityType = getEntityTypeFromPath(req.path);
  const entityId = getEntityIdFromRequest(req);
  if (entityId) {
    auditData.entityId = entityId;
  }
}

/**
 * Analyze response for data access patterns
 */
function analyzeResponseForDataAccess(
  body: any,
  req: Request,
  auditData: Partial<DataAccessAuditEntry>
): void {
  try {
    let parsedData = body;

    // Parse response if it's a string
    if (typeof body === 'string') {
      try {
        parsedData = JSON.parse(body);
      } catch {
        // If parsing fails, analyze string content
        if (body.length > 1000) {
          auditData.securityFlags!.dataExfiltrationRisk = true;
        }
        return;
      }
    }

    // Analyze data structure
    const analysis = analyzeDataStructure(parsedData, req.path);
    auditData.fieldsAccessed = analysis.fields;
    auditData.sensitiveFieldsAccessed = analysis.sensitiveFields;
    auditData.encryptedFieldsAccessed = analysis.encryptedFields;
    auditData.recordsAffected = analysis.recordCount;
    auditData.dataSize = JSON.stringify(parsedData).length;

    // Determine data access level
    auditData.dataAccessLevel = determineDataAccessLevel(analysis.sensitiveFields);

    // Check FERPA compliance requirements
    auditData.ferpaCompliance!.required = analysis.sensitiveFields.length > 0;
    auditData.ferpaCompliance!.verified = !!(req as any).ferpaContext;
    // Note: accessRequestId is no longer part of the interface
    // auditData.ferpaCompliance!.accessRequestId = (req as any).ferpaContext?.accessRequestId;
    auditData.ferpaCompliance!.justificationProvided = !!(req as any).ferpaContext?.accessGranted;

  } catch (error) {
    logger.error('Failed to analyze response for audit', { error });
  }
}

/**
 * Analyze data structure for sensitive information
 */
function analyzeDataStructure(data: any, path: string): {
  fields: string[];
  sensitiveFields: string[];
  encryptedFields: string[];
  recordCount: number;
} {
  const fields: string[] = [];
  const sensitiveFields: string[] = [];
  const encryptedFields: string[] = [];
  let recordCount = 0;

  // Define sensitive field patterns
  const sensitivePatterns = [
    /name/i,
    /email/i,
    /phone/i,
    /address/i,
    /ssn/i,
    /social/i,
    /birth/i,
    /grade/i,
    /student/i,
    /parent/i,
    /medical/i,
    /health/i,
    /disciplinary/i,
    /financial/i,
    /fine/i,
    /balance/i
  ];

  // Recursively analyze data
  function analyze(obj: any, prefix: string = ''): void {
    if (Array.isArray(obj)) {
      recordCount = Math.max(recordCount, obj.length);
      obj.forEach((item, index) => {
        analyze(item, `${prefix}[${index}]`);
      });
    } else if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(key => {
        const fullFieldName = prefix ? `${prefix}.${key}` : key;
        fields.push(fullFieldName);

        // Check if field is sensitive
        if (sensitivePatterns.some(pattern => pattern.test(key))) {
          sensitiveFields.push(fullFieldName);
        }

        // Check if field is encrypted
        if (fieldEncryption.isEncrypted(obj[key])) {
          encryptedFields.push(fullFieldName);
        }

        // Recursively analyze nested objects
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          analyze(obj[key], fullFieldName);
        }
      });
    }
  }

  analyze(data);

  return {
    fields: Array.from(new Set(fields)),
    sensitiveFields: Array.from(new Set(sensitiveFields)),
    encryptedFields: Array.from(new Set(encryptedFields)),
    recordCount
  };
}

/**
 * Determine data access level based on fields accessed
 */
function determineDataAccessLevel(sensitiveFields: string[]): 'PUBLIC' | 'LIMITED' | 'SENSITIVE' | 'RESTRICTED' | 'CONFIDENTIAL' {
  if (sensitiveFields.length === 0) return 'PUBLIC';

  const hasHighlySensitive = sensitiveFields.some(field =>
    /ssn|social|medical|health|disciplinary/i.test(field)
  );
  if (hasHighlySensitive) return 'CONFIDENTIAL';

  const hasRestricted = sensitiveFields.some(field =>
    /financial|fine|balance|parent|birth/i.test(field)
  );
  if (hasRestricted) return 'RESTRICTED';

  const hasSensitive = sensitiveFields.some(field =>
    /email|phone|address|grade/i.test(field)
  );
  if (hasSensitive) return 'SENSITIVE';

  return 'LIMITED';
}

/**
 * Check for security violations and trigger alerts
 */
function checkSecurityViolations(
  auditData: Partial<DataAccessAuditEntry>,
  securityService: SecurityMonitoringService
): void {
  const violations = [];

  if (auditData.securityFlags!.suspiciousActivity) {
    violations.push('SUSPICIOUS_ACTIVITY');
  }

  if (auditData.securityFlags!.unusualAccessPattern) {
    violations.push('UNUSUAL_ACCESS_PATTERN');
  }

  if (auditData.securityFlags!.dataExfiltrationRisk) {
    violations.push('DATA_EXFILTRATION_RISK');
  }

  if (auditData.securityFlags!.privilegeEscalationAttempt) {
    violations.push('PRIVILEGE_ESCALATION_ATTEMPT');
  }

  if (auditData.securityFlags!.bruteForceIndicator) {
    violations.push('BRUTE_FORCE_INDICATOR');
  }

  // Trigger security alerts for violations
  if (violations.length > 0) {
    securityService.recordSecurityEvent(
      SecurityEventType.SUSPICIOUS_USER_AGENT,
      {
        ip: auditData.ipAddress!,
        get: (header: string) => header === 'user-agent' ? auditData.userAgent : undefined,
        header: (name: string) => name === 'user-agent' ? auditData.userAgent : undefined,
        accepts: () => [],
        acceptsCharsets: () => [],
        acceptsEncodings: () => [],
        acceptsLanguages: () => [],
        range: undefined,
        param: () => undefined,
        query: {},
        body: {},
        cookies: {},
        signedCookies: {},
        fresh: false,
        stale: true,
        protocol: 'https',
        secure: true,
        xhr: false,
        url: '/audit',
        method: 'POST',
        path: '/audit',
        hostname: 'localhost',
        port: 443,
        subdomains: [],
        originalUrl: '/audit',
        originalMethod: 'POST',
        baseUrl: '',
        app: {} as any,
        res: {} as any,
        next: () => {},
        route: { path: '/audit' }
      } as any,
      {
        userId: auditData.userId,
        userRole: auditData.userRole,
        endpoint: auditData.endpoint,
        method: auditData.method,
        violations,
        sensitiveFieldsAccessed: auditData.sensitiveFieldsAccessed,
        dataAccessLevel: auditData.dataAccessLevel
      },
      AlertSeverity.HIGH
    );
  }
}

/**
 * Store audit log in database
 */
async function storeAuditLog(
  auditEntry: DataAccessAuditEntry,
  prisma: PrismaClient,
  config: AuditConfig
): Promise<void> {
  try {
    await prisma.audit_logs.create({
      data: {
        id: auditEntry.id,
        entity: 'data_access_audit',
        action: auditEntry.action,
        entity_id: auditEntry.entityId || 'unknown',
        performed_by: auditEntry.userId,
        ip_address: auditEntry.ipAddress,
        user_agent: auditEntry.userAgent || null,
        new_values: {
          audit: {
            timestamp: auditEntry.timestamp,
            userRole: auditEntry.userRole,
            sessionId: auditEntry.sessionId,
            requestId: auditEntry.requestId,
            endpoint: auditEntry.endpoint,
            method: auditEntry.method,
            entityType: auditEntry.entityType,
            fieldsAccessed: auditEntry.fieldsAccessed,
            sensitiveFieldsAccessed: auditEntry.sensitiveFieldsAccessed,
            encryptedFieldsAccessed: auditEntry.encryptedFieldsAccessed,
            dataAccessLevel: auditEntry.dataAccessLevel,
            recordsAffected: auditEntry.recordsAffected,
            dataSize: auditEntry.dataSize,
            responseStatus: auditEntry.responseStatus,
            success: auditEntry.success,
            duration: auditEntry.duration,
            ferpaCompliance: auditEntry.ferpaCompliance,
            securityFlags: auditEntry.securityFlags,
            metadata: auditEntry.metadata
          }
        }
      }
    });

    // Log to system logger
    logger[auditEntry.success ? 'info' : 'warn']('Data access audit log created', {
      auditId: auditEntry.id,
      userId: auditEntry.userId,
      userRole: auditEntry.userRole,
      endpoint: auditEntry.endpoint,
      method: auditEntry.method,
      entityType: auditEntry.entityType,
      dataAccessLevel: auditEntry.dataAccessLevel,
      recordsAffected: auditEntry.recordsAffected,
      duration: auditEntry.duration,
      success: auditEntry.success,
      securityViolations: Object.values(auditEntry.securityFlags).filter(Boolean).length
    });

  } catch (error) {
    logger.error('Failed to store audit log', { error, auditId: auditEntry.id });
  }
}

// Helper functions

// generateAuditId is now imported from common utilities

function getActionFromMethod(method: string): 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'SEARCH' {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'READ';
    case 'POST':
      return 'CREATE';
    case 'PUT':
    case 'PATCH':
      return 'UPDATE';
    case 'DELETE':
      return 'DELETE';
    default:
      return 'READ';
  }
}

function getEntityTypeFromPath(path: string): string {
  if (path.includes('/students')) return 'student';
  if (path.includes('/activities')) return 'activity';
  if (path.includes('/books')) return 'book';
  if (path.includes('/equipment')) return 'equipment';
  if (path.includes('/users')) return 'user';
  return 'unknown';
}

function getEntityIdFromRequest(req: Request): string | undefined {
  return req.params.id || req.params.studentId || req.params.activityId || req.body?.id;
}

function getRecentAccessCount(userId: string): number {
  // This would typically use Redis or database to track recent access
  // For now, return a mock value
  return Math.floor(Math.random() * 50);
}

function getRecentAuthFailures(ipAddress: string): number {
  // This would typically use Redis or database to track recent failures
  // For now, return a mock value
  return Math.floor(Math.random() * 5);
}

export default createDataAccessAuditMiddleware;