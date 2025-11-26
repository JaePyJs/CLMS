import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/authenticate';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';
import { AuthService } from '../services/authService';
import { env } from '../config/env';
const router = Router();

const DEFAULT_LIBRARIAN_PASSWORD =
  env.DEFAULT_LIBRARIAN_PASSWORD?.trim() || 'lib123';

async function validateAdminCredentials(username: string, password: string) {
  if (!username || !password) {
    throw new Error('ADMIN_CREDENTIALS_REQUIRED');
  }

  const adminUser = await prisma.users.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      role: true,
      password: true,
      is_active: true,
    },
  });

  if (
    adminUser?.role !== 'ADMIN' ||
    !adminUser?.is_active ||
    !adminUser?.password
  ) {
    throw new Error('INVALID_ADMIN_CREDENTIALS');
  }

  const passwordMatches = await AuthService.verifyPassword(
    password,
    adminUser.password,
  );

  if (!passwordMatches) {
    throw new Error('INVALID_ADMIN_CREDENTIALS');
  }

  return adminUser;
}

// GET /api/users
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Get users request', {
      query: req.query,
      userId: req.user?.userId,
    });

    try {
      const {
        page: pageParam,
        limit: limitParam,
        search,
        role,
        is_active,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = req.query as Record<string, string | undefined>;

      const page = pageParam ? String(pageParam) : '1';
      const limit = limitParam ? String(limitParam) : '10';

      const where: Record<string, unknown> = {};

      if (search) {
        where.OR = [
          { username: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { first_name: { contains: search, mode: 'insensitive' } },
          { last_name: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (role) {
        where.role = role;
      }

      if (is_active !== undefined) {
        where.is_active = is_active === 'true';
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const total = await prisma.users.count({ where });

      const orderBy: Record<string, string> = {};
      orderBy[sortBy] = sortOrder;

      const users = await prisma.users.findMany({
        where,
        orderBy,
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          first_name: true,
          last_name: true,
          full_name: true,
          is_active: true,
          last_login_at: true,
          created_at: true,
          updated_at: true,
        },
      });

      res.json({
        success: true,
        data: users,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      logger.error('Error retrieving users', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// GET /api/users/statistics
router.get(
  '/statistics',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Get user statistics request', {
      requestedBy: req.user?.userId,
    });

    try {
      const [total, active, inactive, byRole] = await Promise.all([
        prisma.users.count(),
        prisma.users.count({ where: { is_active: true } }),
        prisma.users.count({ where: { is_active: false } }),
        prisma.users.groupBy({
          by: ['role'],
          _count: {
            role: true,
          },
        }),
      ]);

      res.json({
        success: true,
        data: {
          total,
          active,
          inactive,
          byRole,
        },
      });
    } catch (error) {
      logger.error('Error getting user statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// GET /api/users/:id
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Get user by ID request', {
      targetUserId: req.params['id'],
      requesterId: req.user?.userId,
    });

    try {
      const user = await prisma.users.findUnique({
        where: { id: req.params['id'] },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          first_name: true,
          last_name: true,
          full_name: true,
          is_active: true,
          last_login_at: true,
          created_at: true,
          updated_at: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      logger.error('Error retrieving user', {
        userId: req.params['id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// POST /api/users
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Create user request', {
      email: req.body.email,
      role: req.body.role,
      createdBy: req.user?.userId,
    });

    try {
      const {
        username,
        email,
        password,
        role,
        first_name,
        last_name,
        is_active,
        isActive,
      } = req.body;

      const full_name =
        first_name && last_name ? `${first_name} ${last_name}` : null;

      const rawPassword = password || 'changeme123';
      const hashedPassword = await AuthService.hashPassword(rawPassword);
      const activeFlag =
        typeof is_active === 'boolean'
          ? is_active
          : typeof isActive === 'boolean'
            ? isActive
            : true;

      const user = await prisma.users.create({
        data: {
          username,
          email: email || null,
          password: hashedPassword,
          role: role || 'LIBRARIAN',
          first_name: first_name || null,
          last_name: last_name || null,
          full_name,
          is_active: activeFlag,
        },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          first_name: true,
          last_name: true,
          full_name: true,
          is_active: true,
          created_at: true,
          updated_at: true,
        },
      });

      res.status(201).json({
        success: true,
        data: user,
      });
    } catch (error) {
      logger.error('Error creating user', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// PUT /api/users/:id
router.put(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Update user request', {
      targetUserId: req.params['id'],
      updatedBy: req.user?.userId,
      fields: Object.keys(req.body),
    });

    try {
      const {
        username,
        email,
        role,
        first_name,
        last_name,
        is_active,
        isActive,
        password,
      } = req.body;

      const updateData: Record<string, unknown> = {
        updated_at: new Date(),
      };

      if (typeof username !== 'undefined') {
        updateData.username = username;
      }

      if (typeof email !== 'undefined') {
        updateData.email = email;
      }

      if (typeof role !== 'undefined') {
        updateData.role = role;
      }

      if (typeof first_name !== 'undefined') {
        updateData.first_name = first_name;
      }

      if (typeof last_name !== 'undefined') {
        updateData.last_name = last_name;
      }

      if (
        typeof first_name !== 'undefined' &&
        typeof last_name !== 'undefined'
      ) {
        updateData.full_name =
          first_name && last_name ? `${first_name} ${last_name}` : null;
      }

      const activeFlag =
        typeof is_active === 'boolean'
          ? is_active
          : typeof isActive === 'boolean'
            ? isActive
            : undefined;

      if (typeof activeFlag === 'boolean') {
        updateData.is_active = activeFlag;
      }

      if (typeof password === 'string' && password.trim().length > 0) {
        updateData.password = await AuthService.hashPassword(password);
      }

      const user = await prisma.users.update({
        where: { id: req.params['id'] },
        data: updateData,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          first_name: true,
          last_name: true,
          full_name: true,
          is_active: true,
          last_login_at: true,
          created_at: true,
          updated_at: true,
        },
      });

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      logger.error('Error updating user', {
        userId: req.params['id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// PATCH /api/users/:id
router.patch(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Partial update user request', {
      targetUserId: req.params['id'],
      updatedBy: req.user?.userId,
      fields: Object.keys(req.body),
    });

    try {
      const { first_name, last_name, is_active, isActive, password, ...rest } =
        req.body;

      const updateData: Record<string, unknown> = {
        ...rest,
        updated_at: new Date(),
      };

      if (typeof first_name !== 'undefined') {
        updateData.first_name = first_name;
      }

      if (typeof last_name !== 'undefined') {
        updateData.last_name = last_name;
      }

      if (
        typeof first_name !== 'undefined' &&
        typeof last_name !== 'undefined'
      ) {
        updateData.full_name =
          first_name && last_name ? `${first_name} ${last_name}` : null;
      }

      const activeFlag =
        typeof is_active === 'boolean'
          ? is_active
          : typeof isActive === 'boolean'
            ? isActive
            : undefined;

      if (typeof activeFlag === 'boolean') {
        updateData.is_active = activeFlag;
      }

      if (typeof password === 'string' && password.trim().length > 0) {
        updateData.password = await AuthService.hashPassword(password);
      }

      const user = await prisma.users.update({
        where: { id: req.params['id'] },
        data: updateData,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          first_name: true,
          last_name: true,
          full_name: true,
          is_active: true,
          last_login_at: true,
          created_at: true,
          updated_at: true,
        },
      });

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      logger.error('Error updating user', {
        userId: req.params['id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// PATCH /api/users/:id/activate
router.patch(
  '/:id/activate',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Activate user request', {
      targetUserId: req.params['id'],
      requestedBy: req.user?.userId,
    });

    try {
      await prisma.users.update({
        where: { id: req.params['id'] },
        data: {
          is_active: true,
          updated_at: new Date(),
        },
      });

      res.json({
        success: true,
        message: 'User activated successfully',
      });
    } catch (error) {
      logger.error('Error activating user', {
        userId: req.params['id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// PATCH /api/users/:id/deactivate
router.patch(
  '/:id/deactivate',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Deactivate user request', {
      targetUserId: req.params['id'],
      requestedBy: req.user?.userId,
    });

    try {
      await prisma.users.update({
        where: { id: req.params['id'] },
        data: {
          is_active: false,
          updated_at: new Date(),
        },
      });

      res.json({
        success: true,
        message: 'User deactivated successfully',
      });
    } catch (error) {
      logger.error('Error deactivating user', {
        userId: req.params['id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// POST /api/users/:id/change-password
router.post(
  '/:id/change-password',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Change user password request', {
      targetUserId: req.params['id'],
      requestedBy: req.user?.userId,
    });

    try {
      const { oldPassword, newPassword } = req.body;

      if (!oldPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Old password and new password are required',
        });
      }

      // Get current user password
      const user = await prisma.users.findUnique({
        where: { id: req.params['id'] },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Verify old password
      const isValid = await AuthService.verifyPassword(
        oldPassword,
        user.password,
      );

      if (!isValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid old password',
        });
      }

      const hashedPassword = await AuthService.hashPassword(newPassword);

      await prisma.users.update({
        where: { id: req.params['id'] },
        data: {
          password: hashedPassword,
          updated_at: new Date(),
        },
      });

      res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      logger.error('Error changing password', {
        userId: req.params['id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// POST /api/users/:id/reset-password/default
router.post(
  '/:id/reset-password/default',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Admin-confirmed default password reset request', {
      targetUserId: req.params['id'],
      requestedBy: req.user?.userId,
    });

    try {
      const { adminUsername, adminPassword } = req.body || {};

      if (!adminUsername || !adminPassword) {
        return res.status(400).json({
          success: false,
          message: 'Admin username and password are required',
        });
      }

      try {
        await validateAdminCredentials(adminUsername, adminPassword);
      } catch (_error) {
        logger.warn('Invalid admin credentials for password reset', {
          adminUsername,
          requesterId: req.user?.userId,
        });
        return res.status(401).json({
          success: false,
          message: 'Invalid admin credentials',
          code: 'INVALID_ADMIN_CREDENTIALS',
        });
      }

      const hashedPassword = await AuthService.hashPassword(
        DEFAULT_LIBRARIAN_PASSWORD,
      );

      const user = await prisma.users.update({
        where: { id: req.params['id'] },
        data: {
          password: hashedPassword,
          updated_at: new Date(),
        },
        select: {
          id: true,
          username: true,
          role: true,
          is_active: true,
          updated_at: true,
        },
      });

      logger.info('Password reset to default completed', {
        targetUserId: user.id,
        requestedBy: req.user?.userId,
      });

      res.json({
        success: true,
        message: 'Password reset to default',
        data: {
          user,
          defaultPassword: DEFAULT_LIBRARIAN_PASSWORD,
        },
      });
    } catch (error) {
      logger.error('Error resetting password to default', {
        userId: req.params['id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        success: false,
        message: 'Failed to reset password',
        code: 'RESET_PASSWORD_FAILED',
      });
    }
  }),
);

// POST /api/users/:id/reset-password
router.post(
  '/:id/reset-password',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Reset user password request', {
      targetUserId: req.params['id'],
      requestedBy: req.user?.userId,
    });

    try {
      const { newPassword } = req.body;

      if (!newPassword) {
        return res.status(400).json({
          success: false,
          message: 'New password is required',
        });
      }

      const hashedPassword = await AuthService.hashPassword(newPassword);

      await prisma.users.update({
        where: { id: req.params['id'] },
        data: {
          password: hashedPassword,
          updated_at: new Date(),
        },
      });

      res.json({
        success: true,
        message: 'Password reset successfully',
      });
    } catch (error) {
      logger.error('Error resetting password', {
        userId: req.params['id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// DELETE /api/users/:id
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Delete user request', {
      targetUserId: req.params['id'],
      deletedBy: req.user?.userId,
    });

    try {
      // Soft delete - just set is_active to false
      await prisma.users.update({
        where: { id: req.params['id'] },
        data: {
          is_active: false,
          updated_at: new Date(),
        },
      });

      res.json({
        success: true,
        message: 'User deactivated successfully',
      });
    } catch (error) {
      logger.error('Error deleting user', {
        userId: req.params['id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

export default router;
