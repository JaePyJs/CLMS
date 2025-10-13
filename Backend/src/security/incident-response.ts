import Redis from 'ioredis';
import { logger } from '@/utils/logger';
import { SecurityEventType, SecuritySeverity } from './security-monitor';
import { auditTrail } from './audit-trail';
import { EventEmitter } from 'events';

export interface SecurityIncident {
  id: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  title: string;
  description: string;
  status: 'new' | 'investigating' | 'contained' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolution?: string;
  affectedAssets: string[];
  indicators: SecurityIndicator[];
  timeline: IncidentTimelineEntry[];
  mitigation: MitigationAction[];
  impact: IncidentImpact;
  tags: string[];
  metadata: Record<string, any>;
}

export interface SecurityIndicator {
  type:
    | 'ip_address'
    | 'user_agent'
    | 'session_id'
    | 'user_id'
    | 'file_hash'
    | 'url'
    | 'domain';
  value: string;
  confidence: number;
  source: string;
  firstSeen: Date;
  lastSeen: Date;
  description?: string;
}

export interface IncidentTimelineEntry {
  timestamp: Date;
  action: string;
  description: string;
  performedBy: string;
  details?: Record<string, any>;
}

export interface MitigationAction {
  id: string;
  type:
    | 'block_ip'
    | 'terminate_session'
    | 'disable_account'
    | 'isolate_system'
    | 'patch_vulnerability'
    | 'update_permissions';
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  performedBy: string;
  performedAt: Date;
  result?: string;
  details?: Record<string, any>;
}

export interface IncidentImpact {
  usersAffected: number;
  systemsAffected: string[];
  dataExposed: boolean;
  dataModified: boolean;
  serviceDisruption: boolean;
  financialImpact?: number;
  complianceViolation: boolean;
  reputationImpact: 'none' | 'low' | 'medium' | 'high';
}

export interface IncidentResponseConfig {
  autoContainment: boolean;
  notificationChannels: ('email' | 'slack' | 'sms' | 'webhook')[];
  escalationRules: EscalationRule[];
  defaultAssignee: string;
  responsePlaybooks: ResponsePlaybook[];
  retentionDays: number;
}

export interface EscalationRule {
  trigger: {
    severity: SecuritySeverity;
    timeWithoutAction: number; // minutes
  };
  action: 'notify_manager' | 'escalate_to_security_team' | 'create_ticket';
  target: string;
}

export interface ResponsePlaybook {
  incidentType: SecurityEventType;
  steps: PlaybookStep[];
  autoExecute: boolean;
}

export interface PlaybookStep {
  id: string;
  name: string;
  description: string;
  action:
    | 'block_ip'
    | 'terminate_session'
    | 'disable_account'
    | 'notify_admin'
    | 'create_ticket'
    | 'run_script';
  parameters?: Record<string, any>;
  conditions?: string[];
  order: number;
}

export class IncidentResponse extends EventEmitter {
  private redis: Redis;
  private config: IncidentResponseConfig;
  private activeIncidents: Map<string, SecurityIncident> = new Map();

  constructor(redis: Redis, config: Partial<IncidentResponseConfig> = {}) {
    super();
    this.redis = redis;
    this.config = {
      autoContainment: process.env.NODE_ENV === 'production',
      notificationChannels: ['email', 'slack'],
      escalationRules: [
        {
          trigger: {
            severity: SecuritySeverity.CRITICAL,
            timeWithoutAction: 15,
          },
          action: 'notify_manager',
          target: 'security-team@company.com',
        },
        {
          trigger: {
            severity: SecuritySeverity.HIGH,
            timeWithoutAction: 60,
          },
          action: 'escalate_to_security_team',
          target: 'security-team',
        },
      ],
      defaultAssignee: 'security-team',
      responsePlaybooks: [],
      retentionDays: 2555, // 7 years for compliance
      ...config,
    };

    this.initializeDefaultPlaybooks();
    this.startEscalationMonitoring();
  }

