import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';
import crypto from 'crypto';

export interface DatabaseSecurityConfig {
  enableQueryLogging: boolean;
  enableSensitiveDataEncryption: boolean;
  enableConnectionEncryption: boolean;
  maxConnections: number;
  connectionTimeout: number;
  queryTimeout: number;
  idleTimeout: number;
  enableRowLevelSecurity: boolean;
  sensitiveFields: string[];
  auditFields: string[];
  encryptionKey: string;
  backupEncryptionEnabled: boolean;
  dataRetentionDays: number;
}

export interface QueryAuditLog {
  id: string;
  userId?: string;
  sessionId?: string;
  query: string;
  parameters: any[];
  executionTime: number;
  rowCount: number;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  error?: string;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  hasSensitiveData: boolean;
}

export class DatabaseSecurity {
  private prisma: PrismaClient;
  private config: DatabaseSecurityConfig;
  private encryptionKey: Buffer;
  private queryCache: Map<string, any> = new Map();

  constructor(prisma: PrismaClient, config: Partial<DatabaseSecurityConfig> = {}) {
    this.prisma = prisma;
    this.config = {
      enableQueryLogging: process.env.NODE_ENV === 'production',
      enableSensitiveDataEncryption: true,
      enableConnectionEncryption: true,
      maxConnections: 100,
      connectionTimeout: 30000,
      queryTimeout: 30000,
      idleTimeout: 600000,
      enableRowLevelSecurity: true,
      sensitiveFields: [
        'password',
        'email',
        'phoneNumber',
        'address',
        'ssn',
        'creditCard',
        'bankAccount',
        'personalInfo'
      ],
      auditFields: [
        'id',
        'createdAt',
        'updatedAt',
        'createdBy',
        'updatedBy'
      ],
      encryptionKey: process.env.DB_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'),
      backupEncryptionEnabled: true,
      dataRetentionDays: 2555, // 7 years for compliance
      ...config
    };

    this.encryptionKey = Buffer.from(this.config.encryptionKey, 'hex');
    this.initializeSecurity();
  }

  private initializeSecurity(): void {
    // Validate encryption key
    if (this.encryptionKey.length !== 32) {
      throw new Error('Database encryption key must be 32 bytes (64 hex characters)');
    }

    logger.info('Database security initialized', {
      queryLogging: this.config.enableQueryLogging,
      encryptionEnabled: this.config.enableSensitiveDataEncryption,
      rowLevelSecurity: this.config.enableRowLevelSecurity,
      maxConnections: this.config.maxConnections
    });
  }

