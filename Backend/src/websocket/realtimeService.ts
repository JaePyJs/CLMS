import { websocketServer } from './websocketServer';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

interface EquipmentSessionData {
  equipmentId: string;
  studentId: string;
  timeLimitMinutes: number;
}

interface TimeLimitAlert {
  sessionId: string;
  equipmentId: string;
  studentId: string;
  remainingMinutes: number;
  timeLimit: number;
}

class RealtimeService {
  private sessionTimers: Map<string, NodeJS.Timeout> = new Map();
  private equipmentPollingInterval: NodeJS.Timeout | null = null;
  private activityPollingInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize real-time monitoring services
   */
  initialize() {
    this.startEquipmentMonitoring();
    this.startActivityMonitoring();
    this.startSessionTimeLimitMonitoring();
    logger.info('Realtime service initialized');
  }

  /**
   * Monitor equipment status changes
   */
  private startEquipmentMonitoring() {
    // Poll equipment status every 5 seconds
    this.equipmentPollingInterval = setInterval(async () => {
      try {
        const equipment = await prisma.equipment.findMany({
          select: {
            id: true,
            equipment_id: true,
            name: true,
            type: true,
            location: true,
            status: true
          }
        });

        // Broadcast current equipment status
        websocketServer.broadcastToRoom('equipment', {
          type: 'equipment:status-update',
          payload: equipment,
          timestamp: new Date()
        });
      } catch (error) {
        logger.error('Error monitoring equipment:', error);
      }
    }, 5000);
  }

  /**
   * Monitor active student activities
   */
  private startActivityMonitoring() {
    // Poll active activities every 10 seconds
    this.activityPollingInterval = setInterval(async () => {
      try {
        const activities = await prisma.student_activities.findMany({
          where: {
            status: 'ACTIVE'
          },
          include: {
            students: {
              select: {
                id: true,
                student_id: true,
                first_name: true,
                last_name: true,
                grade_level: true
              }
            }
          },
          orderBy: {
            start_time: 'desc'
          },
          take: 50
        });

        // Broadcast active activities
        websocketServer.broadcastToRoom('activities', {
          type: 'activities:update',
          payload: activities,
          timestamp: new Date()
        });
      } catch (error) {
        logger.error('Error monitoring activities:', error);
      }
    }, 10000);
  }

