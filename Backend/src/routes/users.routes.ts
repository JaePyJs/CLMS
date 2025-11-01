import express from 'express';
import { userService } from '../services/user.service';
import { authMiddleware } from '../middleware/auth';
import {
  requirePermission,
  requireAdmin,
  requireSuperAdmin,
  requireOwnershipOrAdmin,
} from '../middleware/authorization.middleware';
import { Permission } from '../config/permissions';

const router = express.Router();

// Apply authentication to all routes
router.use(authMiddleware);

/**
 * @route   GET /api/users
 * @desc    Get all users
 * @access  Private (requires USERS_VIEW permission)
 */
router.get('/', requirePermission(Permission.USERS_VIEW), async (req, res) => {
  try {
    const { role, isActive, search, limit, offset } = req.query;

    const result = await userService.getAllUsers({
      role: role as any,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      search: search as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   GET /api/users/statistics
 * @desc    Get user statistics
 * @access  Private (Admin only)
 */
router.get('/statistics', requireAdmin, async (req, res) => {
  try {
    const stats = await userService.getUserStatistics();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user statistics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private (requires USERS_VIEW permission)
 */
router.get('/:id', requirePermission(Permission.USERS_VIEW), async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.id);

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   GET /api/users/:id/permissions
 * @desc    Get user permissions
 * @access  Private
 */
router.get('/:id/permissions', requireOwnershipOrAdmin('id'), async (req, res) => {
  try {
    const permissions = await userService.getUserPermissions(req.params.id);

    res.json({
      success: true,
      data: permissions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user permissions',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   POST /api/users
 * @desc    Create new user
 * @access  Private (requires USERS_CREATE permission)
 */
router.post('/', requirePermission(Permission.USERS_CREATE), async (req, res) => {
  try {
    const user = await userService.createUser(req.body);

    res.status(201).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to create user',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   PUT /api/users/:id
 * @desc    Update user
 * @access  Private (requires USERS_UPDATE permission)
 */
router.put('/:id', requirePermission(Permission.USERS_UPDATE), async (req, res) => {
  try {
    const user = await userService.updateUser(req.params.id, req.body);

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to update user',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   PATCH /api/users/:id/role
 * @desc    Update user role
 * @access  Private (Super Admin only)
 */
router.patch('/:id/role', requireSuperAdmin, async (req, res) => {
  try {
    const { role } = req.body;

    if (!role) {
      res.status(400).json({
        success: false,
        message: 'Role is required',
      });
      return;
    }

    const user = await userService.updateUserRole(req.params.id, role);

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to update user role',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   PATCH /api/users/:id/permissions
 * @desc    Update user permissions
 * @access  Private (Super Admin only)
 */
router.patch('/:id/permissions', requireSuperAdmin, async (req, res) => {
  try {
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      res.status(400).json({
        success: false,
        message: 'Permissions must be an array',
      });
      return;
    }

    const user = await userService.updateUserPermissions(req.params.id, permissions);

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to update user permissions',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   PATCH /api/users/:id/activate
 * @desc    Activate user
 * @access  Private (Admin only)
 */
router.patch('/:id/activate', requireAdmin, async (req, res) => {
  try {
    const user = await userService.activateUser(req.params.id);

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to activate user',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   PATCH /api/users/:id/deactivate
 * @desc    Deactivate user
 * @access  Private (Admin only)
 */
router.patch('/:id/deactivate', requireAdmin, async (req, res) => {
  try {
    const user = await userService.deactivateUser(req.params.id);

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to deactivate user',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   POST /api/users/:id/change-password
 * @desc    Change user password
 * @access  Private (Own account or admin)
 */
router.post('/:id/change-password', requireOwnershipOrAdmin('id'), async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      res.status(400).json({
        success: false,
        message: 'Old password and new password are required',
      });
      return;
    }

    await userService.changePassword(req.params.id, oldPassword, newPassword);

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to change password',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   POST /api/users/:id/reset-password
 * @desc    Reset user password (admin only)
 * @access  Private (Admin only)
 */
router.post('/:id/reset-password', requireAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword) {
      res.status(400).json({
        success: false,
        message: 'New password is required',
      });
      return;
    }

    await userService.resetPassword(req.params.id, newPassword);

    res.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to reset password',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user
 * @access  Private (requires USERS_DELETE permission)
 */
router.delete('/:id', requirePermission(Permission.USERS_DELETE), async (req, res) => {
  try {
    await userService.deleteUser(req.params.id);

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to delete user',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