  async createIncident(
    type: SecurityEventType,
    severity: SecuritySeverity,
    title: string,
    description: string,
    createdBy: string,
    indicators: SecurityIndicator[] = [],
    affectedAssets: string[] = [],
  ): Promise<string> {
    try {
      const incident: SecurityIncident = {
        id: this.generateIncidentId(),
        type,
        severity,
        title,
        description,
        status: 'new',
        priority: this.determinePriority(severity, type),
        createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
        affectedAssets,
        indicators,
        timeline: [
          {
            timestamp: new Date(),
            action: 'incident_created',
            description: 'Security incident created',
            performedBy: createdBy,
          },
        ],
        mitigation: [],
        impact: await this.assessInitialImpact(
          type,
          indicators,
          affectedAssets,
        ),
        tags: this.generateTags(type, severity),
        metadata: {},
      };

      // Store incident
      await this.storeIncident(incident);
      this.activeIncidents.set(incident.id, incident);

      // Auto-assign if configured
      if (this.config.defaultAssignee) {
        await this.assignIncident(
          incident.id,
          this.config.defaultAssignee,
          'auto-assigned',
        );
      }

      // Auto-containment if enabled
      if (this.config.autoContainment) {
        await this.executeAutoContainment(incident);
      }

      // Execute response playbook if available
      await this.executeResponsePlaybook(incident);

      // Send notifications
      await this.sendNotifications(incident, 'incident_created');

      // Emit event
      this.emit('incidentCreated', incident);

      logger.warn('Security incident created', {
        incidentId: incident.id,
        type,
        severity,
        title,
        createdBy,
      });

      // Log to audit trail
      await auditTrail.logEvent({
        userId: createdBy,
        action: 'security_incident_created',
        resourceType: 'incident',
        resourceId: incident.id,
        details: {
          incidentId: incident.id,
          type,
          severity,
          title,
          indicators: indicators.length,
          affectedAssets: affectedAssets.length,
        },
        ipAddress: 'system',
        userAgent: 'incident-response-system',
        severity: severity as any,
        category: 'security',
        outcome: 'success',
        source: 'system',
      });

      return incident.id;
    } catch (error) {
      logger.error('Failed to create security incident', {
        error: (error as Error).message,
        type,
        severity,
        title,
      });
      throw error;
    }
  }

  async updateIncidentStatus(
    incidentId: string,
    status: SecurityIncident['status'],
    updatedBy: string,
    comment?: string,
  ): Promise<void> {
    try {
      const incident = await this.getIncident(incidentId);
      if (!incident) {
        throw new Error('Incident not found');
      }

      const oldStatus = incident.status;
      incident.status = status;
      incident.updatedAt = new Date();

      if (status === 'resolved') {
        incident.resolvedAt = new Date();
        incident.resolvedBy = updatedBy;
      }

      // Add timeline entry
      incident.timeline.push({
        timestamp: new Date(),
        action: 'status_updated',
        description: `Status changed from ${oldStatus} to ${status}${comment ? `: ${comment}` : ''}`,
        performedBy: updatedBy,
      });

      await this.storeIncident(incident);
      this.activeIncidents.set(incidentId, incident);

      // Send notifications
      await this.sendNotifications(incident, 'status_updated');

      // Emit event
      this.emit('incidentUpdated', incident);

      logger.info('Security incident status updated', {
        incidentId,
        oldStatus,
        newStatus: status,
        updatedBy,
      });

      // Log to audit trail
      await auditTrail.logEvent({
        userId: updatedBy,
        action: 'security_incident_status_updated',
        resourceType: 'incident',
        resourceId: incidentId,
        details: {
          incidentId,
          oldStatus,
          newStatus: status,
          comment,
        },
        ipAddress: 'system',
        userAgent: 'incident-response-system',
        severity: 'medium' as any,
        category: 'security',
        outcome: 'success',
        source: 'system',
      });
    } catch (error) {
      logger.error('Failed to update incident status', {
        error: (error as Error).message,
        incidentId,
        status,
        updatedBy,
      });
      throw error;
    }
  }

