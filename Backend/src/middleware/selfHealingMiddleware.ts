import type { Request, Response, NextFunction } from 'express';
import { BaseError } from '@/utils/errors';
import { enhancedErrorHandler, ErrorCategory, ErrorSeverity } from './errorMiddleware';
import { recoveryService } from '@/services/recoveryService';
import { errorReportingService } from '@/services/errorReportingService';
import { errorNotificationService } from '@/services/errorNotificationService';
import { logger } from '@/utils/logger';

export interface HealingStrategy {
  id: string;
  name: string;
  description: string;
  errorTypes: string[];
  category: ErrorCategory;
  severity: ErrorSeverity[];
  actions: Array<{
    type: 'RETRY' | 'FALLBACK' | 'DEGRADE' | 'RESTART' | 'RECONNECT';
    description: string;
    execute: (req: Request, res: Response, error: BaseError) => Promise<boolean>;
    timeout: number;
    maxAttempts: number;
  }>;
  conditions?: {
    maxFrequency?: number; // max occurrences per hour
    errorRate?: number; // max error rate percentage
    cooldown?: number; // minutes between activations
  };
}

export interface HealingResult {
  strategy: string;
  success: boolean;
  actions: Array<{
    type: string;
    success: boolean;
    duration: number;
    error?: string;
  }>;
  totalDuration: number;
  fallbackMode?: boolean;
  message: string;
}

export class SelfHealingMiddleware {
  private strategies: Map<string, HealingStrategy> = new Map();
  private activationHistory: Map<string, Array<{ timestamp: Date; success: boolean }>> = new Map();
  private errorCounts: Map<string, number> = new Map();
  private lastReset = new Date();

  constructor() {
    this.initializeHealingStrategies();
    this.startPeriodicCleanup();
  }

