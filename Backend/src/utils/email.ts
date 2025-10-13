import nodemailer from 'nodemailer';
import { logger } from './logger';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

const createTransporter = () => {
  const config: EmailConfig = {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER || '',
      pass: process.env.EMAIL_PASS || ''
    }
  };

  // Return a mock transporter for development if no email config is provided
  if (!config.auth.user || !config.auth.pass) {
    logger.warn('No email configuration provided, using mock transporter');
    return {
      sendMail: async (options: any) => {
        logger.info('Mock email sent:', {
          to: options.to,
          subject: options.subject,
          timestamp: new Date().toISOString()
        });
        return { messageId: 'mock-' + Date.now() };
      }
    };
  }

  return nodemailer.createTransport(config);
};

export const transporter = createTransporter();

export const sendEmail = async (options: {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: any[];
}) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@clms.edu',
      ...options
    };

    const result = await transporter.sendMail(mailOptions);
    logger.info('Email sent successfully', {
      messageId: result.messageId,
      to: options.to,
      subject: options.subject
    });

    return result;
  } catch (error) {
    logger.error('Failed to send email', {
      error: (error as Error).message,
      to: options.to,
      subject: options.subject
    });
    throw error;
  }
};

export default { transporter, sendEmail };