import { PrismaClient, users_role as UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import { getRolePermissions } from '../config/permissions';

const prisma = new PrismaClient();

export interface CreateUserInput {
  username: string;
  password: string;
  email?: string;
  fullName?: string;
  role?: UserRole;
  permissions?: string[];
}

export interface UpdateUserInput {
  username?: string;
  password?: string;
  email?: string;
  fullName?: string;
  role?: UserRole;
  permissions?: string[];
  isActive?: boolean;
}

export const userService = {
  // Get all users with filtering
  async getAllUsers(filters?: {
    role?: UserRole;
    isActive?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (filters?.role) {
      where.role = filters.role;
    }

    if (filters?.is_active !== undefined) {
      where.is_active = filters.is_active;
    }

    if (filters?.search) {
      where.OR = [
        { username: { contains: filters.search } },
        { email: { contains: filters.search } },
        { full_name: { contains: filters.search } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.users.findMany({
        where,
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
        orderBy: { created_at: 'desc' },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      }),
      prisma.users.count({ where }),
    ]);

    return { users, total };
  },

  // Get user by ID
  async getUserById(id: string) {
    return await prisma.users.findUnique({
      where: { id: id },
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
    });
  },

  // Get user by username
  async getUserByUsername(username: string) {
    return await prisma.users.findUnique({
      where: { username },
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
    });
  },

  // Create new user
  async createUser(data: CreateUserInput) {
    // Check if username already exists
    const existingUser = await prisma.users.findUnique({
      where: { username: data.username },
    });

    if (existingUser) {
      throw new Error('Username already exists');
    }

    // Check if email already exists (if provided)
    if (data.email) {
      const existingEmail = await prisma.users.findUnique({
        where: { email: data.email },
      });

      if (existingEmail) {
        throw new Error('Email already exists');
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, parseInt(process.env.BCRYPT_ROUNDS || '12'));

    // Create user
    const user = await prisma.users.create({
      data: { id: crypto.randomUUID(), updated_at: new Date(), 
        username: data.username,
        password: hashedPassword,
        email: data.email,
        full_name: data.full_name,
        role: data.role || UserRole.LIBRARIAN,
        permissions: data.permissions || [],
      },
      select: {
        id: true,
        username: true,
        email: true,
        full_name: true,
        role: true,
        permissions: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
    });

    return user;
  },

  // Update user
  async updateUser(id: string, data: UpdateUserInput) {
    const updateData: any = {};

    if (data.username !== undefined) {
      // Check if new username is available
      const existing = await prisma.users.findFirst({
        where: {
          username: data.username,
          NOT: { id: id },
        },
      });

      if (existing) {
        throw new Error('Username already exists');
      }

      updateData.username = data.username;
    }

    if (data.email !== undefined) {
      // Check if new email is available
      if (data.email) {
        const existing = await prisma.users.findFirst({
          where: {
            email: data.email,
            NOT: { id: id },
          },
        });

        if (existing) {
          throw new Error('Email already exists');
        }
      }

      updateData.email = data.email;
    }

    if (data.password !== undefined) {
      updateData.password = await bcrypt.hash(data.password, parseInt(process.env.BCRYPT_ROUNDS || '12'));
    }

    if (data.full_name !== undefined) {
      updateData.full_name = data.full_name;
    }

    if (data.role !== undefined) {
      updateData.role = data.role;
    }

    if (data.permissions !== undefined) {
      updateData.permissions = data.permissions;
    }

    if (data.is_active !== undefined) {
      updateData.is_active = data.is_active;
    }

    const user = await prisma.users.update({
      where: { id: id },
      data: updateData,
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
    });

    return user;
  },

  // Delete user
  async deleteUser(id: string) {
    // Prevent deletion of last super admin
    const user = await prisma.users.findUnique({
      where: { id: id },
    });

    if (user?.role === UserRole.SUPER_ADMIN) {
      const superAdminCount = await prisma.users.count({
        where: { role: UserRole.SUPER_ADMIN, is_active: true },
      });

      if (superAdminCount <= 1) {
        throw new Error('Cannot delete the last super admin');
      }
    }

    await prisma.users.delete({
      where: { id: id },
    });

    return { success: true };
  },

  // Deactivate user
  async deactivateUser(id: string) {
    return await this.updateUser(id, { is_active: false });
  },

  // Activate user
  async activateUser(id: string) {
    return await this.updateUser(id, { is_active: true });
  },

  // Update user role
  async updateUserRole(id: string, role: UserRole) {
    // Prevent changing last super admin role
    const user = await prisma.users.findUnique({
      where: { id: id },
    });

    if (user?.role === UserRole.SUPER_ADMIN && role !== UserRole.SUPER_ADMIN) {
      const superAdminCount = await prisma.users.count({
        where: { role: UserRole.SUPER_ADMIN, is_active: true },
      });

      if (superAdminCount <= 1) {
        throw new Error('Cannot change role of the last super admin');
      }
    }

    return await this.updateUser(id, { role });
  },

  // Get user permissions
  async getUserPermissions(id: string) {
    const user = await prisma.users.findUnique({
      where: { id: id },
      select: {
        role: true,
        permissions: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const rolePermissions = getRolePermissions(user.role);
    const customPermissions = (user.permissions as string[]) || [];

    return {
      role: user.role,
      rolePermissions,
      customPermissions,
      allPermissions: [...new Set([...rolePermissions, ...customPermissions])],
    };
  },

  // Update user permissions
  async updateUserPermissions(id: string, permissions: string[]) {
    return await this.updateUser(id, { permissions });
  },

  // Get user statistics
  async getUserStatistics() {
    const [total, byRole, activeUsers] = await Promise.all([
      prisma.users.count(),
      prisma.users.groupBy({
        by: ['role'],
        _count: true,
      }),
      prisma.users.count({ where: { is_active: true } }),
    ]);

    return {
      total,
      active: activeUsers,
      inactive: total - activeUsers,
      byRole,
    };
  },

  // Change password
  async changePassword(
    id: string,
    oldPassword: string,
    newPassword: string,
  ) {
    const user = await prisma.users.findUnique({
      where: { id: id },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify old password
    const isValid = await bcrypt.compare(oldPassword, user.password);
    if (!isValid) {
      throw new Error('Invalid old password');
    }

    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS || '12'));
    await prisma.users.update({
      where: { id: id },
      data: { id: crypto.randomUUID(), updated_at: new Date(),  password: hashedPassword },
    });

    return { success: true };
  },

  // Reset password (admin only)
  async resetPassword(id: string, newPassword: string) {
    const hashedPassword = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS || '12'));
    await prisma.users.update({
      where: { id: id },
      data: { id: crypto.randomUUID(), updated_at: new Date(),  password: hashedPassword },
    });

    return { success: true };
  },
};

export default userService;
