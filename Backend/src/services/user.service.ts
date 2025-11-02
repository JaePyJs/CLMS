import { users_role as UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import { getRolePermissions } from '../config/permissions';
import { UsersRepository } from '@/repositories';
import { prisma } from '@/utils/prisma';

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

// Create repository instance
const usersRepository = new UsersRepository();

export const userService = {
  // Get all users with filtering
  async getAllUsers(filters?: {
    role?: UserRole;
    isActive?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const page = filters?.offset ? Math.floor(filters.offset / (filters?.limit || 50)) + 1 : 1;
    const limit = filters?.limit || 50;

    const getUsersParams: any = {
      page,
      limit,
      sortBy: 'created_at',
      sortOrder: 'desc',
    };

    if (filters?.role !== undefined) {
      getUsersParams.role = filters.role;
    }
    if (filters?.isActive !== undefined) {
      getUsersParams.isActive = filters.isActive;
    }
    if (filters?.search !== undefined) {
      getUsersParams.search = filters.search;
    }

    const result = await usersRepository.getUsers(getUsersParams);

    return {
      users: result.users,
      total: result.pagination.total
    };
  },

  // Get user by ID
  async getUserById(id: string) {
    return await usersRepository.findById(id);
  },

  // Get user by username
  async getUserByUsername(username: string) {
    return await usersRepository.findByUsername(username);
  },

  // Create new user
  async createUser(data: CreateUserInput) {
    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, parseInt(process.env.BCRYPT_ROUNDS || '12'));

    // Create user using repository
    const createUserData: any = {
      username: data.username,
      password: hashedPassword,
      role: data.role || UserRole.LIBRARIAN,
      permissions: data.permissions || [],
    };

    if (data.email !== undefined) {
      createUserData.email = data.email;
    }
    if (data.fullName !== undefined) {
      createUserData.full_name = data.fullName;
    }

    const user = await usersRepository.createUser(createUserData);

    return user;
  },

  // Update user
  async updateUser(id: string, data: UpdateUserInput) {
    const updateData: any = {};

    if (data.username !== undefined) {
      // Check if new username is available
      const existing = await usersRepository.findByUsername(data.username);
      if (existing && existing.id !== id) {
        throw new Error('Username already exists');
      }
      updateData.username = data.username;
    }

    if (data.email !== undefined) {
      // Check if new email is available
      if (data.email) {
        const existing = await usersRepository.findByEmail(data.email);
        if (existing && existing.id !== id) {
          throw new Error('Email already exists');
        }
      }
      updateData.email = data.email;
    }

    if (data.password !== undefined) {
      updateData.password = await bcrypt.hash(data.password, parseInt(process.env.BCRYPT_ROUNDS || '12'));
    }

    if (data.fullName !== undefined) {
      updateData.full_name = data.fullName;
    }

    if (data.role !== undefined) {
      updateData.role = data.role;
    }

    if (data.permissions !== undefined) {
      updateData.permissions = data.permissions;
    }

    if (data.isActive !== undefined) {
      updateData.is_active = data.isActive;
    }

    const user = await usersRepository.updateById(id, updateData);

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  },

  // Delete user
  async deleteUser(id: string) {
    // Prevent deletion of last super admin
    const user = await usersRepository.findById(id);

    if (!user) {
      throw new Error('User not found');
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      const stats = await usersRepository.getUserStatistics();
      const superAdminCount = stats.byRole.find(r => r.role === UserRole.SUPER_ADMIN)?._count || 0;

      if (superAdminCount <= 1) {
        throw new Error('Cannot delete the last super admin');
      }
    }

    const success = await usersRepository.deleteById(id);

    if (!success) {
      throw new Error('Failed to delete user');
    }

    return { success: true };
  },

  // Deactivate user
  async deactivateUser(id: string) {
    return await this.updateUser(id, { isActive: false });
  },

  // Activate user
  async activateUser(id: string) {
    return await this.updateUser(id, { isActive: true });
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
    const user = await usersRepository.findById(id);

    if (!user) {
      throw new Error('User not found');
    }

    const rolePermissions = getRolePermissions(user.role);
    const customPermissions = (user.permissions as string[]) || [];

    return {
      role: user.role,
      rolePermissions,
      customPermissions,
      allPermissions: Array.from(new Set([...rolePermissions, ...customPermissions])),
    };
  },

  // Update user permissions
  async updateUserPermissions(id: string, permissions: string[]) {
    return await this.updateUser(id, { permissions });
  },

  // Get user statistics
  async getUserStatistics() {
    return await usersRepository.getUserStatistics();
  },

  // Change password
  async changePassword(
    id: string,
    oldPassword: string,
    newPassword: string,
  ) {
    const user = await usersRepository.findById(id);

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
    await usersRepository.updatePassword(id, hashedPassword);

    return { success: true };
  },

  // Reset password (admin only)
  async resetPassword(id: string, newPassword: string) {
    const hashedPassword = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS || '12'));
    await usersRepository.updatePassword(id, hashedPassword);

    return { success: true };
  },
};

export default userService;