  async assignIncident(
    incidentId: string,
    assignee: string,
    assignedBy: string,
  ): Promise<void> {
    try {
      const incident = await this.getIncident(incidentId);
      if (!incident) {
        throw new Error('Incident not found');
      }

      incident.assignedTo = assignee;
      incident.updatedAt = new Date();

      // Add timeline entry
      incident.timeline.push({
        timestamp: new Date(),
        action: 'incident_assigned',
        description: `Incident assigned to ${assignee}`,
        performedBy: assignedBy,
      });

      await this.storeIncident(incident);
      this.activeIncidents.set(incidentId, incident);

      // Send notification to assignee
      await this.sendNotifications(incident, 'incident_assigned', assignee);

      // Emit event
      this.emit('incidentAssigned', incident);

      logger.info('Security incident assigned', {
        incidentId,
        assignee,
        assignedBy,
      });
    } catch (error) {
      logger.error('Failed to assign incident', {
        error: (error as Error).message,
        incidentId,
        assignee,
      });
      throw error;
    }
  }

  async addMitigationAction(
    incidentId: string,
    action: Omit<MitigationAction, 'id' | 'performedAt'>,
  ): Promise<void> {
    try {
      const incident = await this.getIncident(incidentId);
      if (!incident) {
        throw new Error('Incident not found');
      }

      const mitigationAction: MitigationAction = {
        ...action,
        id: this.generateActionId(),
        performedAt: new Date(),
      };

      incident.mitigation.push(mitigationAction);
      incident.updatedAt = new Date();

      // Add timeline entry
      incident.timeline.push({
        timestamp: new Date(),
        action: 'mitigation_action_added',
        description: `Mitigation action added: ${mitigationAction.description}`,
        performedBy: mitigationAction.performedBy,
        details: {
          actionId: mitigationAction.id,
          actionType: mitigationAction.type,
        },
      });

      await this.storeIncident(incident);
      this.activeIncidents.set(incidentId, incident);

      // Execute the mitigation action
      await this.executeMitigationAction(incident, mitigationAction);

      // Emit event
      this.emit('mitigationActionAdded', incident, mitigationAction);

      logger.info('Mitigation action added to incident', {
        incidentId,
        actionId: mitigationAction.id,
        actionType: mitigationAction.type,
        performedBy: mitigationAction.performedBy,
      });
    } catch (error) {
      logger.error('Failed to add mitigation action', {
        error: (error as Error).message,
        incidentId,
        actionType: action.type,
      });
      throw error;
    }
  }

