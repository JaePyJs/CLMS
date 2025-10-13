import React, { useState, useEffect } from 'react';
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
  Filter,
  RefreshCw,
  CheckCircle,
  XCircle,
  Eye,
  Settings,
} from 'lucide-react';
import userApi, { User, UserRole, CreateUserInput } from '../../services/userApi';
import { useToast } from '../ToastContainer';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [statistics, setStatistics] = useState<any>(null);

  const toast = useToast();

  const roleColors: Record<UserRole, string> = {
    SUPER_ADMIN: 'bg-purple-100 text-purple-800 border-purple-300',
    ADMIN: 'bg-red-100 text-red-800 border-red-300',
    LIBRARIAN: 'bg-blue-100 text-blue-800 border-blue-300',
    ASSISTANT: 'bg-green-100 text-green-800 border-green-300',
    TEACHER: 'bg-orange-100 text-orange-800 border-orange-300',
    VIEWER: 'bg-gray-100 text-gray-800 border-gray-300',
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

  useEffect(() => {
    fetchUsers();
    fetchStatistics();
  }, [roleFilter, statusFilter, searchQuery]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params: any = {};

      if (roleFilter !== 'ALL') {
        params.role = roleFilter;
      }

      if (statusFilter !== 'ALL') {
        params.isActive = statusFilter === 'ACTIVE';
      }

      if (searchQuery) {
        params.search = searchQuery;
      }

      const response = await userApi.getUsers(params);
      setUsers(response.data.users);
    } catch (error) {
      toast.error('Error', 'Failed to fetch users');
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const response = await userApi.getStatistics();
      setStatistics(response.data);
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  const handleCreateUser = async (data: CreateUserInput) => {
    try {
      await userApi.createUser(data);
      toast.success('Success', 'User created successfully');
      setShowCreateModal(false);
      fetchUsers();
      fetchStatistics();
    } catch (error: any) {
      toast.error('Error', error.response?.data?.message || 'Failed to create user');
    }
  };

  const handleUpdateUser = async (userId: string, data: any) => {
    try {
      await userApi.updateUser(userId, data);
      toast.success('Success', 'User updated successfully');
      setShowEditModal(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      toast.error('Error', error.response?.data?.message || 'Failed to update user');
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
    } catch (error: any) {
      toast.error('Error', error.response?.data?.message || 'Failed to update user status');
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!window.confirm(`Are you sure you want to delete user "${user.username}"?`)) {
      return;
    }

    try {
      await userApi.deleteUser(user.id);
      toast.success('Success', 'User deleted successfully');
      fetchUsers();
      fetchStatistics();
    } catch (error: any) {
      toast.error('Error', error.response?.data?.message || 'Failed to delete user');
    }
  };

  const handleResetPassword = async (user: User) => {
    const newPassword = window.prompt(`Enter new password for ${user.username}:`);
    if (!newPassword) return;

    try {
      await userApi.resetPassword(user.id, newPassword);
      toast.success('Success', 'Password reset successfully');
    } catch (error: any) {
      toast.error('Error', error.response?.data?.message || 'Failed to reset password');
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
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">Manage system users, roles, and permissions</p>
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
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{statistics.total}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Users</p>
                <p className="text-2xl font-bold text-green-600">{statistics.active}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Inactive Users</p>
                <p className="text-2xl font-bold text-gray-600">{statistics.inactive}</p>
              </div>
              <XCircle className="w-8 h-8 text-gray-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Admins</p>
                <p className="text-2xl font-bold text-red-600">
                  {statistics.byRole.find((r: any) => r.role === 'ADMIN')?._count || 0}
                </p>
              </div>
              <ShieldCheck className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="ALL">All Roles</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="ADMIN">Admin</option>
            <option value="LIBRARIAN">Librarian</option>
            <option value="ASSISTANT">Assistant</option>
            <option value="TEACHER">Teacher</option>
            <option value="VIEWER">Viewer</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>

          {/* Refresh Button */}
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12">
            <Users className="w-16 h-16 text-gray-400 mb-4" />
            <p className="text-gray-600">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900">{user.username}</div>
                        {user.fullName && (
                          <div className="text-sm text-gray-500">{user.fullName}</div>
                        )}
                        {user.email && (
                          <div className="text-sm text-gray-500">{user.email}</div>
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
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <XCircle className="w-3 h-3" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
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
                              ? 'text-gray-600 hover:bg-gray-50'
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
  const [formData, setFormData] = useState<CreateUserInput>({
    username: '',
    password: '',
    email: '',
    fullName: '',
    role: 'LIBRARIAN',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Create New User</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username *
            </label>
            <input
              type="text"
              required
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password *
            </label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
            <select
              required
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
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
  onSubmit: (data: any) => void;
}> = ({ user, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    username: user.username,
    fullName: user.fullName || '',
    email: user.email || '',
    role: user.role,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Edit User</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username *
            </label>
            <input
              type="text"
              required
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
            <select
              required
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
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
