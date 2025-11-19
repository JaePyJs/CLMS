import api from './api';

export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'LIBRARIAN'
  | 'ASSISTANT'
  | 'TEACHER'
  | 'VIEWER';

export interface User {
  id: string;
  username: string;
  email?: string;
  fullName?: string;
  role: UserRole;
  permissions?: string[];
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

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

export interface UserStatistics {
  total: number;
  active: number;
  inactive: number;
  byRole: Array<{ role: UserRole; _count: number }>;
}

export const userApi = {
  // Get all users
  async getUsers(params?: {
    role?: UserRole;
    isActive?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const response = await api.get('/users', { params });
    return response.data;
  },

  // Get user statistics
  async getStatistics() {
    const response = await api.get('/users/statistics');
    return response.data;
  },

  // Get user by ID
  async getUserById(userId: string) {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  },

  // Get user permissions
  async getUserPermissions(userId: string) {
    const response = await api.get(`/users/${userId}/permissions`);
    return response.data;
  },

  // Create user
  async createUser(data: CreateUserInput) {
    const response = await api.post('/users', data);
    return response.data;
  },

  // Update user
  async updateUser(userId: string, data: UpdateUserInput) {
    const response = await api.put(`/users/${userId}`, data);
    return response.data;
  },

  // Update user role
  async updateUserRole(userId: string, role: UserRole) {
    const response = await api.patch(`/users/${userId}/role`, { role });
    return response.data;
  },

  // Update user permissions
  async updateUserPermissions(userId: string, permissions: string[]) {
    const response = await api.patch(`/users/${userId}/permissions`, {
      permissions,
    });
    return response.data;
  },

  // Activate user
  async activateUser(userId: string) {
    const response = await api.patch(`/users/${userId}/activate`);
    return response.data;
  },

  // Deactivate user
  async deactivateUser(userId: string) {
    const response = await api.patch(`/users/${userId}/deactivate`);
    return response.data;
  },

  // Change password
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ) {
    const response = await api.post(`/users/${userId}/change-password`, {
      oldPassword,
      newPassword,
    });
    return response.data;
  },

  // Reset password (admin)
  async resetPassword(userId: string, newPassword: string) {
    const response = await api.post(`/users/${userId}/reset-password`, {
      newPassword,
    });
    return response.data;
  },

  // Delete user
  async deleteUser(userId: string) {
    const response = await api.delete(`/users/${userId}`);
    return response.data;
  },
};

export default userApi;
