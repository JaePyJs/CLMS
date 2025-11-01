import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { logger } from '@/utils/logger';
import { prisma } from '@/utils/prisma';
import Redis from 'ioredis';

interface MFASetupResult {
  success: boolean;
  secret?: string;
  backupCodes?: string[];
  qrCodeUrl?: string;
  manualEntryKey?: string;
  error?: string;
}

interface MFAVerifyResult {
  success: boolean;
  valid?: boolean;
  backupCodeUsed?: boolean;
  remainingBackupCodes?: number;
  error?: string;
}

interface MFASession {
  userId: string;
  sessionId: string;
  mfaRequired: boolean;
  mfaMethods: Array<'totp' | 'backup_code' | 'email' | 'sms'>;
  totpVerified?: boolean;
  verifiedAt?: Date;
  attempts: number;
  lastAttempt?: Date;
  lockedUntil?: Date;
}

export class MFAService {
  private redis: Redis;
  private maxAttempts: number;
  private lockoutDuration: number;
  private backupCodeCount: number;

  constructor(redis: Redis) {
    this.redis = redis;
    this.maxAttempts = parseInt(process.env.MFA_MAX_ATTEMPTS || '3');
    this.lockoutDuration = parseInt(process.env.MFA_LOCKOUT_DURATION || '900'); // 15 minutes
    this.backupCodeCount = parseInt(process.env.MFA_BACKUP_CODE_COUNT || '10');
  }

