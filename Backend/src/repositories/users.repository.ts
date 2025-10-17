import { Prisma, users, users_role } from '@prisma/client';
import { prisma } from '@/utils/prisma';
import { logger } from '@/utils/logger';
import { BaseRepository } from './base.repository';

/**
 * Users Repository
 * 
 * Extends BaseRepository to provide user-specific operations with flexible
 * ID handling for username (external user identifier).
 */
export class UsersRepository extends BaseRepository<
  users,
  Prisma.usersCreateInput,
  Prisma.usersUpdateInput
> {
  constructor() {
    super(prisma, 'users', 'username');
  }

  /**
   * Find a user by username
   */
  async findByUsername(username: string): Promise<users | null> {
    try {
      const user = await this.getModel().findUnique({
        where: { username },
      });

      return user;
    } catch (error) {
      this.handleDatabaseError(error, 'findByUsername', { username });
    }
  }

  /**
   * Find a user by email
   */
  async findByEmail(email: string): Promise<users | null> {
    try {
      const user = await this.getModel().findUnique({
        where: { email },
      });

      return user;
    } catch (error) {
      this.handleDatabaseError(error, 'findByEmail', { email });
    }
  }

  /**
   * Create a new user with automatic field population
   */
  async createUser(data: {
    username: string;
    password: string;
    email?: string;
    full_name?: string;
    role?: users_role;
    permissions?: string[];
  }): Promise<users> {
    try {
      const processedData = this.populateMissingFields({
        username: data.username.trim(),
        password: data.password,
        email: data.email?.trim() || null,
        full_name: data.full_name?.trim() || null,
        role: data.role || 'LIBRARIAN',
        permissions: data.permissions || [],
        is_active: true,
        last_login_at: null,
      });

      const user = await this.getModel().create({
        data: processedData,
      });

      logger.info('User created successfully', {
        id: user.id,
        username: user.username,
        role: user.role,
      });

      return user;
    } catch (error) {
      // Handle unique constraint violation for username or email
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = (error.meta?.target as any)?.find((field: string) => 
          field.includes('username') || field.includes('email')
        );
        
        if (target) {
          if (target.includes('username')) {
            throw new Error(`Username '${data.username}' already exists`);
          }
          if (target.includes('email')) {
            throw new Error(`Email '${data.email}' already exists`);
          }
        }
      }

      this.handleDatabaseError(error, 'createUser', {
        username: data.username,
        email: data.email,
      });
    }
  }

  /**
   * Upsert a user by username (ideal for imports)
   */
  async upsertByUsername(
    username: string,
    data: {
      password?: string;
      email?: string;
      full_name?: string;
      role?: users_role;
      permissions?: string[];
      is_active?: boolean;
    }
  ): Promise<users> {
    try {
      const whereClause = { username };

      const createData = this.populateMissingFields({
        username: username.trim(),
        password: data.password || '',
        email: data.email?.trim() || null,
        full_name: data.full_name?.trim() || null,
        role: data.role || 'LIBRARIAN',
        permissions: data.permissions || [],
        is_active: data.is_active !== undefined ? data.is_active : true,
        last_login_at: null,
      });

      const updateData = {
        ...(data.password !== undefined && { password: data.password }),
        ...(data.email !== undefined && { email: data.email?.trim() || null }),
        ...(data.full_name !== undefined && { full_name: data.full_name?.trim() || null }),
        ...(data.role !== undefined && { role: data.role }),
        ...(data.permissions !== undefined && { permissions: data.permissions }),
        ...(data.is_active !== undefined && { is_active: data.is_active }),
        updated_at: new Date(),
      };

      const user = await this.getModel().upsert({
        where: whereClause,
        create: createData,
        update: updateData,
      });

      const isCreated = user.created_at.getTime() === user.updated_at.getTime();
      
      logger.info(`User ${isCreated ? 'created' : 'updated'} successfully via upsert`, {
        id: user.id,
        username: user.username,
        action: isCreated ? 'created' : 'updated',
      });

      return user;
    } catch (error) {
      this.handleDatabaseError(error, 'upsertByUsername', {
        username,
        email: data.email,
      });
    }
  }

  /**
   * Get users with flexible filtering options
   */
  async getUsers(options: {
    role?: users_role;
    isActive?: boolean;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: 'username' | 'email' | 'full_name' | 'role' | 'created_at' | 'last_login_at';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{
    users: users[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    try {
      const {
        role,
        isActive,
        page = 1,
        limit = 50,
        search,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = options;

      const skip = (page - 1) * limit;
      const where: Prisma.usersWhereInput = {};

      // Apply filters
      if (role) {
        where.role = role;
      }

      if (isActive !== undefined) {
        where.is_active = isActive;
      }

      // Apply search across multiple fields
      if (search) {
        where.OR = [
          { username: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { full_name: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [users, total] = await Promise.all([
        this.getModel().findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          select: {
            id: true,
            username: true,
            email: true,
            full_name: true,
            role: true,
            permissions: true,
            is_active: true,
            last_login_at: true,
            created_at: true,
            updated_at: true,
          },
        }),
        this.getModel().count({ where }),
      ]);

      return {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.handleDatabaseError(error, 'getUsers', options);
    }
  }

  /**
   * Update user password
   */
  async updatePassword(userId: string, hashedPassword: string): Promise<users | null> {
    try {
      const user = await this.getModel().update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          updated_at: new Date(),
        },
      });

      logger.info('User password updated successfully', {
        userId,
        username: user.username,
      });

      return user;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        logger.warn('Attempted to update password for non-existent user', { userId });
        return null;
      }

      this.handleDatabaseError(error, 'updatePassword', { userId });
    }
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId: string): Promise<users | null> {
    try {
      const user = await this.getModel().update({
        where: { id: userId },
        data: {
          last_login_at: new Date(),
          updated_at: new Date(),
        },
      });

      return user;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        logger.warn('Attempted to update last login for non-existent user', { userId });
        return null;
      }

      this.handleDatabaseError(error, 'updateLastLogin', { userId });
    }
  }

  /**
   * Get user statistics
   */
  async getUserStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byRole: Array<{ role: users_role; _count: number }>;
  }> {
    try {
      const [total, byRole, activeUsers] = await Promise.all([
        this.getModel().count(),
        this.getModel().groupBy({
          by: ['role'],
          _count: true,
        }),
        this.getModel().count({ where: { is_active: true } }),
      ]);

      return {
        total,
        active: activeUsers,
        inactive: total - activeUsers,
        byRole,
      };
    } catch (error) {
      this.handleDatabaseError(error, 'getUserStatistics');
    }
  }

  /**
   * Create method override to exclude sensitive fields from logging
   */
  async create(data: Prisma.usersCreateInput): Promise<users> {
    try {
      const sanitizedData = { ...data };
      delete sanitizedData.password; // Remove password from logging

      const processedData = this.populateMissingFields(data);

      const user = await this.getModel().create({
        data: processedData,
      });

      logger.info('User created successfully', {
        id: user.id,
        username: user.username,
        role: user.role,
      });

      return user;
    } catch (error) {
      logger.error(`Error creating user`, {
        error: (error as Error).message,
        username: data.username,
      });
      throw error;
    }
  }

  /**
   * Update method override to exclude sensitive fields from logging
   */
  async updateById(id: string, data: Prisma.usersUpdateInput): Promise<users | null> {
    try {
      const sanitizedData = { ...data };
      delete sanitizedData.password; // Remove password from logging

      const processedData = {
        ...sanitizedData,
        updated_at: new Date(),
      };

      const user = await this.getModel().update({
        where: { id },
        data: processedData,
      });

      logger.info('User updated successfully', {
        id,
        username: user.username,
      });

      return user;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        logger.warn(`Attempted to update non-existent user`, { id });
        return null;
      }

      logger.error(`Error updating user`, {
        error: (error as Error).message,
        id,
      });
      throw error;
    }
  }
}

// Export repository instance
export const usersRepository = new UsersRepository();