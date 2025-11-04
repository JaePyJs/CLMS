import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  password: string;
  email?: string;
  full_name?: string;
  role?: 'ADMIN' | 'LIBRARIAN' | 'ASSISTANT';
}

export interface TokenPayload {
  userId: string;
  username: string;
  role: string;
}

export interface AuthResponse {
  user: {
    id: string;
    username: string;
    email: string | null;
    full_name: string | null;
    role: string;
    is_active: boolean;
    last_login_at: Date | null;
    created_at: Date;
  };
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class AuthService {
  private static generateTokens(payload: TokenPayload): { accessToken: string; refreshToken: string; expiresIn: number } {
    const expiresIn = 7 * 24 * 60 * 60; // 7 days in seconds
    const expiresInStr = typeof env.JWT_EXPIRES_IN === 'string' ? env.JWT_EXPIRES_IN : '7d';
    const refreshExpiresInStr = typeof env.JWT_REFRESH_EXPIRES_IN === 'string' ? env.JWT_REFRESH_EXPIRES_IN : '30d';
    const jwtSecret = String(env.JWT_SECRET);
    const jwtRefreshSecret = String(env.JWT_REFRESH_SECRET);

    const accessToken = jwt.sign(payload, jwtSecret, {
      expiresIn: expiresInStr as string,
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(payload, jwtRefreshSecret, {
      expiresIn: refreshExpiresInStr as string,
    } as jwt.SignOptions);

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  private static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, env.BCRYPT_ROUNDS);
  }

  private static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  public static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const { username, password } = credentials;

      logger.info('Login attempt', { username, ip: 'server' });

      // Find user by username
      const user = await prisma.users.findUnique({
        where: { username },
        select: {
          id: true,
          username: true,
          password: true,
          email: true,
          first_name: true,
          last_name: true,
          full_name: true,
          role: true,
          is_active: true,
          last_login_at: true,
          created_at: true,
        },
      });

      if (!user) {
        logger.warn('Login failed: user not found', { username });
        throw new Error('Invalid credentials');
      }

      if (!user.is_active) {
        logger.warn('Login failed: user account disabled', { username });
        throw new Error('Account is disabled');
      }

      // Verify password
      const isPasswordValid = await this.verifyPassword(password, user.password);
      if (!isPasswordValid) {
        logger.warn('Login failed: invalid password', { username });
        throw new Error('Invalid credentials');
      }

      // Update last login timestamp
      await prisma.users.update({
        where: { id: user.id },
        data: { last_login_at: new Date() },
      });

      // Generate tokens
      const tokenPayload: TokenPayload = {
        userId: user.id,
        username: user.username,
        role: user.role,
      };

      const tokens = this.generateTokens(tokenPayload);

      logger.info('Login successful', { 
        username: user.username, 
        userId: user.id,
        role: user.role 
      });

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          is_active: user.is_active,
          last_login_at: user.last_login_at,
          created_at: user.created_at,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      };
    } catch (error) {
      logger.error('Login error', { 
        username: credentials.username, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  public static async register(data: RegisterData): Promise<AuthResponse> {
    try {
      const { username, password, email, full_name, role = 'LIBRARIAN' } = data;

      logger.info('Registration attempt', { username, email, role });

      // Check if user already exists
      const existingUser = await prisma.users.findFirst({
        where: {
          OR: [
            { username },
            ...(email ? [{ email }] : []),
          ],
        },
      });

      if (existingUser) {
        logger.warn('Registration failed: user already exists', { username, email });
        throw new Error('User with this username or email already exists');
      }

      // Hash password
      const hashedPassword = await this.hashPassword(password);

      // Create user
      const user = await prisma.users.create({
        data: {
          username,
          password: hashedPassword,
          email: email ?? null,
          full_name: full_name ?? null,
          role,
          is_active: true,
        },
        select: {
          id: true,
          username: true,
          email: true,
          full_name: true,
          role: true,
          is_active: true,
          last_login_at: true,
          created_at: true,
        },
      });

      // Generate tokens
      const tokenPayload: TokenPayload = {
        userId: user.id,
        username: user.username,
        role: user.role,
      };

      const tokens = this.generateTokens(tokenPayload);

      logger.info('Registration successful', { 
        username: user.username, 
        userId: user.id,
        role: user.role 
      });

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          is_active: user.is_active,
          last_login_at: user.last_login_at,
          created_at: user.created_at,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      };
    } catch (error) {
      logger.error('Registration error', { 
        username: data.username, 
        email: data.email,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  public static async refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as TokenPayload;

      // Get current user data
      const user = await prisma.users.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          username: true,
          role: true,
          is_active: true,
        },
      });

      if (!user || !user.is_active) {
        throw new Error('Invalid refresh token');
      }

      // Generate new access token
      const tokenPayload: TokenPayload = {
        userId: user.id,
        username: user.username,
        role: user.role,
      };

      const expiresIn = 7 * 24 * 60 * 60; // 7 days in seconds
      const expiresInStr = typeof env.JWT_EXPIRES_IN === 'string' ? env.JWT_EXPIRES_IN : '7d';
      const jwtSecret = String(env.JWT_SECRET);

      const accessToken = jwt.sign(tokenPayload, jwtSecret, {
        expiresIn: expiresInStr as string,
      } as jwt.SignOptions);

      logger.info('Token refreshed', { userId: user.id, username: user.username });

      return {
        accessToken,
        expiresIn,
      };
    } catch (error) {
      logger.error('Token refresh error', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new Error('Invalid refresh token');
    }
  }

  public static async getCurrentUser(userId: string) {
    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          email: true,
          full_name: true,
          role: true,
          is_active: true,
          last_login_at: true,
          created_at: true,
          permissions: true,
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      logger.error('Get current user error', { userId, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  public static async logout(userId: string): Promise<void> {
    try {
      logger.info('Logout', { userId });
      // In a more sophisticated implementation, you might want to blacklist the token
      // For now, we just log the logout event
    } catch (error) {
      logger.error('Logout error', { userId, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  public static verifyToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
      return decoded;
    } catch (error) {
      logger.error('Token verification failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new Error('Invalid token');
    }
  }
}