  async setupMFA(
    userId: string,
    issuer: string = 'CLMS',
  ): Promise<MFASetupResult> {
    try {
      // Check if MFA is already set up
      const existingMFA = await prisma.userMFA.findFirst({
        where: { userId, isActive: true },
      });

      if (existingMFA) {
        return {
          success: false,
          error: 'MFA is already set up for this user',
        };
      }

      // Generate TOTP secret
      const secret = speakeasy.generateSecret({
        name: `${issuer} (${userId})`,
        issuer: issuer,
        length: 32,
      });

      // Generate backup codes
      const backupCodes = this.generateBackupCodes();

      // Generate QR code
      const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url || '');

      // Store MFA setup data temporarily (not activated yet)
      const tempKey = `mfa_setup:${userId}`;
      await this.redis.hset(tempKey, {
        secret: secret.base32,
        backupCodes: JSON.stringify(backupCodes),
        createdAt: new Date().toISOString(),
      });
      await this.redis.expire(tempKey, 600); // 10 minutes to complete setup

      logger.info('MFA setup initiated', {
        userId,
        issuer,
        backupCodeCount: backupCodes.length,
      });

      return {
        success: true,
        secret: secret.base32,
        backupCodes,
        qrCodeUrl,
        manualEntryKey: secret.base32,
      };
    } catch (error) {
      logger.error('Failed to setup MFA', {
        error: (error as Error).message,
        userId,
      });
      return {
        success: false,
        error: 'Failed to setup MFA',
      };
    }
  }

  async verifyAndEnableMFA(
    userId: string,
    token: string,
    backupCodes: string[],
  ): Promise<MFAVerifyResult> {
    try {
      // Get temporary MFA setup data
      const tempKey = `mfa_setup:${userId}`;
      const setupData = await this.redis.hgetall(tempKey);

      if (!setupData || !setupData.secret) {
        return {
          success: false,
          error: 'MFA setup not found or expired',
        };
      }

      // Verify the TOTP token
      const verified = speakeasy.totp.verify({
        secret: setupData.secret,
        encoding: 'base32',
        token: token,
        window: 2, // Allow 2 time windows before and after
        time: Math.floor(Date.now() / 1000),
      });

      if (!verified) {
        return {
          success: false,
          error: 'Invalid verification code',
        };
      }

      // Save MFA settings to database
      await prisma.userMFA.create({
        data: {
          userId,
          secret: setupData.secret,
          backupCodes: JSON.stringify(backupCodes),
          isActive: true,
          enabledAt: new Date(),
          lastUsed: new Date(),
        },
      });

      // Remove temporary data
      await this.redis.del(tempKey);

      // Log successful MFA enablement
      await prisma.audit_logs.create({
        data: {
          userId,
          action: 'mfa_enabled',
          details: {
            method: 'totp',
            backupCodeCount: backupCodes.length,
          },
          timestamp: new Date(),
        },
      });

      logger.info('MFA enabled successfully', {
        userId,
        method: 'totp',
        backupCodeCount: backupCodes.length,
      });

      return {
        success: true,
        valid: true,
        remainingBackupCodes: backupCodes.length,
      };
    } catch (error) {
      logger.error('Failed to verify and enable MFA', {
        error: (error as Error).message,
        userId,
      });
      return {
        success: false,
        error: 'Failed to enable MFA',
      };
    }
  }

  async verifyMFAToken(
    userId: string,
    sessionId: string,
    token: string,
    isBackupCode: boolean = false,
  ): Promise<MFAVerifyResult> {
    try {
      // Check MFA session status
      const mfaSession = await this.getMFASession(sessionId);
      if (!mfaSession) {
        return {
          success: false,
          error: 'MFA session not found',
        };
      }

      // Check if user is locked out
      if (mfaSession.lockedUntil && mfaSession.lockedUntil > new Date()) {
        return {
          success: false,
          error: `Account locked. Try again after ${mfaSession.lockedUntil.toLocaleString()}`,
        };
      }

      // Get user's MFA settings
      const userMFA = await prisma.userMFA.findFirst({
        where: { userId, isActive: true },
      });

      if (!userMFA) {
        return {
          success: false,
          error: 'MFA not set up for this user',
        };
      }

      let verified = false;
      let backupCodeUsed = false;
      let remainingBackupCodes = 0;

      if (isBackupCode) {
        // Verify backup code
        const backupCodes = JSON.parse(userMFA.backupCodes || '[]');
        const codeIndex = backupCodes.indexOf(token);

        if (codeIndex !== -1) {
          // Remove used backup code
          backupCodes.splice(codeIndex, 1);
          remainingBackupCodes = backupCodes.length;

          // Update backup codes in database
          await prisma.userMFA.update({
            where: { id: userMFA.id },
            data: {
              backupCodes: JSON.stringify(backupCodes),
              lastUsed: new Date(),
            },
          });

          verified = true;
          backupCodeUsed = true;

          logger.warn('Backup code used for MFA', {
            userId,
            sessionId: sessionId.substring(0, 8) + '...',
            remainingBackupCodes,
          });
        }
      } else {
        // Verify TOTP token
        verified = speakeasy.totp.verify({
          secret: userMFA.secret,
          encoding: 'base32',
          token: token,
          window: 2,
          time: Math.floor(Date.now() / 1000),
        });

        if (verified) {
          // Update last used timestamp
          await prisma.userMFA.update({
            where: { id: userMFA.id },
            data: { lastUsed: new Date() },
          });
        }
      }

      if (!verified) {
        // Increment failed attempts
        await this.recordMFAFailure(sessionId, mfaSession);
        return {
          success: false,
          error: 'Invalid verification code',
          remainingBackupCodes: JSON.parse(userMFA.backupCodes || '[]').length,
        };
      }

      // Mark MFA as verified for this session
      await this.markMFAVerified(sessionId);

      // Log successful MFA verification
      await prisma.audit_logs.create({
        data: {
          userId,
          action: 'mfa_verified',
          details: {
            sessionId,
            method: backupCodeUsed ? 'backup_code' : 'totp',
            backupCodeUsed,
          },
          timestamp: new Date(),
        },
      });

      logger.info('MFA verification successful', {
        userId,
        sessionId: sessionId.substring(0, 8) + '...',
        method: backupCodeUsed ? 'backup_code' : 'totp',
      });

      return {
        success: true,
        valid: true,
        backupCodeUsed,
        remainingBackupCodes,
      };
    } catch (error) {
      logger.error('Failed to verify MFA token', {
        error: (error as Error).message,
        userId,
        sessionId: sessionId.substring(0, 8) + '...',
      });
      return {
        success: false,
        error: 'Failed to verify MFA token',
      };
    }
  }

  async disableMFA(
    userId: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Verify user's password before disabling MFA
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      const bcrypt = require('bcryptjs');
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return {
          success: false,
          error: 'Invalid password',
        };
      }

      // Deactivate MFA
      await prisma.userMFA.updateMany({
        where: { userId },
        data: {
          isActive: false,
          disabledAt: new Date(),
        },
      });

      // Log MFA disablement
      await prisma.audit_logs.create({
        data: {
          userId,
          action: 'mfa_disabled',
          details: {
            method: 'password_verification',
          },
          timestamp: new Date(),
        },
      });

      logger.info('MFA disabled', {
        userId,
        method: 'password_verification',
      });

      return {
        success: true,
      };
    } catch (error) {
      logger.error('Failed to disable MFA', {
        error: (error as Error).message,
        userId,
      });
      return {
        success: false,
        error: 'Failed to disable MFA',
      };
    }
  }

  async regenerateBackupCodes(
    userId: string,
    password: string,
  ): Promise<{ success: boolean; backupCodes?: string[]; error?: string }> {
    try {
      // Verify user's password
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      const bcrypt = require('bcryptjs');
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return {
          success: false,
          error: 'Invalid password',
        };
      }

      // Generate new backup codes
      const newBackupCodes = this.generateBackupCodes();

      // Update backup codes in database
      await prisma.userMFA.updateMany({
        where: { userId, isActive: true },
        data: {
          backupCodes: JSON.stringify(newBackupCodes),
          backupCodesRegeneratedAt: new Date(),
        },
      });

      // Log backup codes regeneration
      await prisma.audit_logs.create({
        data: {
          userId,
          action: 'mfa_backup_codes_regenerated',
          details: {
            newCodeCount: newBackupCodes.length,
          },
          timestamp: new Date(),
        },
      });

      logger.info('MFA backup codes regenerated', {
        userId,
        newCodeCount: newBackupCodes.length,
      });

      return {
        success: true,
        backupCodes: newBackupCodes,
      };
    } catch (error) {
      logger.error('Failed to regenerate backup codes', {
        error: (error as Error).message,
        userId,
      });
      return {
        success: false,
        error: 'Failed to regenerate backup codes',
      };
    }
  }

  async isMFAEnabled(userId: string): Promise<boolean> {
    try {
      const userMFA = await prisma.userMFA.findFirst({
        where: { userId, isActive: true },
      });
      return !!userMFA;
    } catch (error) {
      logger.error('Failed to check MFA status', {
        error: (error as Error).message,
        userId,
      });
      return false;
    }
  }

  async isMFAVerified(sessionId: string): Promise<boolean> {
    try {
      const mfaSession = await this.getMFASession(sessionId);
      return mfaSession?.totpVerified || false;
    } catch (error) {
      logger.error('Failed to check MFA verification status', {
        error: (error as Error).message,
        sessionId: sessionId.substring(0, 8) + '...',
      });
      return false;
    }
  }

  async requireMFAForSession(userId: string, sessionId: string): Promise<void> {
    try {
      const mfaSession: MFASession = {
        userId,
        sessionId,
        mfaRequired: await this.isMFAEnabled(userId),
        mfaMethods: ['totp', 'backup_code'],
        totpVerified: false,
        attempts: 0,
      };

      const sessionKey = `mfa_session:${sessionId}`;
      await this.redis.hset(sessionKey, {
        ...mfaSession,
        lastAttempt: mfaSession.lastAttempt?.toISOString(),
        lockedUntil: mfaSession.lockedUntil?.toISOString(),
      });
      await this.redis.expire(sessionKey, 3600); // 1 hour
    } catch (error) {
      logger.error('Failed to require MFA for session', {
        error: (error as Error).message,
        sessionId: sessionId.substring(0, 8) + '...',
      });
    }
  }

  private async getMFASession(sessionId: string): Promise<MFASession | null> {
    try {
      const sessionKey = `mfa_session:${sessionId}`;
      const data = await this.redis.hgetall(sessionKey);

      if (!data || Object.keys(data).length === 0) {
        return null;
      }

      return {
        userId: data.userId,
        sessionId: data.sessionId,
        mfaRequired: data.mfaRequired === 'true',
        mfaMethods: JSON.parse(data.mfaMethods || '[]'),
        totpVerified: data.totpVerified === 'true',
        verifiedAt: data.verifiedAt ? new Date(data.verifiedAt) : undefined,
        attempts: parseInt(data.attempts || '0'),
        lastAttempt: data.lastAttempt ? new Date(data.lastAttempt) : undefined,
        lockedUntil: data.lockedUntil ? new Date(data.lockedUntil) : undefined,
      };
    } catch (error) {
      logger.error('Failed to get MFA session', {
        error: (error as Error).message,
        sessionId: sessionId.substring(0, 8) + '...',
      });
      return null;
    }
  }

  private async recordMFAFailure(
    sessionId: string,
    mfaSession: MFASession,
  ): Promise<void> {
    try {
      mfaSession.attempts += 1;
      mfaSession.lastAttempt = new Date();

      if (mfaSession.attempts >= this.maxAttempts) {
        mfaSession.lockedUntil = new Date(
          Date.now() + this.lockoutDuration * 1000,
        );
      }

      const sessionKey = `mfa_session:${sessionId}`;
      await this.redis.hset(sessionKey, {
        attempts: mfaSession.attempts.toString(),
        lastAttempt: mfaSession.lastAttempt.toISOString(),
        lockedUntil: mfaSession.lockedUntil?.toISOString(),
      });

      logger.warn('MFA verification failed', {
        sessionId: sessionId.substring(0, 8) + '...',
        attempts: mfaSession.attempts,
        lockedUntil: mfaSession.lockedUntil,
      });
    } catch (error) {
      logger.error('Failed to record MFA failure', {
        error: (error as Error).message,
        sessionId: sessionId.substring(0, 8) + '...',
      });
    }
  }

  private async markMFAVerified(sessionId: string): Promise<void> {
    try {
      const sessionKey = `mfa_session:${sessionId}`;
      await this.redis.hset(sessionKey, {
        totpVerified: 'true',
        verifiedAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to mark MFA as verified', {
        error: (error as Error).message,
        sessionId: sessionId.substring(0, 8) + '...',
      });
    }
  }

  private generateBackupCodes(): string[] {
    const codes = [];
    for (let i = 0; i < this.backupCodeCount; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  // Get MFA statistics
  async getMFAStats(): Promise<{
    totalEnabled: number;
    enabledToday: number;
    verificationAttempts: number;
    successfulVerifications: number;
  }> {
    try {
      const totalEnabled = await prisma.userMFA.count({
        where: { isActive: true },
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const enabledToday = await prisma.userMFA.count({
        where: {
          isActive: true,
          enabledAt: {
            gte: today,
          },
        },
      });

      const verificationAttempts = await prisma.audit_logs.count({
        where: {
          action: 'mfa_verified',
          timestamp: {
            gte: today,
          },
        },
      });

      const successfulVerifications = verificationAttempts; // All logs are successful verifications

      return {
        totalEnabled,
        enabledToday,
        verificationAttempts,
        successfulVerifications,
      };
    } catch (error) {
      logger.error('Failed to get MFA stats', {
        error: (error as Error).message,
      });
      return {
        totalEnabled: 0,
        enabledToday: 0,
        verificationAttempts: 0,
        successfulVerifications: 0,
      };
    }
  }
}
