import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Key,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  Eye,
} from 'lucide-react';
import userApi, {
  type User,
  type UserRole,
  type CreateUserInput,
} from '../../services/userApi';
import { useToast } from '../ToastContainer';
import { useForm } from '../../hooks';
import { getErrorMessage } from '@/utils/errorHandling';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'ACTIVE' | 'INACTIVE'
  >('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [statistics, setStatistics] = useState<{
    total: number;
    active: number;
    inactive: number;
    byRole: Array<{ role: UserRole; _count: number }>;
  } | null>(null);

  const toast = useToast();

  const roleColors: Record<UserRole, string> = {
    SUPER_ADMIN:
      'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-700',
    ADMIN:
      'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700',
    LIBRARIAN:
      'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700',
    ASSISTANT:
      'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700',
    TEACHER:
      'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-700',
    VIEWER: 'bg-muted text-muted-foreground border-border',
  };

  const roleIcons: Record<UserRole, React.ReactNode> = {
    SUPER_ADMIN: <ShieldAlert className="w-4 h-4" />,
    ADMIN: <ShieldCheck className="w-4 h-4" />,
    LIBRARIAN: <Shield className="w-4 h-4" />,
    ASSISTANT: <Users className="w-4 h-4" />,
    TEACHER: <Users className="w-4 h-4" />,
    VIEWER: <Eye className="w-4 h-4" />,
  };

  const roleLabels: Record<UserRole, string> = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN: 'Admin',
    LIBRARIAN: 'Librarian',
    ASSISTANT: 'Assistant',
    TEACHER: 'Teacher',
    VIEWER: 'Viewer',
  };

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, unknown> = {};

      if (roleFilter !== 'ALL') {
        params.role = roleFilter;
      }

      if (statusFilter !== 'ALL') {
        params.isActive = statusFilter === 'ACTIVE';
      }

      if (searchQuery) {
        params._search = searchQuery;
      }

      const response = await userApi.getUsers(params);
      setUsers(response.data.users);
    } catch (error) {
      toast.error('Error', 'Failed to fetch users');
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }, [roleFilter, statusFilter, searchQuery]); // toast is stable from useToast hook

  const fetchStatistics = useCallback(async () => {
    try {
      const response = await userApi.getStatistics();
      setStatistics(response.data);
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchStatistics();
  }, [fetchUsers, fetchStatistics]);

  const handleCreateUser = async (data: CreateUserInput) => {
    try {
      await userApi.createUser(data);
      toast.success('Success', 'User created successfully');
      setShowCreateModal(false);
      fetchUsers();
      fetchStatistics();
    } catch (error: unknown) {
      toast.error('Error', getErrorMessage(error, 'Failed to create user'));
    }
  };

  const handleUpdateUser = async (
    userId: string,
    data: Partial<CreateUserInput>
  ) => {
    try {
      await userApi.updateUser(userId, data);
      toast.success('Success', 'User updated successfully');
      setShowEditModal(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: unknown) {
      toast.error('Error', getErrorMessage(error, 'Failed to update user'));
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    try {
      if (user.isActive) {
        await userApi.deactivateUser(user.id);
        toast.success('Success', 'User deactivated');
      } else {
        await userApi.activateUser(user.id);
        toast.success('Success', 'User activated');
      }
      fetchUsers();
      fetchStatistics();
    } catch (error: unknown) {
      toast.error(
        'Error',
        getErrorMessage(error, 'Failed to update user status')
      );
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (
      !window.confirm(
        `Are you sure you want to delete user "${user.username}"?`
      )
    ) {
      return;
    }

    try {
      await userApi.deleteUser(user.id);
      toast.success('Success', 'User deleted successfully');
      fetchUsers();
      fetchStatistics();
    } catch (error: unknown) {
      toast.error('Error', getErrorMessage(error, 'Failed to delete user'));
    }
  };

  const handleResetPassword = async (user: User) => {
    const newPassword = window.prompt(
      `Enter new password for ${user.username}:`
    );
    if (!newPassword) {
      return;
    }

    try {
      await userApi.resetPassword(user.id, newPassword);
      toast.success('Success', 'Password reset successfully');
    } catch (error: unknown) {
      toast.error('Error', getErrorMessage(error, 'Failed to reset password'));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            User Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage system users, roles, and permissions
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add User
        </button>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card p-4 rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold text-foreground">
                  {statistics.total}
                </p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-card p-4 rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold text-green-600">
                  {statistics.active}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-card p-4 rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Inactive Users</p>
                <p className="text-2xl font-bold text-muted-foreground">
                  {statistics.inactive}
                </p>
              </div>
              <XCircle className="w-8 h-8 text-muted-foreground" />
            </div>
          </div>

          <div className="bg-card p-4 rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Librarians</p>
                <p className="text-2xl font-bold text-blue-600">
                  {statistics.byRole.find((r) => r.role === 'LIBRARIAN')
                    ?._count || 0}
                </p>
              </div>
              <ShieldCheck className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-card p-4 rounded-lg border border-border space-y-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* _Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as UserRole | 'ALL')}
            className="px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="ALL">All Roles</option>
            <option value="LIBRARIAN">Librarian</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')
            }
            className="px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>

          {/* Refresh Button */}
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors text-foreground"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12">
            <Users className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-foreground">
                          {user.username}
                        </div>
                        {user.fullName && (
                          <div className="text-sm text-muted-foreground">
                            {user.fullName}
                          </div>
                        )}
                        {user.email && (
                          <div className="text-sm text-muted-foreground">
                            {user.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          roleColors[user.role]
                        }`}
                      >
                        {roleIcons[user.role]}
                        {roleLabels[user.role]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {user.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                          <XCircle className="w-3 h-3" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {user.lastLoginAt
                        ? formatDate(user.lastLoginAt)
                        : 'Never'}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowEditModal(true);
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit user"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleResetPassword(user)}
                          className="p-1.5 text-orange-600 hover:bg-orange-50 rounded transition-colors"
                          title="Reset password"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleUserStatus(user)}
                          className={`p-1.5 rounded transition-colors ${
                            user.isActive
                              ? 'text-muted-foreground hover:bg-muted'
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                          title={user.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {user.isActive ? (
                            <XCircle className="w-4 h-4" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete user"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create User Modal - Simplified for now */}
      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateUser}
        />
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <EditUserModal
          user={selectedUser}
          onClose={() => {
            setShowEditModal(false);
            setSelectedUser(null);
          }}
          onSubmit={(data) => handleUpdateUser(selectedUser.id, data)}
        />
      )}
    </div>
  );
};

// Create User Modal Component
const CreateUserModal: React.FC<{
  onClose: () => void;
  onSubmit: (data: CreateUserInput) => void;
}> = ({ onClose, onSubmit }) => {
  const [createForm, createFormActions] = useForm({
    initialValues: {
      username: '',
      password: '',
      email: '',
      fullName: '',
      role: 'LIBRARIAN',
    },
    validationSchema: {
      username: { required: true },
      password: { required: true },
      email: { required: false },
      fullName: { required: false },
      role: { required: true },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(createForm.values as CreateUserInput);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg p-6 w-full max-w-md border border-border">
        <h2 className="text-xl font-bold mb-4 text-foreground">
          Create New User
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Username *
            </label>
            <input
              type="text"
              required
              value={createForm.values.username}
              onChange={(e) =>
                createFormActions.setValue('username', e.target.value)
              }
              className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password *
            </label>
            <input
              type="password"
              required
              value={createForm.values.password}
              onChange={(e) =>
                createFormActions.setValue('password', e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={createForm.values.fullName}
              onChange={(e) =>
                createFormActions.setValue('fullName', e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={createForm.values.email}
              onChange={(e) =>
                createFormActions.setValue('email', e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role *
            </label>
            <select
              required
              value={createForm.values.role}
              onChange={(e) =>
                createFormActions.setValue('role', e.target.value as UserRole)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="LIBRARIAN">Librarian</option>
              <option value="ASSISTANT">Assistant</option>
              <option value="TEACHER">Teacher</option>
              <option value="VIEWER">Viewer</option>
              <option value="ADMIN">Admin</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
          </div>

          <div className="flex gap-2 justify-end mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-lg hover:bg-muted text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create User
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Edit User Modal Component
const EditUserModal: React.FC<{
  user: User;
  onClose: () => void;
  onSubmit: (data: unknown) => void;
}> = ({ user, onClose, onSubmit }) => {
  const [editForm, editFormActions] = useForm({
    initialValues: {
      username: user.username,
      fullName: user.fullName || '',
      email: user.email || '',
      role: user.role,
    },
    validationSchema: {
      username: { required: true },
      fullName: { required: false },
      email: { required: false },
      role: { required: true },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(editForm.values);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg p-6 w-full max-w-md border border-border">
        <h2 className="text-xl font-bold mb-4 text-foreground">Edit User</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username *
            </label>
            <input
              type="text"
              required
              value={editForm.values.username}
              onChange={(e) =>
                editFormActions.setValue('username', e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={editForm.values.fullName}
              onChange={(e) =>
                editFormActions.setValue('fullName', e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={editForm.values.email}
              onChange={(e) =>
                editFormActions.setValue('email', e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role *
            </label>
            <select
              required
              value={editForm.values.role}
              onChange={(e) =>
                editFormActions.setValue('role', e.target.value as UserRole)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="LIBRARIAN">Librarian</option>
              <option value="ASSISTANT">Assistant</option>
              <option value="TEACHER">Teacher</option>
              <option value="VIEWER">Viewer</option>
              <option value="ADMIN">Admin</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
          </div>

          <div className="flex gap-2 justify-end mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Update User
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserManagement;
