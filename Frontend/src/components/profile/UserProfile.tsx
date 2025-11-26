import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  User as UserIcon,
  Key,
  Clock,
  CheckCircle2,
  AlertCircle,
  Shield,
  Calendar,
  Loader2,
  Save,
  X,
  Edit2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { userApi, type User } from '@/services/userApi';
import { toast } from 'sonner';

export default function UserProfile() {
  const { user: authUser, checkAuth } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Password Change State
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Username Change State
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!authUser?.id) return;

    setLoading(true);
    try {
      const response = await userApi.getUserById(authUser.id);
      if (response.success && response.data) {
        setProfile(response.data);
        setNewUsername(response.data.username);
      } else {
        toast.error('Failed to load profile data');
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      toast.error('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  }, [authUser?.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser?.id) return;

    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      toast.error('All fields are required');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setChangingPassword(true);
    try {
      const response = await userApi.changePassword(
        authUser.id,
        passwordForm.currentPassword,
        passwordForm.newPassword
      );

      if (response.success) {
        toast.success('Password changed successfully');
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      } else {
        toast.error(response.message || 'Failed to change password');
      }
    } catch (error: any) {
      console.error('Failed to change password:', error);
      toast.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleUsernameUpdate = async () => {
    if (!authUser?.id || !profile) return;

    if (!newUsername.trim()) {
      toast.error('Username cannot be empty');
      return;
    }

    if (newUsername === profile.username) {
      setIsEditingUsername(false);
      return;
    }

    setUpdatingProfile(true);
    try {
      const response = await userApi.updateUser(authUser.id, {
        username: newUsername,
      });

      if (response.success) {
        toast.success('Username updated successfully');
        setProfile({ ...profile, username: newUsername });
        setIsEditingUsername(false);
        // Refresh auth context to update header/sidebar
        checkAuth();
      } else {
        toast.error(response.message || 'Failed to update username');
      }
    } catch (error: any) {
      console.error('Failed to update username:', error);
      toast.error(error.response?.data?.message || 'Failed to update username');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<
      string,
      'default' | 'secondary' | 'destructive' | 'outline'
    > = {
      ADMIN: 'destructive',
      LIBRARIAN: 'default',
      STAFF: 'secondary',
    };
    return (
      <Badge variant={variants[role] || 'default'}>
        <Shield className="w-3 h-3 mr-1" />
        {role}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="animate-spin h-8 w-8 text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading profile...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <AlertCircle className="w-8 h-8 text-destructive mb-2" />
          <p className="text-muted-foreground">Failed to load profile</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="w-5 h-5" />
            Profile Information
          </CardTitle>
          <CardDescription>
            Your account details and information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Username</Label>
              {isEditingUsername ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    disabled={updatingProfile}
                  />
                  <Button
                    size="sm"
                    onClick={handleUsernameUpdate}
                    disabled={updatingProfile}
                  >
                    {updatingProfile ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsEditingUsername(false);
                      setNewUsername(profile.username);
                    }}
                    disabled={updatingProfile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="text-lg font-medium">{profile.username}</div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingUsername(true)}
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Role</Label>
              <div>{getRoleBadge(profile.role)}</div>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Account Status</Label>
              <div>
                {profile.isActive ? (
                  <Badge className="bg-green-500">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Member Since</Label>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                {formatDate(profile.createdAt)}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Last Login</Label>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                {formatDate(profile.lastLoginAt)}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">User ID</Label>
              <div className="text-sm font-mono text-muted-foreground">
                {profile.id}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            Change Password
          </CardTitle>
          <CardDescription>
            Update your password to keep your account secure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    currentPassword: e.target.value,
                  })
                }
                disabled={changingPassword}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    newPassword: e.target.value,
                  })
                }
                disabled={changingPassword}
              />
              <p className="text-xs text-muted-foreground">
                Minimum 6 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    confirmPassword: e.target.value,
                  })
                }
                disabled={changingPassword}
              />
            </div>

            <Button type="submit" disabled={changingPassword}>
              {changingPassword ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Changing Password...
                </>
              ) : (
                'Change Password'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
