import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { logger } from '@/utils/logger';
import { prisma } from '@/utils/prisma';

// JWT payload interface
export interface JWTPayload {
  userId: string;
  username: string;
  role: string;
}

// Login result interface
export interface LoginResult {
  success: boolean;
  token?: string;
  user?: {
    id: string;
    username: string;
    role: string;
  };
  error?: string;
}

export interface UserSummary {
  id: string;
  username: string;
  role: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

// Authentication service class
export class AuthService {
  private jwtSecret: string;
  private jwtExpiration: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'default-secret-key';
    this.jwtExpiration = process.env.JWT_EXPIRATION || '24h';
  }

  // Authenticate user and return JWT token
  async login(username: string, password: string): Promise<LoginResult> {
    try {
      // Find user by username
      const user = await prisma.user.findUnique({
        where: { username },
      });

      if (!user) {
        logger.warn(`Login attempt with non-existent username: ${username}`);
        return {
          success: false,
          error: 'Invalid username or password',
        };
      }

      // Check if user is active
      if (!user.isActive) {
        logger.warn(`Login attempt with inactive user: ${username}`);
        return {
          success: false,
          error: 'Account is disabled',
        };
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        logger.warn(
          `Login attempt with invalid password for user: ${username}`,
        );
        return {
          success: false,
          error: 'Invalid username or password',
        };
      }

      // Create JWT payload
      const payload: JWTPayload = {
        userId: user.id,
        username: user.username,
        role: user.role,
      };

      // Generate JWT token
      const token = jwt.sign(payload, this.jwtSecret, {
        expiresIn: this.jwtExpiration,
      } as jwt.SignOptions);

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      logger.info(`User logged in successfully: ${username}`);

      return {
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
      };
    } catch (error) {
      logger.error('Login error', {
        error: (error as Error).message,
        username,
      });
      return {
        success: false,
        error: 'An error occurred during login',
      };
    }
  }

  // Verify JWT token
  verifyToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as JWTPayload;
      return decoded;
    } catch (error) {
      logger.warn('Invalid JWT token', { error: (error as Error).message });
      return null;
    }
  }

  // Hash password
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  // Create a new user
  async createUser(userData: {
    username: string;
    password: string;
    role: string;
    isActive?: boolean;
  }): Promise<{ success: boolean; user?: UserSummary; error?: string }> {
    try {
      // Check if username already exists
      const existingUser = await prisma.user.findUnique({
        where: { username: userData.username },
      });

      if (existingUser) {
        return {
          success: false,
          error: 'Username already exists',
        };
      }

      // Hash password
      const hashedPassword = await this.hashPassword(userData.password);

      // Create user
      const user = await prisma.user.create({
        data: {
          username: userData.username,
          password: hashedPassword,
          role: userData.role,
          isActive: userData.isActive !== undefined ? userData.isActive : true,
        },
      });

      logger.info(`New user created: ${userData.username}`);

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          isActive: user.isActive,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
        },
      };
    } catch (error) {
      logger.error('Create user error', {
        error: (error as Error).message,
        username: userData.username,
      });
      return {
        success: false,
        error: 'An error occurred while creating the user',
      };
    }
  }

  // Update user password
  async updatePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Find user
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      // Verify current password
      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password,
      );
      if (!isPasswordValid) {
        return {
          success: false,
          error: 'Current password is incorrect',
        };
      }

      // Hash new password
      const hashedPassword = await this.hashPassword(newPassword);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      logger.info(`Password updated for user: ${user.username}`);

      return {
        success: true,
      };
    } catch (error) {
      logger.error('Update password error', {
        error: (error as Error).message,
        userId,
      });
      return {
        success: false,
        error: 'An error occurred while updating the password',
      };
    }
  }

  // Reset user password (admin function)
  async resetPassword(
    userId: string,
    newPassword: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Find user
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      // Hash new password
      const hashedPassword = await this.hashPassword(newPassword);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      logger.info(`Password reset for user: ${user.username}`);

      return {
        success: true,
      };
    } catch (error) {
      logger.error('Reset password error', {
        error: (error as Error).message,
        userId,
      });
      return {
        success: false,
        error: 'An error occurred while resetting the password',
      };
    }
  }

  // Get all users
  async getUsers(): Promise<UserSummary[]> {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          username: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return users.map(user => ({
        id: user.id,
        username: user.username,
        role: user.role,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      }));
    } catch (error) {
      logger.error('Get users error', { error: (error as Error).message });
      throw error;
    }
  }

  // Get user by ID
  async getUserById(userId: string): Promise<UserSummary | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
      });

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        username: user.username,
        role: user.role,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      };
    } catch (error) {
      logger.error('Get user by ID error', {
        error: (error as Error).message,
        userId,
      });
      throw error;
    }
  }

  // Update user
  async updateUser(
    userId: string,
    updateData: {
      username?: string;
      role?: string;
      isActive?: boolean;
    },
  ): Promise<{ success: boolean; user?: UserSummary; error?: string }> {
    try {
      // Check if username is being updated and if it already exists
      if (updateData.username) {
        const existingUser = await prisma.user.findFirst({
          where: {
            username: updateData.username,
            id: { not: userId },
          },
        });

        if (existingUser) {
          return {
            success: false,
            error: 'Username already exists',
          };
        }
      }

      // Update user
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          username: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
      });

      logger.info(`User updated: ${updatedUser.username}`);

      return {
        success: true,
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          role: updatedUser.role,
          isActive: updatedUser.isActive,
          lastLoginAt: updatedUser.lastLoginAt,
          createdAt: updatedUser.createdAt,
        },
      };
    } catch (error) {
      logger.error('Update user error', {
        error: (error as Error).message,
        userId,
      });
      return {
        success: false,
        error: 'An error occurred while updating the user',
      };
    }
  }

  // Delete user
  async deleteUser(
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      // Delete user
      await prisma.user.delete({
        where: { id: userId },
      });

      logger.info(`User deleted: ${user.username}`);

      return {
        success: true,
      };
    } catch (error) {
      logger.error('Delete user error', {
        error: (error as Error).message,
        userId,
      });
      return {
        success: false,
        error: 'An error occurred while deleting the user',
      };
    }
  }
}

// Create and export singleton instance
export const authService = new AuthService();
export default authService;