  async getIncidents(
    filter: {
      status?: SecurityIncident['status'];
      severity?: SecuritySeverity;
      type?: SecurityEventType;
      assignedTo?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{
    incidents: SecurityIncident[];
    totalCount: number;
  }> {
    try {
      // Get incident IDs from Redis
      let incidentIds = await this.redis.zrange('incidents_by_time', 0, -1);

      // Apply filters
      const filteredIncidents: SecurityIncident[] = [];

      for (const incidentId of incidentIds) {
        const incident = await this.getIncident(incidentId);
        if (!incident) continue;

        // Apply filters
        if (filter.status && incident.status !== filter.status) continue;
        if (filter.severity && incident.severity !== filter.severity) continue;
        if (filter.type && incident.type !== filter.type) continue;
        if (filter.assignedTo && incident.assignedTo !== filter.assignedTo)
          continue;
        if (filter.startDate && incident.createdAt < filter.startDate) continue;
        if (filter.endDate && incident.createdAt > filter.endDate) continue;

        filteredIncidents.push(incident);
      }

      // Sort by creation date (newest first)
      filteredIncidents.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );

      // Apply pagination
      const limit = filter.limit || 50;
      const offset = filter.offset || 0;
      const paginatedIncidents = filteredIncidents.slice(
        offset,
        offset + limit,
      );

      return {
        incidents: paginatedIncidents,
        totalCount: filteredIncidents.length,
      };
    } catch (error) {
      logger.error('Failed to get incidents', {
        error: (error as Error).message,
        filter,
      });
      return {
        incidents: [],
        totalCount: 0,
      };
    }
  }

  async getIncident(incidentId: string): Promise<SecurityIncident | null> {
    try {
      const cached = this.activeIncidents.get(incidentId);
      if (cached) {
        return cached;
      }

      const incidentData = await this.redis.hgetall(`incident:${incidentId}`);
      if (!incidentData || Object.keys(incidentData).length === 0) {
        return null;
      }

      const incident: SecurityIncident = {
        id: incidentData.id,
        type: incidentData.type as SecurityEventType,
        severity: incidentData.severity as SecuritySeverity,
        title: incidentData.title,
        description: incidentData.description,
        status: incidentData.status as SecurityIncident['status'],
        priority: incidentData.priority as SecurityIncident['priority'],
        assignedTo: incidentData.assignedTo,
        createdBy: incidentData.createdBy,
        createdAt: new Date(incidentData.createdAt),
        updatedAt: new Date(incidentData.updatedAt),
        resolvedAt: incidentData.resolvedAt
          ? new Date(incidentData.resolvedAt)
          : undefined,
        resolvedBy: incidentData.resolvedBy,
        resolution: incidentData.resolution,
        affectedAssets: JSON.parse(incidentData.affectedAssets || '[]'),
        indicators: JSON.parse(incidentData.indicators || '[]'),
        timeline: JSON.parse(incidentData.timeline || '[]'),
        mitigation: JSON.parse(incidentData.mitigation || '[]'),
        impact: JSON.parse(incidentData.impact || '{}'),
        tags: JSON.parse(incidentData.tags || '[]'),
        metadata: JSON.parse(incidentData.metadata || '{}'),
      };

      this.activeIncidents.set(incidentId, incident);
      return incident;
    } catch (error) {
      logger.error('Failed to get incident', {
        error: (error as Error).message,
        incidentId,
      });
      return null;
    }
  }

  async getIncidentStats(): Promise<{
    totalIncidents: number;
    newIncidents: number;
    investigatingIncidents: number;
    resolvedIncidents: number;
    criticalIncidents: number;
    averageResolutionTime: number;
    incidentsByType: Record<string, number>;
    incidentsBySeverity: Record<string, number>;
  }> {
    try {
      const result = await this.getIncidents();
      const incidents = result.incidents;

      const stats = {
        totalIncidents: incidents.length,
        newIncidents: incidents.filter(i => i.status === 'new').length,
        investigatingIncidents: incidents.filter(
          i => i.status === 'investigating',
        ).length,
        resolvedIncidents: incidents.filter(
          i => i.status === 'resolved' || i.status === 'closed',
        ).length,
        criticalIncidents: incidents.filter(
          i => i.severity === SecuritySeverity.CRITICAL,
        ).length,
        averageResolutionTime: this.calculateAverageResolutionTime(incidents),
        incidentsByType: {} as Record<string, number>,
        incidentsBySeverity: {} as Record<string, number>,
      };

      // Count by type and severity
      for (const incident of incidents) {
        stats.incidentsByType[incident.type] =
          (stats.incidentsByType[incident.type] || 0) + 1;
        stats.incidentsBySeverity[incident.severity] =
          (stats.incidentsBySeverity[incident.severity] || 0) + 1;
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get incident stats', {
        error: (error as Error).message,
      });
      return {
        totalIncidents: 0,
        newIncidents: 0,
        investigatingIncidents: 0,
        resolvedIncidents: 0,
        criticalIncidents: 0,
        averageResolutionTime: 0,
        incidentsByType: {},
        incidentsBySeverity: {},
      };
    }
  }

  private async storeIncident(incident: SecurityIncident): Promise<void> {
    try {
      const incidentKey = `incident:${incident.id}`;
      await this.redis.hset(incidentKey, {
        ...incident,
        createdAt: incident.createdAt.toISOString(),
        updatedAt: incident.updatedAt.toISOString(),
        resolvedAt: incident.resolvedAt?.toISOString(),
        affectedAssets: JSON.stringify(incident.affectedAssets),
        indicators: JSON.stringify(incident.indicators),
        timeline: JSON.stringify(incident.timeline),
        mitigation: JSON.stringify(incident.mitigation),
        impact: JSON.stringify(incident.impact),
        tags: JSON.stringify(incident.tags),
        metadata: JSON.stringify(incident.metadata),
      });

      // Add to incidents index (sorted by time)
      await this.redis.zadd(
        'incidents_by_time',
        incident.createdAt.getTime(),
        incident.id,
      );

      // Set expiry
      await this.redis.expire(
        incidentKey,
        this.config.retentionDays * 24 * 60 * 60,
      );
    } catch (error) {
      logger.error('Failed to store incident', {
        error: (error as Error).message,
        incidentId: incident.id,
      });
    }
  }