  /**
   * Monitor session time limits and send alerts
   */
  private startSessionTimeLimitMonitoring() {
    setInterval(async () => {
      try {
        const activeSessions = await prisma.equipment_sessions.findMany({
          where: {
            status: 'ACTIVE',
            session_end: null
          },
          include: {
            equipment: true,
            students: true
          }
        });

        for (const session of activeSessions) {
          const elapsedMinutes = Math.floor(
            (Date.now() - new Date(session.session_start).getTime()) / (1000 * 60)
          );
          const remainingMinutes = session.equipment.max_time_minutes - elapsedMinutes;

          // Send alerts at 5, 2, and 1 minute remaining
          if ([5, 2, 1].includes(remainingMinutes)) {
            this.sendTimeLimitAlert({
              sessionId: session.id,
              equipmentId: session.equipment_id,
              studentId: session.student_id,
              remainingMinutes,
              timeLimit: session.equipment.max_time_minutes
            });
          }

          // Auto-end session when time limit exceeded
          if (remainingMinutes <= 0 && !session.session_end) {
            await this.autoEndSession(session.id);
          }
        }
      } catch (error) {
        logger.error('Error monitoring session time limits:', error);
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Send time limit alert to student and equipment room
   */
  private sendTimeLimitAlert(alert: TimeLimitAlert) {
    const message = {
      type: 'session:time-limit-alert',
      payload: alert,
      timestamp: new Date()
    };

    // Send to equipment room
    websocketServer.broadcastToRoom('equipment', message);

    // Send to specific student
    websocketServer.broadcastToUser(alert.studentId, message);

    logger.info(`Time limit alert sent for session ${alert.sessionId}: ${alert.remainingMinutes} minutes remaining`);
  }

  /**
   * Automatically end session when time limit exceeded
   */
  private async autoEndSession(sessionId: string) {
    try {
      const session = await prisma.equipment_sessions.update({
        where: { id: sessionId },
        data: {
          session_end: new Date(),
          status: 'COMPLETED',
          updated_at: new Date()
        },
        include: {
          equipment: true,
          students: true
        }
      });

      // Broadcast session ended
      websocketServer.broadcastToRoom('equipment', {
        type: 'session:auto-ended',
        payload: session,
        timestamp: new Date()
      });

      // Notify student
      websocketServer.broadcastToUser(session.student_id, {
        type: 'session:ended',
        payload: {
          ...session,
          reason: 'Time limit exceeded'
        },
        timestamp: new Date()
      });

      logger.info(`Auto-ended session ${sessionId} due to time limit`);
    } catch (error) {
      logger.error(`Error auto-ending session ${sessionId}:`, error);
    }
  }

  /**
   * Broadcast live analytics update
   */
  async broadcastAnalyticsUpdate() {
    try {
      const stats = await this.getRealtimeStatistics();
      
      websocketServer.broadcastToRoom('analytics', {
        type: 'analytics:update',
        payload: stats,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error broadcasting analytics:', error);
    }
  }

  /**
   * Get real-time statistics
   */
  private async getRealtimeStatistics() {
    const [
      totalStudents,
      activeStudents,
      totalEquipment,
      availableEquipment,
      activeSessions,
      todayActivities
    ] = await Promise.all([
      prisma.students.count(),
      prisma.students.count({ where: { is_active: true } }),
      prisma.equipment.count(),
      prisma.equipment.count({ where: { status: 'AVAILABLE' } }),
      prisma.equipment_sessions.count({ where: { status: 'ACTIVE' } }),
      prisma.student_activities.count({
        where: {
          start_time: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      })
    ]);

    return {
      students: {
        total: totalStudents,
        active: activeStudents
      },
      equipment: {
        total: totalEquipment,
        available: availableEquipment,
        inUse: totalEquipment - availableEquipment
      },
      sessions: {
        active: activeSessions
      },
      activities: {
        today: todayActivities
      },
      connectedClients: websocketServer.getConnectedClients()
    };
  }

  /**
   * Broadcast student activity event
   */
  async broadcastStudentActivity(activity: any) {
    websocketServer.broadcastToRoom('activities', {
      type: 'activity:new',
      payload: activity,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast equipment status change
   */
  async broadcastEquipmentStatus(equipment: any) {
    websocketServer.broadcastToRoom('equipment', {
      type: 'equipment:status-changed',
      payload: equipment,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast notification to specific user or room
   */
  async broadcastNotification(notification: {
    userId?: string;
    room?: string;
    title: string;
    message: string;
    type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  }) {
    const payload = {
      type: 'notification',
      payload: notification,
      timestamp: new Date()
    };

    if (notification.userId) {
      websocketServer.broadcastToUser(notification.userId, payload);
    } else if (notification.room) {
      websocketServer.broadcastToRoom(notification.room, payload);
    } else {
      websocketServer.broadcastToAll(payload);
    }
  }

  /**
   * Broadcast system alert
   */
  async broadcastSystemAlert(alert: {
    title: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    action?: string;
  }) {
    websocketServer.broadcastToAll({
      type: 'system:alert',
      payload: alert,
      timestamp: new Date()
    });

    logger.warn('System alert broadcast:', alert);
  }

  /**
   * Handle scanner input and process immediately
   */
  async handleScannerInput(scanData: {
    code: string;
    scannerType: 'barcode' | 'qr' | 'usb';
    scannedBy?: string;
  }) {
    try {
      // Try to find student first
      const student = await prisma.students.findFirst({
        where: {
          OR: [
            { student_id: scanData.code }
          ]
        }
      });

      if (student) {
        // Check if there's an active activity
        const activeActivity = await prisma.student_activities.findFirst({
          where: {
            student_id: student.id,
            status: 'ACTIVE'
          }
        });

        if (activeActivity) {
          // Check out
          const updated = await prisma.student_activities.update({
            where: { id: activeActivity.id },
            data: {
              end_time: new Date(),
              status: 'COMPLETED',
              updated_at: new Date()
            },
            include: { students: true }
          });

          websocketServer.broadcastToRoom('scanner', {
            type: 'scanner:checkout',
            payload: updated,
            timestamp: new Date()
          });

          return { action: 'checkout', activity: updated };
        } else {
          // Check in
          const activity = await prisma.student_activities.create({
            data: {
              id: crypto.randomUUID(),
              student_id: student.id,
              activity_type: 'LIBRARY_VISIT' as any,
              start_time: new Date(),
              status: 'ACTIVE',
              updated_at: new Date()
            },
            include: { students: true }
          });

          websocketServer.broadcastToRoom('scanner', {
            type: 'scanner:checkin',
            payload: activity,
            timestamp: new Date()
          });

          return { action: 'checkin', activity };
        }
      }

      // Try to find equipment
      const equipment = await prisma.equipment.findFirst({
        where: {
          OR: [
            { equipment_id: scanData.code }
          ]
        }
      });

      if (equipment) {
        websocketServer.broadcastToRoom('scanner', {
          type: 'scanner:equipment-found',
          payload: equipment,
          timestamp: new Date()
        });

        return { action: 'equipment-found', equipment };
      }

      // Nothing found
      return { action: 'not-found', code: scanData.code };
    } catch (error) {
      logger.error('Error handling scanner input:', error);
      throw error;
    }
  }

  /**
   * Cleanup on shutdown
   */
  shutdown() {
    if (this.equipmentPollingInterval) {
      clearInterval(this.equipmentPollingInterval);
    }
    if (this.activityPollingInterval) {
      clearInterval(this.activityPollingInterval);
    }
    this.sessionTimers.forEach(timer => clearTimeout(timer));
    this.sessionTimers.clear();
    logger.info('Realtime service shut down');
  }
}

export const realtimeService = new RealtimeService();
export default realtimeService;
