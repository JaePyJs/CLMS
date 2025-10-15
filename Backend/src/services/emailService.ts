import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';
import Bull from 'bull';

const prisma = new PrismaClient();

// Email configuration interface
interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
  replyTo?: string;
  pool?: boolean;
  maxConnections?: number;
  maxMessages?: number;
}

// Email message interface
interface EmailMessage {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  headers?: Record<string, string>;
  priority?: 'high' | 'normal' | 'low';
}

// Email delivery status
interface DeliveryStatus {
  messageId: string;
  status: 'sent' | 'failed' | 'bounced' | 'opened' | 'clicked';
  timestamp: Date;
  error?: string;
  details?: any;
}

// Email queue for processing
const emailQueue = new Bull('email processing', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private config: EmailConfig | null = null;
  private isConnected: boolean = false;

  constructor() {
    this.initializeTransporter();
    this.setupQueueProcessors();
  }

  // Initialize email transporter with configuration
  private async initializeTransporter() {
    try {
      this.config = this.getEmailConfig();

      if (!this.config) {
        logger.warn('Email service not configured - missing environment variables');
        return;
      }

      this.transporter = nodemailer.createTransporter({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: this.config.auth,
        pool: this.config.pool || true,
        maxConnections: this.config.maxConnections || 5,
        maxMessages: this.config.maxMessages || 100,
        tls: {
          rejectUnauthorized: false, // Allow self-signed certificates in development
        },
      });

      // Verify connection
      await this.transporter.verify();
      this.isConnected = true;
      logger.info('Email service connected successfully', {
        host: this.config.host,
        port: this.config.port,
      });
    } catch (error) {
      logger.error('Failed to initialize email service', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.isConnected = false;
    }
  }

  // Get email configuration from environment
  private getEmailConfig(): EmailConfig | null {
    const requiredVars = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];

    for (const envVar of requiredVars) {
      if (!process.env[envVar]) {
        logger.warn(`Missing required email environment variable: ${envVar}`);
        return null;
      }
    }

    return {
      host: process.env.SMTP_HOST!,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER!,
        pass: process.env.SMTP_PASS!,
      },
      from: process.env.SMTP_FROM || 'CLMS Notifications <noreply@clms.edu>',
      replyTo: process.env.SMTP_REPLY_TO,
      pool: process.env.SMTP_POOL !== 'false',
      maxConnections: parseInt(process.env.SMTP_MAX_CONNECTIONS || '5'),
      maxMessages: parseInt(process.env.SMTP_MAX_MESSAGES || '100'),
    };
  }

  // Setup queue processors for email jobs
  private setupQueueProcessors() {
    emailQueue.process('send-email', async (job) => {
      const { messageId, message, options } = job.data;
      return this.processEmailJob(messageId, message, options);
    });

    emailQueue.process('send-bulk-email', async (job) => {
      const { messageId, messages, options } = job.data;
      return this.processBulkEmailJob(messageId, messages, options);
    });

    // Handle failed jobs
    emailQueue.on('failed', (job, err) => {
      logger.error('Email job failed', {
        jobId: job.id,
        messageId: job.data.messageId,
        error: err.message,
      });
    });

    // Handle completed jobs
    emailQueue.on('completed', (job, result) => {
      logger.info('Email job completed', {
        jobId: job.id,
        messageId: job.data.messageId,
        result,
      });
    });
  }

  // Send email immediately
  async sendEmail(message: EmailMessage, options?: { priority?: string; delay?: number }): Promise<string> {
    if (!this.isConnected || !this.transporter) {
      throw new Error('Email service not connected');
    }

    const messageId = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (options?.delay) {
      // Schedule for later
      emailQueue.add('send-email', { messageId, message, options }, {
        delay: options.delay,
        priority: this.getQueuePriority(options.priority),
      });
    } else {
      // Send immediately
      emailQueue.add('send-email', { messageId, message, options }, {
        priority: this.getQueuePriority(options.priority),
      });
    }

    return messageId;
  }

  // Send bulk emails
  async sendBulkEmail(
    messages: EmailMessage[],
    options?: { priority?: string; delay?: number; batchSize?: number }
  ): Promise<string> {
    if (!this.isConnected || !this.transporter) {
      throw new Error('Email service not connected');
    }

    const messageId = `bulk_email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const batchSize = options?.batchSize || 50;

    // Process in batches to avoid overwhelming the server
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);

      emailQueue.add('send-bulk-email', {
        messageId: `${messageId}_batch_${Math.floor(i / batchSize)}`,
        messages: batch,
        options,
      }, {
        delay: options?.delay || (i > 0 ? 1000 : 0), // Delay subsequent batches
        priority: this.getQueuePriority(options.priority),
      });
    }

    return messageId;
  }

  // Process individual email job
  private async processEmailJob(messageId: string, message: EmailMessage, options?: any): Promise<any> {
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      const mailOptions = {
        from: this.config!.from,
        to: message.to,
        cc: message.cc,
        bcc: message.bcc,
        subject: message.subject,
        html: message.html,
        text: message.text,
        attachments: message.attachments,
        headers: {
          'X-Priority': this.getEmailPriorityHeader(message.priority),
          'X-Mailer': 'CLMS Notification System',
          ...message.headers,
        },
      };

      const result = await this.transporter.sendMail(mailOptions);

      // Log delivery status
      await this.logDeliveryStatus(messageId, {
        messageId: result.messageId,
        status: 'sent',
        timestamp: new Date(),
        details: result,
      });

      return {
        success: true,
        messageId: result.messageId,
        response: result.response,
      };
    } catch (error) {
      // Log failed delivery
      await this.logDeliveryStatus(messageId, {
        messageId,
        status: 'failed',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  // Process bulk email job
  private async processBulkEmailJob(messageId: string, messages: EmailMessage[], options?: any): Promise<any> {
    const results = [];

    for (const message of messages) {
      try {
        const result = await this.processEmailJob(
          `${messageId}_${messages.indexOf(message)}`,
          message,
          options
        );
        results.push({ success: true, ...result });
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return {
      total: messages.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  }

  // Log email delivery status
  private async logDeliveryStatus(messageId: string, status: DeliveryStatus): Promise<void> {
    try {
      await prisma.audit_logs.create({
        data: {
          id: crypto.randomUUID(),
          entity: 'email_delivery',
          action: status.status,
          entity_id: messageId,
          new_values: {
            status: status.status,
            error: status.error,
            details: status.details,
          },
          performed_by: 'system',
        },
      });
    } catch (error) {
      logger.error('Failed to log email delivery status', {
        messageId,
        status: status.status,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Get email priority header value
  private getEmailPriorityHeader(priority?: 'high' | 'normal' | 'low'): string {
    switch (priority) {
      case 'high': return '1';
      case 'low': return '5';
      default: return '3';
    }
  }

  // Convert priority string to queue priority
  private getQueuePriority(priority?: string): number {
    switch (priority?.toLowerCase()) {
      case 'high': return 10;
      case 'low': return 1;
      default: return 5;
    }
  }

  // Test email configuration
  async testConfiguration(testEmail?: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.transporter) {
        return { success: false, error: 'Email service not configured' };
      }

      await this.transporter.verify();

      if (testEmail) {
        await this.sendEmail({
          to: testEmail,
          subject: 'CLMS Email Service Test',
          html: `
            <h2>✅ Email Service Test Successful</h2>
            <p>This is a test email from the CLMS notification system.</p>
            <p>Sent at: ${new Date().toLocaleString()}</p>
          `,
          text: `Email Service Test Successful\n\nThis is a test email from the CLMS notification system.\nSent at: ${new Date().toLocaleString()}`,
        });
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Get email service status
  getStatus(): {
    connected: boolean;
    config: Partial<EmailConfig> | null;
    queueStats: any;
  } {
    return {
      connected: this.isConnected,
      config: this.config ? {
        host: this.config.host,
        port: this.config.port,
        from: this.config.from,
        pool: this.config.pool,
      } : null,
      queueStats: {
        waiting: emailQueue.getWaiting().length,
        active: emailQueue.getActive().length,
        completed: emailQueue.getCompleted().length,
        failed: emailQueue.getFailed().length,
      },
    };
  }

  // Get delivery statistics
  async getDeliveryStats(days: number = 30): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    try {
      const stats = await prisma.audit_logs.groupBy({
        by: ['action'],
        where: {
          entity: 'email_delivery',
          created_at: { gte: startDate },
        },
        _count: true,
      });

      return {
        period: `${days} days`,
        startDate,
        stats: stats.reduce((acc, stat) => {
          acc[stat.action] = stat._count;
          return acc;
        }, {} as Record<string, number>),
      };
    } catch (error) {
      logger.error('Failed to get email delivery stats', { error });
      return null;
    }
  }

  // Reconnect email service
  async reconnect(): Promise<boolean> {
    try {
      await this.initializeTransporter();
      return this.isConnected;
    } catch (error) {
      logger.error('Failed to reconnect email service', { error });
      return false;
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService;

// Export interfaces for use in other services
export type { EmailMessage, EmailConfig, DeliveryStatus };