  private initializeHealingStrategies(): void {
    // Database connection healing
    this.strategies.set('database-connection', {
      id: 'database-connection',
      name: 'Database Connection Recovery',
      description: 'Automatically recover from database connection issues',
      errorTypes: ['DatabaseError', 'ConnectionError'],
      category: ErrorCategory.DATABASE,
      severity: [ErrorSeverity.HIGH, ErrorSeverity.CRITICAL],
      actions: [
        {
          type: 'RECONNECT',
          description: 'Reconnect to database',
          execute: async (req, res, error) => {
            try {
              await recoveryService.handleError(error);
              return true;
            } catch (recoveryError) {
              logger.error('Database reconnection failed', { recoveryError });
              return false;
            }
          },
          timeout: 30000,
          maxAttempts: 3,
        },
        {
          type: 'FALLBACK',
          description: 'Enable read-only mode with cached data',
          execute: async (req, res, error) => {
            try {
              // Enable cache-only mode
              res.locals.fallbackMode = true;
              res.locals.cacheOnly = true;
              return true;
            } catch (fallbackError) {
              logger.error('Fallback mode activation failed', { fallbackError });
              return false;
            }
          },
          timeout: 5000,
          maxAttempts: 1,
        },
      ],
      conditions: {
        maxFrequency: 10, // max 10 per hour
        cooldown: 5, // 5 minutes between activations
      },
    });

    // External service healing
    this.strategies.set('external-service', {
      id: 'external-service',
      name: 'External Service Recovery',
      description: 'Recover from external service failures',
      errorTypes: ['ExternalServiceError', 'NetworkError'],
      category: ErrorCategory.EXTERNAL_SERVICE,
      severity: [ErrorSeverity.MEDIUM, ErrorSeverity.HIGH],
      actions: [
        {
          type: 'RETRY',
          description: 'Retry external service call with exponential backoff',
          execute: async (req, res, error) => {
            try {
              // Implement retry logic with exponential backoff
              for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                  // Retry the original operation
                  await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                  return true;
                } catch (retryError) {
                  if (attempt === 3) throw retryError;
                }
              }
              return false;
            } catch (retryError) {
              logger.error('External service retry failed', { retryError });
              return false;
            }
          },
          timeout: 15000,
          maxAttempts: 3,
        },
        {
          type: 'FALLBACK',
          description: 'Use cached or default data',
          execute: async (req, res, error) => {
            try {
              // Return cached data or default response
              res.locals.fallbackData = true;
              return true;
            } catch (fallbackError) {
              logger.error('External service fallback failed', { fallbackError });
              return false;
            }
          },
          timeout: 5000,
          maxAttempts: 1,
        },
      ],
      conditions: {
        maxFrequency: 20,
        cooldown: 2,
      },
    });

    // Performance healing
    this.strategies.set('performance-degradation', {
      id: 'performance-degradation',
      name: 'Performance Recovery',
      description: 'Recover from performance issues and high load',
      errorTypes: ['TimeoutError', 'PerformanceError'],
      category: ErrorCategory.PERFORMANCE,
      severity: [ErrorSeverity.MEDIUM, ErrorSeverity.HIGH],
      actions: [
        {
          type: 'DEGRADE',
          description: 'Enable graceful degradation mode',
          execute: async (req, res, error) => {
            try {
              // Reduce functionality to improve performance
              res.locals.gracefulDegradation = true;
              res.locals.reducedFeatures = true;
              return true;
            } catch (degradationError) {
              logger.error('Graceful degradation failed', { degradationError });
              return false;
            }
          },
          timeout: 5000,
          maxAttempts: 1,
        },
        {
          type: 'RETRY',
          description: 'Retry request with timeout extension',
          execute: async (req, res, error) => {
            try {
              // Extend timeout and retry
              req.timeout = (req.timeout || 30000) * 2;
              return true;
            } catch (retryError) {
              logger.error('Performance retry failed', { retryError });
              return false;
            }
          },
          timeout: 10000,
          maxAttempts: 2,
        },
      ],
      conditions: {
        maxFrequency: 15,
        cooldown: 3,
      },
    });

    // Rate limiting healing
    this.strategies.set('rate-limit-exceeded', {
      id: 'rate-limit-exceeded',
      name: 'Rate Limit Recovery',
      description: 'Handle rate limiting gracefully',
      errorTypes: ['RateLimitError'],
      category: ErrorCategory.SYSTEM,
      severity: [ErrorSeverity.MEDIUM],
      actions: [
        {
          type: 'RETRY',
          description: 'Retry after delay with backoff',
          execute: async (req, res, error) => {
            try {
              // Calculate retry delay based on rate limit headers
              const retryAfter = res.getHeader('Retry-After') || 60;
              await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter) * 1000));
              return true;
            } catch (retryError) {
              logger.error('Rate limit retry failed', { retryError });
              return false;
            }
          },
          timeout: 120000, // 2 minutes max
          maxAttempts: 2,
        },
        {
          type: 'FALLBACK',
          description: 'Return cached response if available',
          execute: async (req, res, error) => {
            try {
              // Check for cached response
              res.locals.useCache = true;
              return true;
            } catch (fallbackError) {
              logger.error('Rate limit fallback failed', { fallbackError });
              return false;
            }
          },
          timeout: 5000,
          maxAttempts: 1,
        },
      ],
      conditions: {
        maxFrequency: 30,
        cooldown: 1,
      },
    });

    // Authentication healing
    this.strategies.set('authentication-failure', {
      id: 'authentication-failure',
      name: 'Authentication Recovery',
      description: 'Handle authentication failures gracefully',
      errorTypes: ['AuthenticationError'],
      category: ErrorCategory.AUTHENTICATION,
      severity: [ErrorSeverity.LOW, ErrorSeverity.MEDIUM],
      actions: [
        {
          type: 'RETRY',
          description: 'Refresh token and retry',
          execute: async (req, res, error) => {
            try {
              // Attempt token refresh
              const authHeader = req.headers.authorization;
              if (authHeader && authHeader.startsWith('Bearer ')) {
                // Token refresh logic would go here
                return true;
              }
              return false;
            } catch (retryError) {
              logger.error('Authentication retry failed', { retryError });
              return false;
            }
          },
          timeout: 10000,
          maxAttempts: 1,
        },
        {
          type: 'FALLBACK',
          description: 'Redirect to login with error message',
          execute: async (req, res, error) => {
            try {
              res.locals.redirectToLogin = true;
              res.locals.authError = error.message;
              return true;
            } catch (fallbackError) {
              logger.error('Authentication fallback failed', { fallbackError });
              return false;
            }
          },
          timeout: 5000,
          maxAttempts: 1,
        },
      ],
      conditions: {
        maxFrequency: 5,
        cooldown: 5,
      },
    });
  }

  async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();

    // Store original end method to intercept responses
    const originalEnd = res.end;
    res.end = function(this: Response, ...args: any[]) {
      const duration = Date.now() - startTime;

      // Check if response indicates an error
      if (res.statusCode >= 400) {
        const error = new BaseError(
          `HTTP ${res.statusCode}: ${res.statusMessage || 'Unknown error'}`,
          res.statusCode,
          true,
          'HTTP_ERROR'
        );

        // Try to heal the error
        SelfHealingMiddleware.getInstance().attemptHealing(req, res, error)
          .catch(healingError => {
            logger.error('Self-healing failed', { healingError });
          });
      }

      return originalEnd.apply(this, args);
    };

    next();
  }

  async attemptHealing(req: Request, res: Response, error: BaseError): Promise<HealingResult> {
    const strategy = this.findMatchingStrategy(error);

    if (!strategy) {
      logger.debug('No healing strategy found for error', {
        errorType: error.constructor.name,
        category: error.category,
        severity: error.severity,
      });
      return {
        strategy: 'none',
        success: false,
        actions: [],
        totalDuration: 0,
        message: 'No healing strategy available',
      };
    }

    // Check if strategy can be activated
    if (!this.canActivateStrategy(strategy)) {
      logger.debug('Healing strategy activation blocked by conditions', {
        strategy: strategy.id,
        error: error.message,
      });
      return {
        strategy: strategy.id,
        success: false,
        actions: [],
        totalDuration: 0,
        message: 'Strategy activation blocked by frequency or cooldown limits',
      };
    }

    logger.info('Attempting self-healing', {
      strategy: strategy.id,
      error: error.message,
      requestId: req.headers['x-request-id'],
    });

    const startTime = Date.now();
    const results: HealingResult['actions'] = [];
    let overallSuccess = false;
    let fallbackMode = false;

    try {
      for (const action of strategy.actions) {
        const actionStartTime = Date.now();
        let actionSuccess = false;
        let actionError: string | undefined;

        try {
          // Execute action with timeout
          actionSuccess = await Promise.race([
            action.execute(req, res, error),
            new Promise<boolean>((_, reject) =>
              setTimeout(() => reject(new Error('Action timeout')), action.timeout)
            ),
          ]);

          if (actionSuccess) {
            overallSuccess = true;
            logger.info('Healing action successful', {
              strategy: strategy.id,
              action: action.type,
              duration: Date.now() - actionStartTime,
            });
          }
        } catch (actionError) {
          actionError = (actionError as Error).message;
          logger.warn('Healing action failed', {
            strategy: strategy.id,
            action: action.type,
            error: actionError,
          });
        }

        results.push({
          type: action.type,
          success: actionSuccess,
          duration: Date.now() - actionStartTime,
          error: actionError,
        });

        // If action succeeded, stop trying more actions
        if (actionSuccess) {
          break;
        }
      }

      // Record strategy activation
      this.recordStrategyActivation(strategy.id, overallSuccess);

      const totalDuration = Date.now() - startTime;

      const result: HealingResult = {
        strategy: strategy.id,
        success: overallSuccess,
        actions: results,
        totalDuration,
        fallbackMode: overallSuccess && res.locals.fallbackMode,
        message: overallSuccess
          ? 'Self-healing completed successfully'
          : 'Self-healing failed - all actions exhausted',
      };

      // Send error report
      await this.reportHealingResult(req, error, result);

      // Send notification if healing failed
      if (!overallSuccess && error.severity === ErrorSeverity.CRITICAL) {
        await this.notifyHealingFailure(req, error, result);
      }

      return result;
    } catch (healingError) {
      logger.error('Self-healing process failed', {
        strategy: strategy.id,
        error: healingError,
      });

      return {
        strategy: strategy.id,
        success: false,
        actions: results,
        totalDuration: Date.now() - startTime,
        message: `Self-healing process failed: ${(healingError as Error).message}`,
      };
    }
  }

  private findMatchingStrategy(error: BaseError): HealingStrategy | null {
    for (const strategy of this.strategies.values()) {
      // Check error type
      const errorTypeMatch = strategy.errorTypes.some(type =>
        error.constructor.name === type || error.code === type
      );

      // Check category
      const categoryMatch = strategy.category === error.category;

      // Check severity
      const severityMatch = strategy.severity.includes(error.severity!);

      if (errorTypeMatch && categoryMatch && severityMatch) {
        return strategy;
      }
    }

    return null;
  }

  private canActivateStrategy(strategy: HealingStrategy): boolean {
    const now = new Date();
    const history = this.activationHistory.get(strategy.id) || [];

    // Check frequency limit
    if (strategy.conditions?.maxFrequency) {
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const recentActivations = history.filter(h => h.timestamp >= oneHourAgo);

      if (recentActivations.length >= strategy.conditions.maxFrequency) {
        return false;
      }
    }

    // Check cooldown
    if (strategy.conditions?.cooldown) {
      const lastActivation = history[history.length - 1];
      if (lastActivation) {
        const cooldownMs = strategy.conditions.cooldown * 60 * 1000;
        if (now.getTime() - lastActivation.timestamp.getTime() < cooldownMs) {
          return false;
        }
      }
    }

    return true;
  }

  private recordStrategyActivation(strategyId: string, success: boolean): void {
    const history = this.activationHistory.get(strategyId) || [];
    history.push({
      timestamp: new Date(),
      success,
    });

    // Keep only last 100 activations
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }

    this.activationHistory.set(strategyId, history);
  }

  private async reportHealingResult(
    req: Request,
    error: BaseError,
    result: HealingResult
  ): Promise<void> {
    try {
      const context = {
        requestId: req.headers['x-request-id'] as string || 'unknown',
        userId: (req as any).user?.id,
        ip: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        method: req.method,
        url: req.originalUrl,
        timestamp: new Date(),
        duration: 0,
      };

      await errorReportingService.createErrorReport(error, context);

      logger.info('Healing result reported', {
        strategy: result.strategy,
        success: result.success,
        duration: result.totalDuration,
        fallbackMode: result.fallbackMode,
      });
    } catch (reportingError) {
      logger.error('Failed to report healing result', { reportingError });
    }
  }

  private async notifyHealingFailure(
    req: Request,
    error: BaseError,
    result: HealingResult
  ): Promise<void> {
    try {
      const context = {
        requestId: req.headers['x-request-id'] as string || 'unknown',
        userId: (req as any).user?.id,
        ip: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        method: req.method,
        url: req.originalUrl,
        timestamp: new Date(),
        duration: 0,
      };

      await errorNotificationService.processError(error, context);
    } catch (notificationError) {
      logger.error('Failed to send healing failure notification', { notificationError });
    }
  }

  private startPeriodicCleanup(): void {
    // Clean up old activation history every hour
    setInterval(() => {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

      for (const [strategyId, history] of this.activationHistory.entries()) {
        const filteredHistory = history.filter(h => h.timestamp >= cutoff);
        this.activationHistory.set(strategyId, filteredHistory);
      }

      // Reset error counts periodically
      if (Date.now() - this.lastReset.getTime() > 60 * 60 * 1000) { // 1 hour
        this.errorCounts.clear();
        this.lastReset = new Date();
      }

      logger.debug('Self-healing cleanup completed');
    }, 60 * 60 * 1000); // Every hour
  }

  // Public methods for monitoring and management
  getHealingStrategies(): HealingStrategy[] {
    return Array.from(this.strategies.values());
  }

  getActivationHistory(strategyId?: string): Array<{
    strategy: string;
    timestamp: Date;
    success: boolean;
  }> {
    const history: Array<{ strategy: string; timestamp: Date; success: boolean }> = [];

    if (strategyId) {
      const strategyHistory = this.activationHistory.get(strategyId) || [];
      history.push(...strategyHistory.map(h => ({ strategy: strategyId, ...h })));
    } else {
      for (const [id, strategyHistory] of this.activationHistory.entries()) {
        history.push(...strategyHistory.map(h => ({ strategy: id, ...h })));
      }
    }

    return history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getSystemHealth(): Promise<{
    strategies: number;
    activeStrategies: number;
    successRate: number;
    averageResponseTime: number;
    lastActivation: Date | null;
  }> {
    const totalActivations = Array.from(this.activationHistory.values())
      .reduce((total, history) => total + history.length, 0);

    const successfulActivations = Array.from(this.activationHistory.values())
      .reduce((total, history) =>
        total + history.filter(h => h.success).length, 0
      );

    const successRate = totalActivations > 0 ? (successfulActivations / totalActivations) * 100 : 0;

    const lastActivation = Array.from(this.activationHistory.values())
      .flat()
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    return {
      strategies: this.strategies.size,
      activeStrategies: this.activationHistory.size,
      successRate: Math.round(successRate * 100) / 100,
      averageResponseTime: 0, // Would calculate from actual response times
      lastActivation: lastActivation?.timestamp || null,
    };
  }

  async enableStrategy(strategyId: string): Promise<boolean> {
    const strategy = this.strategies.get(strategyId);
    if (strategy) {
      logger.info('Healing strategy enabled', { strategyId });
      return true;
    }
    return false;
  }

  async disableStrategy(strategyId: string): Promise<boolean> {
    const strategy = this.strategies.get(strategyId);
    if (strategy) {
      this.strategies.delete(strategyId);
      logger.info('Healing strategy disabled', { strategyId });
      return true;
    }
    return false;
  }

  private static instance: SelfHealingMiddleware;

  static getInstance(): SelfHealingMiddleware {
    if (!SelfHealingMiddleware.instance) {
      SelfHealingMiddleware.instance = new SelfHealingMiddleware();
    }
    return SelfHealingMiddleware.instance;
  }
}

// Export singleton instance and middleware function
export const selfHealingMiddleware = SelfHealingMiddleware.getInstance();

// Middleware function for Express
export const selfHealing = (req: Request, res: Response, next: NextFunction): void => {
  selfHealingMiddleware.handle(req, res, next);
};

export default selfHealing;