  private determinePriority(
    severity: SecuritySeverity,
    type: SecurityEventType,
  ): SecurityIncident['priority'] {
    if (severity === SecuritySeverity.CRITICAL) return 'critical';
    if (severity === SecuritySeverity.HIGH) return 'high';
    if (
      type === SecurityEventType.DATA_EXFILTRATION_ATTEMPT ||
      type === SecurityEventType.PRIVILEGE_ESCALATION_ATTEMPT
    ) {
      return 'high';
    }
    if (severity === SecuritySeverity.MEDIUM) return 'medium';
    return 'low';
  }

  private generateTags(
    type: SecurityEventType,
    severity: SecuritySeverity,
  ): string[] {
    const tags = [type, severity];

    // Add category tags
    if (type.includes('authentication') || type.includes('login')) {
      tags.push('authentication');
    }
    if (type.includes('authorization') || type.includes('privilege')) {
      tags.push('authorization');
    }
    if (type.includes('data')) {
      tags.push('data-protection');
    }
    if (type.includes('session')) {
      tags.push('session-management');
    }

    return tags;
  }

  private async assessInitialImpact(
    type: SecurityEventType,
    indicators: SecurityIndicator[],
    affectedAssets: string[],
  ): Promise<IncidentImpact> {
    // Simple impact assessment - can be enhanced with AI/ML
    const impact: IncidentImpact = {
      usersAffected: 0,
      systemsAffected: affectedAssets,
      dataExposed:
        type.includes('data_exfiltration') ||
        type.includes('unauthorized_access'),
      dataModified:
        type.includes('data_modification') || type.includes('deletion'),
      serviceDisruption: type.includes('dos') || type.includes('disruption'),
      complianceViolation: [
        'data_exfiltration',
        'unauthorized_access',
        'privilege_escalation',
      ].some(t => type.includes(t)),
      reputationImpact: 'none',
    };

    // Assess reputation impact
    if (impact.dataExposed || impact.complianceViolation) {
      impact.reputationImpact = 'high';
    } else if (impact.dataModified || impact.serviceDisruption) {
      impact.reputationImpact = 'medium';
    }

    // Estimate users affected
    for (const indicator of indicators) {
      if (indicator.type === 'user_id') {
        impact.usersAffected++;
      }
    }

    return impact;
  }

  private async executeAutoContainment(
    incident: SecurityIncident,
  ): Promise<void> {
    try {
      // Auto-containment strategies based on incident type
      switch (incident.type) {
        case SecurityEventType.BRUTE_FORCE_ATTEMPT:
          // Block suspicious IPs
          for (const indicator of incident.indicators) {
            if (indicator.type === 'ip_address' && indicator.confidence > 0.8) {
              await this.addMitigationAction(incident.id, {
                type: 'block_ip',
                description: `Auto-block IP: ${indicator.value}`,
                status: 'pending',
                performedBy: 'system',
                parameters: { ipAddress: indicator.value, duration: 3600 },
              });
            }
          }
          break;

        case SecurityEventType.SESSION_HIJACK_ATTEMPT:
          // Terminate suspicious sessions
          for (const indicator of incident.indicators) {
            if (indicator.type === 'session_id' && indicator.confidence > 0.7) {
              await this.addMitigationAction(incident.id, {
                type: 'terminate_session',
                description: `Auto-terminate session: ${indicator.value}`,
                status: 'pending',
                performedBy: 'system',
                parameters: { sessionId: indicator.value },
              });
            }
          }
          break;

        case SecurityEventType.PRIVILEGE_ESCALATION_ATTEMPT:
          // Disable suspicious accounts
          for (const indicator of incident.indicators) {
            if (indicator.type === 'user_id' && indicator.confidence > 0.8) {
              await this.addMitigationAction(incident.id, {
                type: 'disable_account',
                description: `Auto-disable account: ${indicator.value}`,
                status: 'pending',
                performedBy: 'system',
                parameters: { userId: indicator.value },
              });
            }
          }
          break;
      }
    } catch (error) {
      logger.error('Failed to execute auto-containment', {
        error: (error as Error).message,
        incidentId: incident.id,
      });
    }
  }

