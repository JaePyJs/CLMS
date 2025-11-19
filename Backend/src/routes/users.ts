import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/authenticate';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

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
      const { username, email, password, role, first_name, last_name } =
        req.body;

      const full_name =
        first_name && last_name ? `${first_name} ${last_name}` : null;

      const user = await prisma.users.create({
        data: {
          username,
          email: email || null,
          password: password || 'changeme123',
          role: role || 'LIBRARIAN',
          first_name: first_name || null,
          last_name: last_name || null,
          full_name,
          is_active: true,
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
      const { username, email, role, first_name, last_name, is_active } =
        req.body;

      const full_name =
        first_name && last_name ? `${first_name} ${last_name}` : undefined;

      const user = await prisma.users.update({
        where: { id: req.params['id'] },
        data: {
          username,
          email,
          role,
          first_name,
          last_name,
          full_name,
          is_active,
          updated_at: new Date(),
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
      const { first_name, last_name } = req.body;
      // email, role, is_active available via req.body spread below

      const full_name =
        first_name && last_name ? `${first_name} ${last_name}` : undefined;

      const user = await prisma.users.update({
        where: { id: req.params['id'] },
        data: {
          ...req.body,
          first_name,
          last_name,
          full_name,
          updated_at: new Date(),
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