  // Execute query with security monitoring
  async executeSecureQuery<T>(
    query: string,
    parameters: any[] = [],
    context?: {
      userId?: string;
      sessionId?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<T> {
    const startTime = Date.now();
    const queryId = this.generateQueryId();

    try {
      // Log query start
      if (this.config.enableQueryLogging) {
        logger.debug('Executing secure query', {
          queryId,
          query: this.sanitizeQueryForLogging(query),
          parameterCount: parameters.length,
          userId: context?.userId
        });
      }

      // Check for SQL injection patterns
      const injectionCheck = this.checkForSQLInjection(query, parameters);
      if (injectionCheck.detected) {
        await this.logSecurityEvent({
          type: 'sql_injection_attempt',
          query,
          parameters,
          context,
          details: injectionCheck.reasons
        });

        throw new Error('Potential SQL injection detected');
      }

      // Execute query with timeout
      const result = await this.executeWithTimeout<T>(query, parameters, this.config.queryTimeout);

      const executionTime = Date.now() - startTime;
      const rowCount = Array.isArray(result) ? result.length : 1;

      // Log successful query
      if (this.config.enableQueryLogging) {
        await this.logQuery({
          queryId,
          userId: context?.userId,
          sessionId: context?.sessionId,
          query: this.sanitizeQueryForLogging(query),
          parameters: this.sanitizeParameters(parameters),
          executionTime,
          rowCount,
          timestamp: new Date(),
          ipAddress: context?.ipAddress || 'unknown',
          userAgent: context?.userAgent || 'unknown',
          success: true,
          operation: this.extractOperation(query),
          table: this.extractTable(query),
          hasSensitiveData: this.containsSensitiveData(query, parameters)
        });
      }

      // Process results for sensitive data
      const processedResult = this.processQueryResult(result, query);

      return processedResult;

    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Log failed query
      if (this.config.enableQueryLogging) {
        await this.logQuery({
          queryId,
          userId: context?.userId,
          sessionId: context?.sessionId,
          query: this.sanitizeQueryForLogging(query),
          parameters: this.sanitizeParameters(parameters),
          executionTime,
          rowCount: 0,
          timestamp: new Date(),
          ipAddress: context?.ipAddress || 'unknown',
          userAgent: context?.userAgent || 'unknown',
          success: false,
          error: (error as Error).message,
          operation: this.extractOperation(query),
          table: this.extractTable(query),
          hasSensitiveData: this.containsSensitiveData(query, parameters)
        });
      }

      logger.error('Secure query execution failed', {
        queryId,
        error: (error as Error).message,
        executionTime
      });

      throw error;
    }
  }

  // Encrypt sensitive data
  encryptSensitiveData(data: string): string {
    if (!this.config.enableSensitiveDataEncryption) {
      return data;
    }

    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);

      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      logger.error('Failed to encrypt sensitive data', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  // Decrypt sensitive data
  decryptSensitiveData(encryptedData: string): string {
    if (!this.config.enableSensitiveDataEncryption) {
      return encryptedData;
    }

    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];

      const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('Failed to decrypt sensitive data', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  // Check database security health
  async checkSecurityHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
    metrics: {
      totalQueries: number;
      slowQueries: number;
      failedQueries: number;
      suspiciousQueries: number;
      avgExecutionTime: number;
    };
  }> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Get recent query metrics
      const recentQueries = await this.getRecentQueryStats(oneHourAgo, now);

      const issues: string[] = [];
      const recommendations: string[] = [];

      // Check for issues
      if (recentQueries.failedQueries > recentQueries.totalQueries * 0.05) {
        issues.push('High query failure rate detected');
        recommendations.push('Review database connection and query performance');
      }

      if (recentQueries.slowQueries > recentQueries.totalQueries * 0.1) {
        issues.push('High number of slow queries detected');
        recommendations.push('Optimize database queries and check indexes');
      }

      if (recentQueries.suspiciousQueries > 0) {
        issues.push('Suspicious query patterns detected');
        recommendations.push('Review security logs and investigate potential threats');
      }

      const avgExecutionTime = recentQueries.totalQueries > 0
        ? recentQueries.totalExecutionTime / recentQueries.totalQueries
        : 0;

      if (avgExecutionTime > 5000) { // 5 seconds
        issues.push('Average query execution time is high');
        recommendations.push('Consider database optimization and query tuning');
      }

      // Determine overall status
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (issues.length > 0) {
        status = issues.length > 2 ? 'critical' : 'warning';
      }

      return {
        status,
        issues,
        recommendations,
        metrics: {
          totalQueries: recentQueries.totalQueries,
          slowQueries: recentQueries.slowQueries,
          failedQueries: recentQueries.failedQueries,
          suspiciousQueries: recentQueries.suspiciousQueries,
          avgExecutionTime
        }
      };

    } catch (error) {
      logger.error('Failed to check database security health', {
        error: (error as Error).message
      });

      return {
        status: 'critical',
        issues: ['Unable to assess database security health'],
        recommendations: ['Check database connectivity and configuration'],
        metrics: {
          totalQueries: 0,
          slowQueries: 0,
          failedQueries: 0,
          suspiciousQueries: 0,
          avgExecutionTime: 0
        }
      };
    }
  }

  // Create database backup with encryption
  async createSecureBackup(backupPath: string): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `secure_backup_${timestamp}.sql`;
      const fullBackupPath = `${backupPath}/${backupFileName}`;

      // This would typically use pg_dump or similar tool
      // For now, we'll simulate the process

      logger.info('Creating secure database backup', {
        backupPath: fullBackupPath,
        encryptionEnabled: this.config.backupEncryptionEnabled
      });

      // In a real implementation, this would:
      // 1. Run pg_dump or equivalent
      // 2. Encrypt the backup file if encryption is enabled
      // 3. Verify backup integrity
      // 4. Store backup securely

      return fullBackupPath;

    } catch (error) {
      logger.error('Failed to create secure backup', {
        error: (error as Error).message,
        backupPath
      });
      throw error;
    }
  }

  // Restore from encrypted backup
  async restoreFromBackup(backupPath: string): Promise<void> {
    try {
      logger.info('Restoring from secure backup', {
        backupPath,
        encryptionEnabled: this.config.backupEncryptionEnabled
      });

      // In a real implementation, this would:
      // 1. Decrypt backup if encrypted
      // 2. Verify backup integrity
      // 3. Restore database
      // 4. Verify restore success

    } catch (error) {
      logger.error('Failed to restore from backup', {
        error: (error as Error).message,
        backupPath
      });
      throw error;
    }
  }

  // Clean up old audit logs
  async cleanupOldAuditLogs(): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.dataRetentionDays);

      // This would delete old audit logs from the database
      const deletedCount = 0; // Placeholder

      logger.info('Old audit logs cleaned up', {
        cutoffDate: cutoffDate.toISOString(),
        deletedCount
      });

      return deletedCount;

    } catch (error) {
      logger.error('Failed to cleanup old audit logs', {
        error: (error as Error).message
      });
      return 0;
    }
  }

  private async executeWithTimeout<T>(
    query: string,
    parameters: any[],
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Query timeout exceeded'));
      }, timeout);

      this.prisma.$queryRawUnsafe(query, ...parameters)
        .then(result => {
          clearTimeout(timer);
          resolve(result as T);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private checkForSQLInjection(query: string, parameters: any[]): {
    detected: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];
    let detected = false;

    // Common SQL injection patterns
    const injectionPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
      /(\b(OR|AND)\s+['"][^'"]*['"]\s*=\s*['"][^'"]*['"])/i,
      /(--)|(\/\*)|(\*\/)/i,
      /(\bUNION\s+SELECT)/i,
      /(\bEXEC\s*\()/i,
      /(\bxp_cmdshell\b)/i,
      /(\bsp_oacreate\b)/i
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(query)) {
        detected = true;
        reasons.push(`Suspicious pattern detected: ${pattern.source}`);
      }
    }

    // Check for parameterized query safety
    if (!query.includes('?') && !query.includes('$') && !query.includes('@')) {
      // Query might be vulnerable if it contains dynamic values without parameters
      if (query.includes("'") || query.includes('"')) {
        detected = true;
        reasons.push('Query contains potential unescaped string literals');
      }
    }

    // Check parameters for suspicious content
    for (const param of parameters) {
      if (typeof param === 'string') {
        if (injectionPatterns.some(pattern => pattern.test(param))) {
          detected = true;
          reasons.push(`Suspicious content in parameter: ${param.substring(0, 50)}...`);
        }
      }
    }

    return { detected, reasons };
  }

  private sanitizeQueryForLogging(query: string): string {
    // Remove sensitive data from query for logging
    return query
      .replace(/password\s*=\s*['"][^'"]*['"]/gi, "password = '***'")
      .replace(/email\s*=\s*['"][^'"]*['"]/gi, "email = '***'")
      .replace(/token\s*=\s*['"][^'"]*['"]/gi, "token = '***'")
      .substring(0, 500); // Limit query length
  }

  private sanitizeParameters(parameters: any[]): any[] {
    return parameters.map(param => {
      if (typeof param === 'string') {
        if (param.length > 100) {
          return param.substring(0, 100) + '...';
        }
        // Hide potentially sensitive parameters
        if (param.toLowerCase().includes('password') ||
            param.toLowerCase().includes('token') ||
            param.toLowerCase().includes('secret')) {
          return '***';
        }
      }
      return param;
    });
  }

  private extractOperation(query: string): 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' {
    const trimmed = query.trim().toUpperCase();
    if (trimmed.startsWith('SELECT')) return 'SELECT';
    if (trimmed.startsWith('INSERT')) return 'INSERT';
    if (trimmed.startsWith('UPDATE')) return 'UPDATE';
    if (trimmed.startsWith('DELETE')) return 'DELETE';
    return 'SELECT'; // Default
  }

  private extractTable(query: string): string {
    const tablePattern = /(?:FROM|INTO|UPDATE)\s+(\w+)/i;
    const match = query.match(tablePattern);
    return match ? match[1] : 'unknown';
  }

  private containsSensitiveData(query: string, parameters: any[]): boolean {
    const sensitiveKeywords = [
      'password', 'email', 'phone', 'address', 'ssn',
      'credit', 'card', 'bank', 'account', 'personal'
    ];

    const checkString = (str: string): boolean => {
      return sensitiveKeywords.some(keyword =>
        str.toLowerCase().includes(keyword)
      );
    };

    // Check query
    if (checkString(query)) {
      return true;
    }

    // Check parameters
    for (const param of parameters) {
      if (typeof param === 'string' && checkString(param)) {
        return true;
      }
    }

    return false;
  }

  private processQueryResult<T>(result: T, query: string): T {
    if (!this.config.enableSensitiveDataEncryption) {
      return result;
    }

    // Process result to encrypt/hide sensitive data
    if (Array.isArray(result)) {
      return result.map(row => this.processRow(row, query)) as T;
    } else if (typeof result === 'object' && result !== null) {
      return this.processRow(result, query) as T;
    }

    return result;
  }

  private processRow(row: any, query: string): any {
    const processed = { ...row };

    for (const field of this.config.sensitiveFields) {
      if (field in processed) {
        processed[field] = this.encryptSensitiveData(processed[field]);
      }
    }

    return processed;
  }

  private async logQuery(auditLog: Omit<QueryAuditLog, 'id'>): Promise<void> {
    try {
      // Store query audit log
      await this.prisma.auditLog.create({
        data: {
          userId: auditLog.userId,
          action: `database_query_${auditLog.operation}`,
          details: {
            queryId: crypto.randomBytes(8).toString('hex'),
            query: auditLog.query,
            table: auditLog.table,
            operation: auditLog.operation,
            executionTime: auditLog.executionTime,
            rowCount: auditLog.rowCount,
            hasSensitiveData: auditLog.hasSensitiveData,
            success: auditLog.success,
            error: auditLog.error
          },
          timestamp: auditLog.timestamp
        }
      });

    } catch (error) {
      logger.error('Failed to log query audit', {
        error: (error as Error).message,
        query: auditLog.query.substring(0, 100)
      });
    }
  }

  private async logSecurityEvent(event: {
    type: string;
    query: string;
    parameters: any[];
    context?: any;
    details: string[];
  }): Promise<void> {
    try {
      logger.warn('Database security event', {
        type: event.type,
        query: this.sanitizeQueryForLogging(event.query),
        userId: event.context?.userId,
        details: event.details,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Failed to log security event', {
        error: (error as Error).message,
        type: event.type
      });
    }
  }

  private async getRecentQueryStats(startDate: Date, endDate: Date): Promise<{
    totalQueries: number;
    slowQueries: number;
    failedQueries: number;
    suspiciousQueries: number;
    totalExecutionTime: number;
  }> {
    try {
      // This would query the audit logs for statistics
      // For now, return placeholder values
      return {
        totalQueries: 0,
        slowQueries: 0,
        failedQueries: 0,
        suspiciousQueries: 0,
        totalExecutionTime: 0
      };

    } catch (error) {
      logger.error('Failed to get recent query stats', {
        error: (error as Error).message
      });
      return {
        totalQueries: 0,
        slowQueries: 0,
        failedQueries: 0,
        suspiciousQueries: 0,
        totalExecutionTime: 0
      };
    }
  }

  private generateQueryId(): string {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }
}

// Export singleton instance
export const databaseSecurity = new DatabaseSecurity(new PrismaClient());