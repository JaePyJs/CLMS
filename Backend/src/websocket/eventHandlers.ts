import { WebSocket } from 'ws';
import { clientManager, ClientConnection } from './clientManager';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface WebSocketMessage {
  type: string;
  data?: any;
  clientId?: string;
  timestamp?: string;
}

export interface ActivityUpdatePayload {
  student_id: string;
  student_name: string;
  activity_type: string;
  timestamp: Date;
  details?: any;
}

export interface EquipmentUpdatePayload {
  equipment_id: string;
  equipmentName: string;
  status: string;
  id?: string;
  sessionId?: string;
  timestamp: Date;
}

export interface SystemNotificationPayload {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  priority: 'low' | 'medium' | 'high' | 'critical';
  targetRole?: string;
  targetUserId?: string;
}

export class EventHandlers {
  /**
   * Handle incoming WebSocket messages
   */
  static async handleMessage(
    socket: WebSocket,
    client: ClientConnection,
    message: WebSocketMessage
  ): Promise<void> {
    try {
      logger.debug('WebSocket message received', {
        clientId: client.id,
        id: client.id,
        type: message.type,
        timestamp: message.timestamp
      });

      // Update client activity
      clientManager.updateClientActivity(client.id);

      // Route message to appropriate handler
      switch (message.type) {
        case 'ping':
          await this.handlePing(client);
          break;

        case 'subscribe':
          await this.handleSubscription(client, message.data);
          break;

        case 'unsubscribe':
          await this.handleUnsubscription(client, message.data);
          break;

        case 'student_activity':
          await this.handleStudentActivity(client, message.data);
          break;

        case 'equipment_update':
          await this.handleEquipmentUpdate(client, message.data);
          break;

        case 'system_notification':
          await this.handleSystemNotification(client, message.data);
          break;

        case 'dashboard_request':
          await this.handleDashboardRequest(client, message.data);
          break;

        case 'chat_message':
          await this.handleChatMessage(client, message.data);
          break;

        case 'emergency_alert':
          await this.handleEmergencyAlert(client, message.data);
          break;

        default:
          logger.warn('Unknown WebSocket message type', {
            clientId: client.id,
            id: client.id,
            type: message.type
          });

          this.sendErrorToClient(client, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      logger.error('Error handling WebSocket message', {
        clientId: client.id,
        id: client.id,
        type: message.type,
        error: (error as Error).message,
        stack: (error as Error).stack
      });

      this.sendErrorToClient(client, 'Internal server error');
    }
  }

  /**
   * Handle ping message
   */
  private static async handlePing(client: ClientConnection): Promise<void> {
    this.sendMessageToClient(client, {
      type: 'pong',
      data: { 
        timestamp: new Date().toISOString(),
        serverTime: Date.now()
      }
    });
  }

  /**
   * Handle subscription request
   */
  private static async handleSubscription(
    client: ClientConnection,
    data: {  subscription: string }
  ): Promise<void> {
    if (!data?.subscription) {
      this.sendErrorToClient(client, 'Subscription name is required');
      return;
    }

    // Validate subscription
    const validSubscriptions = [
      'activities',
      'equipment',
      'notifications',
      'dashboard',
      'analytics',
      'emergency',
      'chat',
      'system'
    ];

    if (!validSubscriptions.includes(data.subscription)) {
      this.sendErrorToClient(client, `Invalid subscription: ${data.subscription}`);
      return;
    }

    clientManager.addSubscription(client.id, data.subscription);

    this.sendMessageToClient(client, {
      type: 'subscription_confirmed',
      data: { 
        subscription: data.subscription,
        timestamp: new Date().toISOString()
      }
    });

    logger.info('Client subscribed', {
      clientId: client.id,
      id: client.id,
      subscription: data.subscription
    });
  }

  /**
   * Handle unsubscription request
   */
  private static async handleUnsubscription(
    client: ClientConnection,
    data: {  subscription: string }
  ): Promise<void> {
    if (!data?.subscription) {
      this.sendErrorToClient(client, 'Subscription name is required');
      return;
    }

    clientManager.removeSubscription(client.id, data.subscription);

    this.sendMessageToClient(client, {
      type: 'unsubscription_confirmed',
      data: { 
        subscription: data.subscription,
        timestamp: new Date().toISOString()
      }
    });

    logger.info('Client unsubscribed', {
      clientId: client.id,
      id: client.id,
      subscription: data.subscription
    });
  }

  /**
   * Handle student activity updates
   */
  private static async handleStudentActivity(
    client: ClientConnection,
    data: ActivityUpdatePayload
  ): Promise<void> {
    if (!data?.student_id || !data?.activity_type) {
      this.sendErrorToClient(client, 'Student ID and activity type are required');
      return;
    }

    try {
      // Verify student exists
      const student = await prisma.students.findUnique({
        where: { id: data.student_id },
        select: { id: true, first_name: true, last_name: true, grade_level: true }
      });

      if (!student) {
        this.sendErrorToClient(client, 'Student not found');
        return;
      }

      // Create activity update message
      const activityMessage = {
        type: 'student_activity_update',
        data: { 
          student_id: data.student_id,
          student_name: `${student.first_name} ${student.last_name}`,
          grade_level: student.grade_level,
          activity_type: data.activity_type,
          timestamp: data.timestamp || new Date(),
          details: data.details || {},
          updatedBy: {
            id: client.id,
            username: client.username,
            role: client.role
          }
        }
      };

      // Broadcast to subscribed clients
      clientManager.broadcastToSubscription('activities', activityMessage);
      clientManager.broadcastToSubscription('dashboard', activityMessage);

      // Send confirmation to sender
      this.sendMessageToClient(client, {
        type: 'activity_confirmed',
        data: { 
          student_id: data.student_id,
          activity_type: data.activity_type,
          timestamp: new Date().toISOString()
        }
      });

      logger.info('Student activity updated', {
        clientId: client.id,
        id: client.id,
        student_id: data.student_id,
        activity_type: data.activity_type
      });

    } catch (error) {
      logger.error('Error handling student activity', {
        clientId: client.id,
        id: client.id,
        student_id: data.student_id,
        error: (error as Error).message
      });

      this.sendErrorToClient(client, 'Failed to update student activity');
    }
  }

  /**
   * Handle equipment updates
   */
  private static async handleEquipmentUpdate(
    client: ClientConnection,
    data: EquipmentUpdatePayload
  ): Promise<void> {
    if (!data?.equipment_id || !data?.status) {
      this.sendErrorToClient(client, 'Equipment ID and status are required');
      return;
    }

    try {
      // Verify equipment exists
      const equipment = await prisma.equipment.findUnique({
        where: { id: data.equipment_id },
        select: { id: true, name: true, type: true, status: true }
      });

      if (!equipment) {
        this.sendErrorToClient(client, 'Equipment not found');
        return;
      }

      // Create equipment update message
      const equipmentMessage = {
        type: 'equipment_status_update',
        data: { 
          equipment_id: data.equipment_id,
          equipmentName: data.equipmentName || equipment.name,
          equipmentType: equipment.type,
          status: data.status,
          id: data.id,
          sessionId: data.sessionId,
          timestamp: data.timestamp || new Date(),
          updatedBy: {
            id: client.id,
            username: client.username,
            role: client.role
          }
        }
      };

      // Broadcast to subscribed clients
      clientManager.broadcastToSubscription('equipment', equipmentMessage);
      clientManager.broadcastToSubscription('dashboard', equipmentMessage);

      // If equipment is malfunctioning, send high priority notification
      if (data.status === 'MALFUNCTIONING' || data.status === 'MAINTENANCE_REQUIRED') {
        clientManager.broadcastToRole('staff', {
          type: 'equipment_alert',
          data: { 
            equipment_id: data.equipment_id,
            equipmentName: data.equipmentName || equipment.name,
            status: data.status,
            urgency: data.status === 'MALFUNCTIONING' ? 'high' : 'medium',
            timestamp: new Date()
          }
        });
      }

      // Send confirmation to sender
      this.sendMessageToClient(client, {
        type: 'equipment_update_confirmed',
        data: { 
          equipment_id: data.equipment_id,
          status: data.status,
          timestamp: new Date().toISOString()
        }
      });

      logger.info('Equipment status updated', {
        clientId: client.id,
        id: client.id,
        equipment_id: data.equipment_id,
        status: data.status
      });

    } catch (error) {
      logger.error('Error handling equipment update', {
        clientId: client.id,
        id: client.id,
        equipment_id: data.equipment_id,
        error: (error as Error).message
      });

      this.sendErrorToClient(client, 'Failed to update equipment status');
    }
  }

  /**
   * Handle system notifications
   */
  private static async handleSystemNotification(
    client: ClientConnection,
    data: SystemNotificationPayload
  ): Promise<void> {
    if (!data?.title || !data?.message) {
      this.sendErrorToClient(client, 'Title and message are required');
      return;
    }

    try {
      const notificationMessage = {
        type: 'system_notification',
        data: { 
          id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: data.title,
          message: data.message,
          notificationType: data.type || 'info',
          priority: data.priority || 'medium',
          timestamp: new Date(),
          createdBy: {
            id: client.id,
            username: client.username,
            role: client.role
          }
        }
      };

      // Send notification based on target
      if (data.targetUserId) {
        // Send to specific user
        clientManager.sendToUser(data.targetUserId, notificationMessage);
      } else if (data.targetRole) {
        // Send to specific role
        clientManager.broadcastToRole(data.targetRole, notificationMessage);
      } else {
        // Send to all subscribed clients
        clientManager.broadcastToSubscription('notifications', notificationMessage);
      }

      // Send confirmation to sender
      this.sendMessageToClient(client, {
        type: 'notification_sent',
        data: { 
          notificationId: notificationMessage.data.id,
          timestamp: new Date().toISOString()
        }
      });

      logger.info('System notification sent', {
        clientId: client.id,
        id: client.id,
        title: data.title,
        type: data.type,
        targetRole: data.targetRole,
        targetUserId: data.targetUserId
      });

    } catch (error) {
      logger.error('Error handling system notification', {
        clientId: client.id,
        id: client.id,
        title: data.title,
        error: (error as Error).message
      });

      this.sendErrorToClient(client, 'Failed to send notification');
    }
  }

  /**
   * Handle dashboard data requests
   */
  private static async handleDashboardRequest(
    client: ClientConnection,
    data: {  dataType: string; filters?: any }
  ): Promise<void> {
    if (!data?.dataType) {
      this.sendErrorToClient(client, 'Data type is required');
      return;
    }

    try {
      let dashboardData: any = {};

      switch (data.dataType) {
        case 'overview':
          dashboardData = await this.getDashboardOverview(data.filters);
          break;

        case 'activities':
          dashboardData = await this.getRecentActivities(data.filters);
          break;

        case 'equipment':
          dashboardData = await this.getEquipmentStatus(data.filters);
          break;

        case 'analytics':
          dashboardData = await this.getAnalyticsData(data.filters);
          break;

        default:
          this.sendErrorToClient(client, `Unknown data type: ${data.dataType}`);
          return;
      }

      this.sendMessageToClient(client, {
        type: 'dashboard_data',
        data: { 
          dataType: data.dataType,
          data: dashboardData,
          timestamp: new Date().toISOString()
        }
      });

      logger.debug('Dashboard data sent', {
        clientId: client.id,
        id: client.id,
        dataType: data.dataType
      });

    } catch (error) {
      logger.error('Error handling dashboard request', {
        clientId: client.id,
        id: client.id,
        dataType: data.dataType,
        error: (error as Error).message
      });

      this.sendErrorToClient(client, 'Failed to fetch dashboard data');
    }
  }

  /**
   * Handle chat messages
   */
  private static async handleChatMessage(
    client: ClientConnection,
    data: {  message: string; targetRole?: string; targetUserId?: string }
  ): Promise<void> {
    if (!data?.message) {
      this.sendErrorToClient(client, 'Message is required');
      return;
    }

    try {
      const chatMessage = {
        type: 'chat_message',
        data: { 
          id: `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          message: data.message,
          timestamp: new Date(),
          sender: {
            id: client.id,
            username: client.username,
            role: client.role
          }
        }
      };

      // Route message based on target
      if (data.targetUserId) {
        clientManager.sendToUser(data.targetUserId, chatMessage);
      } else if (data.targetRole) {
        clientManager.broadcastToRole(data.targetRole, chatMessage);
      } else {
        clientManager.broadcastToSubscription('chat', chatMessage);
      }

      // Send confirmation to sender
      this.sendMessageToClient(client, {
        type: 'message_sent',
        data: { 
          messageId: chatMessage.data.id,
          timestamp: new Date().toISOString()
        }
      });

      logger.info('Chat message sent', {
        clientId: client.id,
        id: client.id,
        targetRole: data.targetRole,
        targetUserId: data.targetUserId
      });

    } catch (error) {
      logger.error('Error handling chat message', {
        clientId: client.id,
        id: client.id,
        error: (error as Error).message
      });

      this.sendErrorToClient(client, 'Failed to send message');
    }
  }

  /**
   * Handle emergency alerts
   */
  private static async handleEmergencyAlert(
    client: ClientConnection,
    data: {  alertType: string; message: string; location?: string; severity?: 'low' | 'medium' | 'high' | 'critical' }
  ): Promise<void> {
    if (!data?.alertType || !data?.message) {
      this.sendErrorToClient(client, 'Alert type and message are required');
      return;
    }

    try {
      const emergencyMessage = {
        type: 'emergency_alert',
        data: { 
          id: `emergency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          alertType: data.alertType,
          message: data.message,
          location: data.location,
          severity: data.severity || 'high',
          timestamp: new Date(),
          triggered_by: {
            id: client.id,
            username: client.username,
            role: client.role
          }
        }
      };

      // Broadcast emergency alert to all connected clients
      clientManager.broadcast(emergencyMessage);

      // Log emergency alert
      logger.warn('Emergency alert triggered', {
        clientId: client.id,
        id: client.id,
        alertType: data.alertType,
        severity: data.severity,
        location: data.location
      });

      // Send confirmation to sender
      this.sendMessageToClient(client, {
        type: 'emergency_alert_sent',
        data: { 
          alertId: emergencyMessage.data.id,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error handling emergency alert', {
        clientId: client.id,
        id: client.id,
        alertType: data.alertType,
        error: (error as Error).message
      });

      this.sendErrorToClient(client, 'Failed to send emergency alert');
    }
  }

  /**
   * Get dashboard overview data
   */
  private static async getDashboardOverview(filters?: any): Promise<any> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalStudents,
      todayActivities,
      activeEquipment,
      recentNotifications
    ] = await Promise.all([
      prisma.students.count(),
      prisma.student_activities.count({
        where: {
          start_time: {
            gte: today
          }
        }
      }),
      prisma.equipment.count({
        where: {
          status: 'AVAILABLE'
        }
      }),
      prisma.notifications.findMany({
        take: 5,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          title: true,
          message: true,
          type: true,
          created_at: true
        }
      })
    ]);

    return {
      totalStudents,
      todayActivities,
      activeEquipment,
      recentNotifications,
      lastUpdated: new Date()
    };
  }

