import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { logger } from '@/utils/logger';
import { PrismaClient } from '@prisma/client';

// Initialize Prisma Client directly
const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'info', 'warn']
      : ['error'],
});

// JWT payload interface
export interface JWTPayload {
  id: string;
  userId?: string;
  username: string;
  role: string;
  exp?: number;
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
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
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
      const user = await prisma.users.findUnique({
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
      if (!user.is_active) {
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
        id: user.id,
        username: user.username,
        role: user.role,
      };

      // Generate JWT token
      const token = jwt.sign(payload, this.jwtSecret, {
        expiresIn: this.jwtExpiration,
      } as jwt.SignOptions);

      // Update last login
      await prisma.users.update({
        where: { id: user.id },
        data: {
          id: crypto.randomUUID(),
          updated_at: new Date(),
          last_login_at: new Date(),
        },
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
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
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
      const existingUser = await prisma.users.findUnique({
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
      const id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const user = await prisma.users.create({
        data: {
          id: id,
          username: userData.username,
          password: hashedPassword,
          role: userData.role as any,
          is_active: userData.isActive !== undefined ? userData.isActive : true,
          email: null,
          full_name: null,
          permissions: {},
          updated_at: new Date(),
        },
      });

      logger.info(`New user created: ${userData.username}`);

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          is_active: user.is_active,
          last_login_at: user.last_login_at,
          created_at: user.created_at,
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
    id: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Find user
      const user = await prisma.users.findUnique({
        where: { id: id },
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
      await prisma.users.update({
        where: { id: id },
        data: {
          id: crypto.randomUUID(),
          updated_at: new Date(),
          password: hashedPassword,
        },
      });

      logger.info(`Password updated for user: ${user.username}`);

      return {
        success: true,
      };
    } catch (error) {
      logger.error('Update password error', {
        error: (error as Error).message,
        id,
      });
      return {
        success: false,
        error: 'An error occurred while updating the password',
      };
    }
  }

  // Reset user password (admin function)
  async resetPassword(
    id: string,
    newPassword: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Find user
      const user = await prisma.users.findUnique({
        where: { id: id },
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
      await prisma.users.update({
        where: { id: id },
        data: {
          id: crypto.randomUUID(),
          updated_at: new Date(),
          password: hashedPassword,
        },
      });

      logger.info(`Password reset for user: ${user.username}`);

      return {
        success: true,
      };
    } catch (error) {
      logger.error('Reset password error', {
        error: (error as Error).message,
        id,
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
      const users = await prisma.users.findMany({
        select: {
          id: true,
          username: true,
          role: true,
          is_active: true,
          last_login_at: true,
          created_at: true,
        },
        orderBy: { created_at: 'desc' },
      });

      return users.map(user => ({
        id: user.id,
        username: user.username,
        role: user.role,
        is_active: user.is_active,
        last_login_at: user.last_login_at,
        created_at: user.created_at,
      }));
    } catch (error) {
      logger.error('Get users error', { error: (error as Error).message });
      throw error;
    }
  }

  // Get user by ID
  async getUserById(id: string): Promise<UserSummary | null> {
    try {
      const user = await prisma.users.findUnique({
        where: { id: id },
        select: {
          id: true,
          username: true,
          role: true,
          is_active: true,
          last_login_at: true,
          created_at: true,
        },
      });

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        username: user.username,
        role: user.role,
        is_active: user.is_active,
        last_login_at: user.last_login_at,
        created_at: user.created_at,
      };
    } catch (error) {
      logger.error('Get user by ID error', {
        error: (error as Error).message,
        id,
      });
      throw error;
    }
  }

  // Update user
  async updateUser(
    id: string,
    updateData: {
      username?: string;
      role?: string;
      isActive?: boolean;
    },
  ): Promise<{ success: boolean; user?: UserSummary; error?: string }> {
    try {
      // Check if username is being updated and if it already exists
      if (updateData.username) {
        const existingUser = await prisma.users.findFirst({
          where: {
            username: updateData.username,
            id: { not: id },
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
      const updatedUser = await prisma.users.update({
        where: { id: id },
        data: {
          username: updateData.username,
          role: updateData.role as any,
          is_active: updateData.isActive,
          updated_at: new Date(),
        },
        select: {
          id: true,
          username: true,
          role: true,
          is_active: true,
          last_login_at: true,
          created_at: true,
        },
      });

      logger.info(`User updated: ${updatedUser.username}`);

      return {
        success: true,
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          role: updatedUser.role,
          is_active: updatedUser.is_active,
          last_login_at: updatedUser.last_login_at,
          created_at: updatedUser.created_at,
        },
      };
    } catch (error) {
      logger.error('Update user error', {
        error: (error as Error).message,
        id,
      });
      return {
        success: false,
        error: 'An error occurred while updating the user',
      };
    }
  }

  // Delete user
  async deleteUser(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if user exists
      const user = await prisma.users.findUnique({
        where: { id: id },
      });

      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      // Delete user
      await prisma.users.delete({
        where: { id: id },
      });

      logger.info(`User deleted: ${user.username}`);

      return {
        success: true,
      };
    } catch (error) {
      logger.error('Delete user error', {
        error: (error as Error).message,
        id,
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
