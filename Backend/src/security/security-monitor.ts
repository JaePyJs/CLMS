import Redis from 'ioredis';
import { logger } from '@/utils/logger';
import { prisma } from '@/utils/prisma';
import { EventEmitter } from 'events';

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  userId?: string;
  sessionId?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  details: Record<string, any>;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export enum SecurityEventType {
  AUTHENTICATION_FAILURE = 'authentication_failure',
  MULTIPLE_LOGIN_ATTEMPTS = 'multiple_login_attempts',
  SUSPICIOUS_IP_ADDRESS = 'suspicious_ip_address',
  BRUTE_FORCE_ATTEMPT = 'brute_force_attempt',
  SESSION_HIJACK_ATTEMPT = 'session_hijack_attempt',
  PRIVILEGE_ESCALATION_ATTEMPT = 'privilege_escalation_attempt',
  UNAUTHORIZED_API_ACCESS = 'unauthorized_api_access',
  DATA_EXFILTRATION_ATTEMPT = 'data_exfiltration_attempt',
  MALICIOUS_PAYLOAD = 'malicious_payload',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  ABNORMAL_BEHAVIOR = 'abnormal_behavior',
  SECURITY_POLICY_VIOLATION = 'security_policy_violation',
  MFA_BYPASS_ATTEMPT = 'mfa_bypass_attempt',
  CONCURRENT_SESSIONS = 'concurrent_sessions',
  ADMIN_ACCESS_AFTER_HOURS = 'admin_access_after_hours'
}

export enum SecuritySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface SecurityRule {
  id: string;
  name: string;
  description: string;
  eventType: SecurityEventType;
  conditions: SecurityCondition[];
  actions: SecurityAction[];
  enabled: boolean;
  cooldownPeriod: number; // seconds
}

export interface SecurityCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'regex';
  value: any;
}

export interface SecurityAction {
  type: 'log' | 'alert' | 'block_ip' | 'force_logout' | 'require_mfa' | 'notify_admin' | 'quarantine_session';
  parameters?: Record<string, any>;
}

export interface ThreatIntelligence {
  maliciousIPs: Set<string>;
  suspiciousUserAgents: Set<string>;
  knownAttackPatterns: Map<string, SecurityEventType>;
  reputationScores: Map<string, number>; // IP -> reputation score (-100 to 100)
}

export class SecurityMonitor extends EventEmitter {
  private redis: Redis;
  private rules: Map<string, SecurityRule> = new Map();
  private threatIntel: ThreatIntelligence;
  private monitoringActive: boolean = false;
  private eventBuffer: SecurityEvent[] = [];
  private maxBufferSize: number = 1000;
  private analysisInterval: number = 30000; // 30 seconds

  constructor(redis: Redis) {
    super();
    this.redis = redis;
    this.threatIntel = {
      maliciousIPs: new Set(),
      suspiciousUserAgents: new Set(),
      knownAttackPatterns: new Map(),
      reputationScores: new Map()
    };
    this.initializeDefaultRules();
    this.startMonitoring();
  }

  async recordSecurityEvent(event: Omit<SecurityEvent, 'id' | 'resolved'>): Promise<string> {
    try {
      const securityEvent: SecurityEvent = {
        ...event,
        id: this.generateEventId(),
        resolved: false
      };

      // Store in Redis for real-time access
      const eventKey = `security_event:${securityEvent.id}`;
      await this.redis.hset(eventKey, {
        ...securityEvent,
        timestamp: securityEvent.timestamp.toISOString(),
        details: JSON.stringify(securityEvent.details)
      });
      await this.redis.expire(eventKey, 7 * 24 * 60 * 60); // 7 days

      // Add to recent events list
      await this.redis.lpush('recent_security_events', securityEvent.id);
      await this.redis.ltrim('recent_security_events', 0, 999); // Keep last 1000 events

      // Store in database for permanent record
      await prisma.auditLog.create({
        data: {
          userId: securityEvent.userId,
          action: `security_${securityEvent.type}`,
          details: {
            securityEventId: securityEvent.id,
            severity: securityEvent.severity,
            ipAddress: securityEvent.ipAddress,
            userAgent: securityEvent.userAgent,
            ...securityEvent.details
          },
          timestamp: securityEvent.timestamp
        }
      });

      // Add to buffer for analysis
      this.eventBuffer.push(securityEvent);
      if (this.eventBuffer.length > this.maxBufferSize) {
        this.eventBuffer = this.eventBuffer.slice(-this.maxBufferSize);
      }

      // Evaluate security rules
      await this.evaluateSecurityRules(securityEvent);

      // Update threat intelligence
      this.updateThreatIntelligence(securityEvent);

      // Emit event for real-time notifications
      this.emit('securityEvent', securityEvent);

      logger.warn('Security event recorded', {
        eventId: securityEvent.id,
        type: securityEvent.type,
        severity: securityEvent.severity,
        userId: securityEvent.userId,
        ipAddress: securityEvent.ipAddress
      });

      return securityEvent.id;

    } catch (error) {
      logger.error('Failed to record security event', {
        error: (error as Error).message,
        eventType: event.type
      });
      throw error;
    }
  }