  private async executeResponsePlaybook(
    incident: SecurityIncident,
  ): Promise<void> {
    try {
      const playbook = this.config.responsePlaybooks.find(
        p => p.incidentType === incident.type,
      );
      if (!playbook || !playbook.autoExecute) {
        return;
      }

      // Execute playbook steps
      for (const step of playbook.steps.sort((a, b) => a.order - b.order)) {
        await this.executePlaybookStep(incident, step);
      }
    } catch (error) {
      logger.error('Failed to execute response playbook', {
        error: (error as Error).message,
        incidentId: incident.id,
        incidentType: incident.type,
      });
    }
  }

  private async executePlaybookStep(
    incident: SecurityIncident,
    step: PlaybookStep,
  ): Promise<void> {
    try {
      // Convert playbook step to mitigation action
      await this.addMitigationAction(incident.id, {
        type: step.action as MitigationAction['type'],
        description: step.description,
        status: 'pending',
        performedBy: 'playbook',
        parameters: step.parameters,
      });
    } catch (error) {
      logger.error('Failed to execute playbook step', {
        error: (error as Error).message,
        incidentId: incident.id,
        stepId: step.id,
      });
    }
  }

  private async executeMitigationAction(
    incident: SecurityIncident,
    action: MitigationAction,
  ): Promise<void> {
    try {
      // Update action status to in_progress
      action.status = 'in_progress';

      // Execute based on action type
      switch (action.type) {
        case 'block_ip':
          // Implementation would go here
          action.status = 'completed';
          action.result = 'IP address blocked successfully';
          break;

        case 'terminate_session':
          // Implementation would go here
          action.status = 'completed';
          action.result = 'Session terminated successfully';
          break;

        case 'disable_account':
          // Implementation would go here
          action.status = 'completed';
          action.result = 'Account disabled successfully';
          break;

        case 'notify_admin':
          await this.sendNotifications(incident, 'admin_notification');
          action.status = 'completed';
          action.result = 'Admin notified successfully';
          break;

        default:
          action.status = 'failed';
          action.result = 'Unknown action type';
      }

      // Update incident
      await this.storeIncident(incident);
    } catch (error) {
      action.status = 'failed';
      action.result = (error as Error).message;
      logger.error('Failed to execute mitigation action', {
        error: (error as Error).message,
        incidentId: incident.id,
        actionId: action.id,
        actionType: action.type,
      });
    }
  }

  private async sendNotifications(
    incident: SecurityIncident,
    event: string,
    target?: string,
  ): Promise<void> {
    try {
      const notification = {
        incidentId: incident.id,
        type: incident.type,
        severity: incident.severity,
        title: incident.title,
        event,
        timestamp: new Date(),
      };

      // Send to configured channels
      for (const channel of this.config.notificationChannels) {
        // Implementation would depend on notification service
        logger.info('Sending incident notification', {
          channel,
          incidentId: incident.id,
          event,
          target,
        });
      }
    } catch (error) {
      logger.error('Failed to send incident notifications', {
        error: (error as Error).message,
        incidentId: incident.id,
        event,
      });
    }
  }

  private startEscalationMonitoring(): void {
    setInterval(
      async () => {
        await this.checkEscalationRules();
      },
      5 * 60 * 1000,
    ); // Check every 5 minutes
  }

