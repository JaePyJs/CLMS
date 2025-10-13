import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  UserPlus,
  Edit,
  Trash2,
  Key,
  Search,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  UserX,
} from 'lucide-react';
import { settingsApi } from '@/lib/api';

interface User {
  id: string;
  username: string;
  role: 'ADMIN' | 'LIBRARIAN' | 'STAFF';
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

interface UserFormData {
  username: string;
  password: string;
  role: 'ADMIN' | 'LIBRARIAN' | 'STAFF';
  isActive: boolean;
}

const EMPTY_FORM: UserFormData = {
  username: '',
  password: '',
  role: 'LIBRARIAN',
  isActive: true,
};

export default function UserManagement() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>(EMPTY_FORM);

  // Fetch users with TanStack Query
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await settingsApi.getUsers();
      return response.data || [];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: (userData: UserFormData) => settingsApi.createUser(userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User created successfully!');
      setDialogOpen(false);
      setFormData(EMPTY_FORM);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to create user');
    },
  });

  // Update user mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UserFormData> }) =>
      settingsApi.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User updated successfully!');
      setDialogOpen(false);
      setFormData(EMPTY_FORM);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to update user');
    },
  });

  // Delete user mutation
  const deleteMutation = useMutation({
    mutationFn: (userId: string) => settingsApi.deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deleted successfully!');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to delete user');
    },
  });

  const handleAddUser = () => {
    setEditingUser(null);
    setFormData(EMPTY_FORM);
    setDialogOpen(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '', // Don't show existing password
      role: user.role,
      isActive: user.isActive,
    });
    setDialogOpen(true);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) {
      return;
    }

    deleteMutation.mutate(userId);
  };

  const handleSaveUser = async () => {
    // Validation
    if (!formData.username.trim()) {
      toast.error('Username is required');
      return;
    }

    if (!editingUser && !formData.password) {
      toast.error('Password is required for new users');
      return;
    }

    if (formData.password && formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    const userData: any = {
      username: formData.username,
      role: formData.role,
      isActive: formData.isActive,
    };

    // Only include password if provided
    if (formData.password) {
      userData.password = formData.password;
    }

    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data: userData });
    } else {
      createMutation.mutate(userData);
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    updateMutation.mutate({
      id: user.id,
      data: {
        username: user.username,
        role: user.role,
        isActive: !user.isActive,
      },
    });
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'destructive';
      case 'LIBRARIAN':
        return 'default';
      case 'STAFF':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const filteredUsers = users.filter((user) =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading users...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load users. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">

      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            Manage system users, roles, and permissions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Add User */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button onClick={handleAddUser}>
              <UserPlus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </div>

          {/* Users Table */}
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.isActive ? 'default' : 'secondary'}
                          className="cursor-pointer"
                          onClick={() => handleToggleUserStatus(user)}
                        >
                          {user.isActive ? (
                            <>
                              <UserCheck className="w-3 h-3 mr-1" />
                              Active
                            </>
                          ) : (
                            <>
                              <UserX className="w-3 h-3 mr-1" />
                              Inactive
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(user.lastLoginAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(user.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditUser(user)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Summary */}
          <div className="text-sm text-muted-foreground">
            Showing {filteredUsers.length} of {users.length} users
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Edit User' : 'Add New User'}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? 'Update user information and permissions'
                : 'Create a new user account'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="Enter username"
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Password {editingUser && '(leave blank to keep current)'}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder={editingUser ? 'Enter new password' : 'Enter password'}
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Minimum 6 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value: any) =>
                  setFormData({ ...formData, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="LIBRARIAN">Librarian</SelectItem>
                  <SelectItem value="STAFF">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) =>
                  setFormData({ ...formData, isActive: e.target.checked })
                }
                className="h-4 w-4"
              />
              <Label htmlFor="isActive" className="cursor-pointer">
                Active
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveUser}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : editingUser
                ? 'Update User'
                : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