  async getSecurityEvents(filters: {
    userId?: string;
    eventType?: SecurityEventType;
    severity?: SecuritySeverity;
    startDate?: Date;
    endDate?: Date;
    resolved?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<SecurityEvent[]> {
    try {
      const whereClause: any = {};

      if (filters.userId) {
        whereClause.userId = filters.userId;
      }

      if (filters.startDate || filters.endDate) {
        whereClause.timestamp = {};
        if (filters.startDate) {
          whereClause.timestamp.gte = filters.startDate;
        }
        if (filters.endDate) {
          whereClause.timestamp.lte = filters.endDate;
        }
      }

      const auditLogs = await prisma.auditLog.findMany({
        where: {
          action: {
            startsWith: 'security_'
          },
          ...whereClause
        },
        orderBy: {
          timestamp: 'desc'
        },
        take: filters.limit || 100,
        skip: filters.offset || 0
      });

      const events: SecurityEvent[] = [];

      for (const log of auditLogs) {
        const details = log.details as any;
        if (details.securityEventId) {
          // Apply additional filters
          if (filters.eventType && !details.severity === filters.severity) continue;
          if (filters.severity && !details.severity === filters.severity) continue;

          events.push({
            id: details.securityEventId,
            type: log.action.replace('security_', '') as SecurityEventType,
            severity: details.severity,
            userId: log.userId,
            sessionId: details.sessionId,
            ipAddress: details.ipAddress,
            userAgent: details.userAgent,
            timestamp: log.timestamp,
            details: details,
            resolved: details.resolved || false,
            resolvedAt: details.resolvedAt ? new Date(details.resolvedAt) : undefined,
            resolvedBy: details.resolvedBy
          });
        }
      }

      return events;

    } catch (error) {
      logger.error('Failed to get security events', {
        error: (error as Error).message
      });
      return [];
    }
  }

  async addSecurityRule(rule: SecurityRule): Promise<void> {
    try {
      this.rules.set(rule.id, rule);

      // Store rule in Redis
      const ruleKey = `security_rule:${rule.id}`;
      await this.redis.hset(ruleKey, {
        ...rule,
        conditions: JSON.stringify(rule.conditions),
        actions: JSON.stringify(rule.actions)
      });

      logger.info('Security rule added', {
        ruleId: rule.id,
        ruleName: rule.name
      });

    } catch (error) {
      logger.error('Failed to add security rule', {
        error: (error as Error).message,
        ruleId: rule.id
      });
    }
  }

  async removeSecurityRule(ruleId: string): Promise<void> {
    try {
      this.rules.delete(ruleId);
      await this.redis.del(`security_rule:${ruleId}`);

      logger.info('Security rule removed', { ruleId });

    } catch (error) {
      logger.error('Failed to remove security rule', {
        error: (error as Error).message,
        ruleId
      });
    }
  }

  async blockIPAddress(ipAddress: string, reason: string, duration: number = 3600): Promise<void> {
    try {
      const blockKey = `blocked_ip:${ipAddress}`;
      await this.redis.hset(blockKey, {
        ipAddress,
        reason,
        blockedAt: new Date().toISOString(),
        blockedUntil: new Date(Date.now() + duration * 1000).toISOString()
      });
      await this.redis.expire(blockKey, duration);

      // Add to threat intelligence
      this.threatIntel.maliciousIPs.add(ipAddress);
      this.threatIntel.reputationScores.set(ipAddress, -100);

      await this.recordSecurityEvent({
        type: SecurityEventType.SUSPICIOUS_IP_ADDRESS,
        severity: SecuritySeverity.HIGH,
        ipAddress,
        userAgent: 'system',
        timestamp: new Date(),
        details: {
          action: 'ip_blocked',
          reason,
          duration
        }
      });

      logger.warn('IP address blocked', {
        ipAddress,
        reason,
        duration
      });

    } catch (error) {
      logger.error('Failed to block IP address', {
        error: (error as Error).message,
        ipAddress
      });
    }
  }

  async isIPBlocked(ipAddress: string): Promise<boolean> {
    try {
      const blockKey = `blocked_ip:${ipAddress}`;
      const blocked = await this.redis.exists(blockKey);
      return blocked === 1;
    } catch (error) {
      logger.error('Failed to check IP block status', {
        error: (error as Error).message,
        ipAddress
      });
      return false;
    }
  }

  async getSecurityStats(): Promise<{
    totalEvents: number;
    criticalEvents: number;
    highSeverityEvents: number;
    blockedIPs: number;
    activeThreats: number;
    resolvedEvents: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
  }> {
    try {
      const totalEvents = await this.redis.llen('recent_security_events');

      let criticalEvents = 0;
      let highSeverityEvents = 0;
      let activeThreats = 0;
      let resolvedEvents = 0;
      const eventsByType: Record<string, number> = {};
      const eventsBySeverity: Record<string, number> = {};

      // Analyze recent events
      const recentEventIds = await this.redis.lrange('recent_security_events', 0, 99);

      for (const eventId of recentEventIds) {
        const eventKey = `security_event:${eventId}`;
        const eventData = await this.redis.hgetall(eventKey);

        if (eventData && eventData.severity) {
          if (eventData.severity === SecuritySeverity.CRITICAL) criticalEvents++;
          if (eventData.severity === SecuritySeverity.HIGH) highSeverityEvents++;

          if (eventData.resolved === 'false') activeThreats++;
          if (eventData.resolved === 'true') resolvedEvents++;

          eventsByType[eventData.type] = (eventsByType[eventData.type] || 0) + 1;
          eventsBySeverity[eventData.severity] = (eventsBySeverity[eventData.severity] || 0) + 1;
        }
      }

      const blockedIPs = await this.redis.keys('blocked_ip:*');

      return {
        totalEvents,
        criticalEvents,
        highSeverityEvents,
        blockedIPs: blockedIPs.length,
        activeThreats,
        resolvedEvents,
        eventsByType,
        eventsBySeverity
      };

    } catch (error) {
      logger.error('Failed to get security stats', {
        error: (error as Error).message
      });
      return {
        totalEvents: 0,
        criticalEvents: 0,
        highSeverityEvents: 0,
        blockedIPs: 0,
        activeThreats: 0,
        resolvedEvents: 0,
        eventsByType: {},
        eventsBySeverity: {}
      };
    }
  }

  private async evaluateSecurityRules(event: SecurityEvent): Promise<void> {
    try {
      for (const rule of this.rules.values()) {
        if (!rule.enabled) continue;
        if (rule.eventType !== event.type) continue;

        // Check cooldown period
        const cooldownKey = `rule_cooldown:${rule.id}:${event.ipAddress}`;
        const isOnCooldown = await this.redis.exists(cooldownKey);
        if (isOnCooldown) continue;

        // Evaluate conditions
        let ruleMatched = true;
        for (const condition of rule.conditions) {
          if (!this.evaluateCondition(event, condition)) {
            ruleMatched = false;
            break;
          }
        }

        if (ruleMatched) {
          // Execute actions
          await this.executeSecurityActions(rule.actions, event);

          // Set cooldown
          await this.redis.setex(cooldownKey, rule.cooldownPeriod, '1');

          logger.info('Security rule triggered', {
            ruleId: rule.id,
            ruleName: rule.name,
            eventId: event.id
          });
        }
      }

    } catch (error) {
      logger.error('Failed to evaluate security rules', {
        error: (error as Error).message,
        eventId: event.id
      });
    }
  }

  private evaluateCondition(event: SecurityEvent, condition: SecurityCondition): boolean {
    const value = this.getEventFieldValue(event, condition.field);

    switch (condition.operator) {
      case 'eq':
        return value === condition.value;
      case 'ne':
        return value !== condition.value;
      case 'gt':
        return Number(value) > Number(condition.value);
      case 'gte':
        return Number(value) >= Number(condition.value);
      case 'lt':
        return Number(value) < Number(condition.value);
      case 'lte':
        return Number(value) <= Number(condition.value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      case 'contains':
        return String(value).includes(String(condition.value));
      case 'regex':
        return new RegExp(condition.value).test(String(value));
      default:
        return false;
    }
  }

  private getEventFieldValue(event: SecurityEvent, field: string): any {
    const fields = field.split('.');
    let value: any = event;

    for (const f of fields) {
      value = value?.[f];
    }

    return value;
  }

  private async executeSecurityActions(actions: SecurityAction[], event: SecurityEvent): Promise<void> {
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'log':
            logger.warn('Security rule action: log', {
              eventId: event.id,
              ruleAction: 'log',
              details: action.parameters
            });
            break;

          case 'alert':
            this.emit('securityAlert', {
              event,
              message: action.parameters?.message || 'Security alert triggered',
              severity: event.severity
            });
            break;

          case 'block_ip':
            const duration = action.parameters?.duration || 3600;
            await this.blockIPAddress(
              event.ipAddress,
              action.parameters?.reason || 'Security rule violation',
              duration
            );
            break;

          case 'force_logout':
            if (event.sessionId) {
              // Force logout session logic would go here
              this.emit('forceLogout', { sessionId: event.sessionId, reason: 'Security policy violation' });
            }
            break;

          case 'require_mfa':
            if (event.sessionId) {
              // Force MFA verification logic would go here
              this.emit('requireMFA', { sessionId: event.sessionId, reason: 'Security policy violation' });
            }
            break;

          case 'notify_admin':
            this.emit('adminNotification', {
              type: 'security_incident',
              event,
              message: action.parameters?.message || 'Security incident detected'
            });
            break;

          case 'quarantine_session':
            if (event.sessionId) {
              this.emit('quarantineSession', { sessionId: event.sessionId, event });
            }
            break;
        }

      } catch (error) {
        logger.error('Failed to execute security action', {
          error: (error as Error).message,
          action: action.type,
          eventId: event.id
        });
      }
    }
  }