  /**
   * Get recent activities
   */
  private static async getRecentActivities(filters?: any): Promise<any> {
    const limit = filters?.limit || 20;
    const activities = await prisma.student_activities.findMany({
      take: limit,
      orderBy: { start_time: 'desc' },
      include: {
        students: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            grade_level: true
          }
        }
      }
    });

    return activities;
  }

  /**
   * Get equipment status
   */
  private static async getEquipmentStatus(filters?: any): Promise<any> {
    const equipment = await prisma.equipment.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        created_at: true,
        updated_at: true
      }
    });

    const statusSummary = equipment.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      equipment,
      statusSummary,
      lastUpdated: new Date()
    };
  }

  /**
   * Get analytics data
   */
  private static async getAnalyticsData(filters?: any): Promise<any> {
    // This would typically include more complex analytics queries
    // For now, return basic statistics
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      weeklyActivities,
      studentGradeDistribution,
      equipmentUsage
    ] = await Promise.all([
      prisma.student_activities.groupBy({
        by: ['activity_type'],
        where: {
          start_time: {
            gte: weekAgo
          }
        },
        _count: {
          activity_type: true
        }
      }),
      prisma.students.groupBy({
        by: ['grade_level'],
        _count: {
          grade_level: true
        }
      }),
      prisma.equipment.groupBy({
        by: ['status'],
        _count: {
          status: true
        }
      })
    ]);

    return {
      weeklyActivities,
      studentGradeDistribution,
      equipmentUsage,
      period: {
        start: weekAgo,
        end: now
      },
      lastUpdated: new Date()
    };
  }

  /**
   * Send message to specific client
   */
  private static sendMessageToClient(client: ClientConnection, message: any): void {
    clientManager.sendToClient(client.id, message);
  }

  /**
   * Send error message to client
   */
  private static sendErrorToClient(client: ClientConnection, error: string): void {
    this.sendMessageToClient(client, {
      type: 'error',
      data: { 
        error,
        timestamp: new Date().toISOString()
      }
    });
  }
}