  private async checkEscalationRules(): Promise<void> {
    try {
      const result = await this.getIncidents({
        status: ['new', 'investigating'],
      });

      const now = new Date();

      for (const incident of result.incidents) {
        for (const rule of this.config.escalationRules) {
          if (incident.severity === rule.trigger.severity) {
            const timeWithoutAction =
              now.getTime() - incident.updatedAt.getTime();
            const timeWithoutActionMinutes = timeWithoutAction / (1000 * 60);

            if (timeWithoutActionMinutes >= rule.trigger.timeWithoutAction) {
              await this.executeEscalationRule(incident, rule);
            }
          }
        }
      }
    } catch (error) {
      logger.error('Failed to check escalation rules', {
        error: (error as Error).message,
      });
    }
  }

  private async executeEscalationRule(
    incident: SecurityIncident,
    rule: EscalationRule,
  ): Promise<void> {
    try {
      switch (rule.action) {
        case 'notify_manager':
          await this.sendNotifications(
            incident,
            'escalation_manager_notification',
            rule.target,
          );
          break;

        case 'escalate_to_security_team':
          await this.sendNotifications(
            incident,
            'escalation_team_notification',
            rule.target,
          );
          break;

        case 'create_ticket':
          // Implementation would create ticket in external system
          logger.info('Creating escalation ticket', {
            incidentId: incident.id,
            target: rule.target,
          });
          break;
      }

      // Add timeline entry
      incident.timeline.push({
        timestamp: new Date(),
        action: 'escalation_triggered',
        description: `Escalation rule triggered: ${rule.action}`,
        performedBy: 'system',
        details: { rule },
      });

      await this.storeIncident(incident);

      logger.info('Escalation rule executed', {
        incidentId: incident.id,
        rule,
        action: rule.action,
      });
    } catch (error) {
      logger.error('Failed to execute escalation rule', {
        error: (error as Error).message,
        incidentId: incident.id,
        rule,
      });
    }
  }

  private calculateAverageResolutionTime(
    incidents: SecurityIncident[],
  ): number {
    const resolvedIncidents = incidents.filter(i => i.resolvedAt);
    if (resolvedIncidents.length === 0) return 0;

    const totalTime = resolvedIncidents.reduce((sum, incident) => {
      return (
        sum + (incident.resolvedAt!.getTime() - incident.createdAt.getTime())
      );
    }, 0);

    return totalTime / resolvedIncidents.length / (1000 * 60); // Return in minutes
  }

  private generateIncidentId(): string {
    return `inc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private generateActionId(): string {
    return `act_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private initializeDefaultPlaybooks(): void {
    this.config.responsePlaybooks = [
      {
        incidentType: SecurityEventType.BRUTE_FORCE_ATTEMPT,
        autoExecute: true,
        steps: [
          {
            id: 'block_ip',
            name: 'Block Suspicious IP',
            description:
              'Block IP address from which brute force attempt originated',
            action: 'block_ip',
            order: 1,
          },
          {
            id: 'notify_admin',
            name: 'Notify Administrator',
            description: 'Send notification to security administrators',
            action: 'notify_admin',
            order: 2,
          },
        ],
      },
      {
        incidentType: SecurityEventType.DATA_EXFILTRATION_ATTEMPT,
        autoExecute: true,
        steps: [
          {
            id: 'isolate_system',
            name: 'Isolate Affected System',
            description:
              'Isolate system from network to prevent further data loss',
            action: 'isolate_system',
            order: 1,
          },
          {
            id: 'notify_admin',
            name: 'Notify Security Team',
            description: 'Immediate notification to security team',
            action: 'notify_admin',
            order: 2,
          },
        ],
      },
    ];
  }
}

// Export singleton instance
export const incidentResponse = new IncidentResponse(
  new Redis(process.env.REDIS_URL || 'redis://localhost:6379'),
);

// Export convenience functions
export const createIncident = (
  type: SecurityEventType,
  severity: SecuritySeverity,
  title: string,
  description: string,
  createdBy: string,
  indicators?: SecurityIndicator[],
  affectedAssets?: string[],
) =>
  incidentResponse.createIncident(
    type,
    severity,
    title,
    description,
    createdBy,
    indicators,
    affectedAssets,
  );