  private updateThreatIntelligence(event: SecurityEvent): void {
    // Update IP reputation based on events
    const currentReputation = this.threatIntel.reputationScores.get(event.ipAddress) || 0;

    let reputationChange = 0;
    switch (event.severity) {
      case SecuritySeverity.CRITICAL:
        reputationChange = -20;
        break;
      case SecuritySeverity.HIGH:
        reputationChange = -10;
        break;
      case SecuritySeverity.MEDIUM:
        reputationChange = -5;
        break;
      case SecuritySeverity.LOW:
        reputationChange = -1;
        break;
    }

    const newReputation = currentReputation + reputationChange;
    this.threatIntel.reputationScores.set(event.ipAddress, newReputation);

    // Auto-block IPs with very bad reputation
    if (newReputation <= -50) {
      this.blockIPAddress(event.ipAddress, 'Poor reputation score', 7200); // 2 hours
    }

    // Track suspicious user agents
    if (event.type === SecurityEventType.MALICIOUS_PAYLOAD) {
      this.threatIntel.suspiciousUserAgents.add(event.userAgent);
    }
  }

  private initializeDefaultRules(): void {
    const defaultRules: SecurityRule[] = [
      {
        id: 'brute_force_detection',
        name: 'Brute Force Attack Detection',
        description: 'Detect multiple failed login attempts from same IP',
        eventType: SecurityEventType.AUTHENTICATION_FAILURE,
        conditions: [
          { field: 'ipAddress', operator: 'eq', value: '' }, // Will be set dynamically
          { field: 'details.attempts', operator: 'gte', value: 5 }
        ],
        actions: [
          { type: 'block_ip', parameters: { duration: 900, reason: 'Brute force attack' } },
          { type: 'alert', parameters: { message: 'Brute force attack detected' } }
        ],
        enabled: true,
        cooldownPeriod: 300
      },
      {
        id: 'suspicious_concurrent_sessions',
        name: 'Suspicious Concurrent Sessions',
        description: 'Detect unusual number of concurrent sessions',
        eventType: SecurityEventType.CONCURRENT_SESSIONS,
        conditions: [
          { field: 'details.sessionCount', operator: 'gt', value: 3 }
        ],
        actions: [
          { type: 'require_mfa' },
          { type: 'notify_admin', parameters: { message: 'Unusual concurrent session activity' } }
        ],
        enabled: true,
        cooldownPeriod: 600
      },
      {
        id: 'admin_after_hours_access',
        name: 'Admin Access After Hours',
        description: 'Detect admin access outside business hours',
        eventType: SecurityEventType.ADMIN_ACCESS_AFTER_HOURS,
        conditions: [
          { field: 'details.hour', operator: 'lt', value: 8 },
          { field: 'details.hour', operator: 'gt', value: 17 }
        ],
        actions: [
          { type: 'require_mfa' },
          { type: 'alert', parameters: { message: 'Admin access detected after hours' } }
        ],
        enabled: true,
        cooldownPeriod: 3600
      }
    ];

    for (const rule of defaultRules) {
      this.rules.set(rule.id, rule);
    }
  }

  private startMonitoring(): void {
    if (this.monitoringActive) return;

    this.monitoringActive = true;

    // Start periodic analysis
    setInterval(() => {
      this.performThreatAnalysis();
    }, this.analysisInterval);

    logger.info('Security monitoring started');
  }

  private async performThreatAnalysis(): Promise<void> {
    try {
      // Analyze patterns in event buffer
      const recentEvents = this.eventBuffer.slice(-100); // Last 100 events

      // Check for attack patterns
      await this.detectAttackPatterns(recentEvents);

      // Identify anomalous behavior
      await this.detectAnomalousBehavior(recentEvents);

      // Update threat intelligence based on patterns
      await this.updateThreatPatterns(recentEvents);

    } catch (error) {
      logger.error('Failed to perform threat analysis', {
        error: (error as Error).message
      });
    }
  }

  private async detectAttackPatterns(events: SecurityEvent[]): Promise<void> {
    // Group events by IP address
    const eventsByIP = new Map<string, SecurityEvent[]>();

    for (const event of events) {
      if (!eventsByIP.has(event.ipAddress)) {
        eventsByIP.set(event.ipAddress, []);
      }
      eventsByIP.get(event.ipAddress)!.push(event);
    }

    // Detect distributed attack patterns
    for (const [ip, ipEvents] of eventsByIP) {
      // Check for multiple event types from same IP
      const eventTypes = new Set(ipEvents.map(e => e.type));
      if (eventTypes.size > 3) {
        await this.recordSecurityEvent({
          type: SecurityEventType.ABNORMAL_BEHAVIOR,
          severity: SecuritySeverity.HIGH,
          ipAddress: ip,
          userAgent: 'analysis',
          timestamp: new Date(),
          details: {
            reason: 'multiple_attack_vectors',
            eventTypes: Array.from(eventTypes),
            eventCount: ipEvents.length
          }
        });
      }
    }
  }

  private async detectAnomalousBehavior(events: SecurityEvent[]): Promise<void> {
    // Detect spikes in event frequency
    const now = Date.now();
    const recentEvents = events.filter(e => now - e.timestamp.getTime() < 300000); // Last 5 minutes

    if (recentEvents.length > 50) {
      await this.recordSecurityEvent({
        type: SecurityEventType.ABNORMAL_BEHAVIOR,
        severity: SecuritySeverity.MEDIUM,
        ipAddress: 'system',
        userAgent: 'analysis',
        timestamp: new Date(),
        details: {
          reason: 'high_event_frequency',
          eventCount: recentEvents.length,
          timeWindow: '5 minutes'
        }
      });
    }
  }

  private async updateThreatPatterns(events: SecurityEvent[]): Promise<void> {
    // Update known attack patterns based on successful detections
    for (const event of events) {
      if (event.severity === SecuritySeverity.CRITICAL || event.severity === SecuritySeverity.HIGH) {
        const patternKey = `${event.type}:${event.details.reason || 'unknown'}`;
        this.threatIntel.knownAttackPatterns.set(patternKey, event.type);
      }
    }
  }

  private generateEventId(): string {
    return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}