import { Router, Request, Response } from 'express';
import { isDevelopment } from '../config/env';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, requireRole } from '../middleware/authenticate';
import { AuthService } from '../services/authService';
import { logger } from '../utils/logger';
import { prisma } from '../config/database';
import {
  authRateLimiter,
  registrationRateLimiter,
} from '../middleware/rateLimiter';

const router = Router();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: User login
 *     description: Authenticate user with username and password. Returns JWT access token and refresh token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: "admin"
 *               password:
 *                 type: string
 *                 example: "password123"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     token:
 *                       type: string
 *                       description: JWT access token
 *                     refreshToken:
 *                       type: string
 *                       description: JWT refresh token
 *       400:
 *         description: Missing credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Too many login attempts (rate limited)
 */
// POST /api/v1/auth/login
// Rate limited to 5 attempts per 15 minutes per IP
router.post(
  '/login',
  authRateLimiter,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      logger.warn('Login failed: missing username or password', {
        ip: req.ip,
        hasUsername: !!username,
        hasPassword: !!password,
      });

      res.status(400).json({
        message: 'Username and password are required',
        code: 'MISSING_CREDENTIALS',
      });
      return;
    }

    try {
      const result = await AuthService.login({ username, password });

      logger.info('Login successful', {
        username: result.user.username,
        userId: result.user.id,
        role: result.user.role,
        ip: req.ip,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.warn('Login failed', {
        username,
        ip: req.ip,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(401).json({
        success: false,
        message: error instanceof Error ? error.message : 'Login failed',
        code: 'LOGIN_FAILED',
      });
    }
  }),
);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: User registration
 *     description: Register a new user account. Password must be at least 6 characters.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: "newuser"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "password123"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@example.com"
 *               full_name:
 *                 type: string
 *                 example: "John Doe"
 *               role:
 *                 type: string
 *                 enum: [LIBRARIAN, ADMIN]
 *                 example: "LIBRARIAN"
 *     responses:
 *       201:
 *         description: Registration successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     token:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       400:
 *         description: Invalid input (missing fields or password too short)
 *       409:
 *         description: Username already exists
 *       429:
 *         description: Too many registration attempts (rate limited)
 */
// POST /api/v1/auth/register
// Rate limited to 3 attempts per hour per IP
router.post(
  '/register',
  registrationRateLimiter,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { username, password, email, full_name, role } = req.body;

    // Validate input
    if (!username || !password) {
      logger.warn('Registration failed: missing username or password', {
        ip: req.ip,
        hasUsername: !!username,
        hasPassword: !!password,
      });

      res.status(400).json({
        message: 'Username and password are required',
        code: 'MISSING_CREDENTIALS',
      });
      return;
    }

    if (password.length < 6) {
      logger.warn('Registration failed: password too short', {
        username,
        ip: req.ip,
      });

      res.status(400).json({
        message: 'Password must be at least 6 characters long',
        code: 'PASSWORD_TOO_SHORT',
      });
      return;
    }

    try {
      const result = await AuthService.register({
        username,
        password,
        email,
        full_name,
        role,
      });

      logger.info('Registration successful', {
        username: result.user.username,
        userId: result.user.id,
        role: result.user.role,
        ip: req.ip,
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.warn('Registration failed', {
        username,
        ip: req.ip,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      const status =
        error instanceof Error && error.message.includes('already exists')
          ? 409
          : 400;

      res.status(status).json({
        success: false,
        message: error instanceof Error ? error.message : 'Registration failed',
        code: 'REGISTRATION_FAILED',
      });
    }
  }),
);

// POST /api/v1/auth/logout
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      await AuthService.logout(req.user.userId);

      logger.info('Logout successful', {
        userId: req.user.userId,
        username: req.user.username,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      logger.error('Logout error', {
        userId: req.user?.userId,
        ip: req.ip,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Logout failed',
        code: 'LOGOUT_FAILED',
      });
    }
  }),
);

// POST /api/v1/auth/refresh
router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Note: This endpoint does NOT require authentication since the access token may be expired
    // We validate the refresh token directly instead

    const { refreshToken } = req.body;

    if (!refreshToken) {
      logger.warn('Token refresh failed: no refresh token provided', {
        ip: req.ip,
      });

      res.status(400).json({
        message: 'Refresh token is required',
        code: 'MISSING_REFRESH_TOKEN',
      });
      return;
    }

    try {
      const result = await AuthService.refreshToken(refreshToken);

      logger.info('Token refresh successful', { ip: req.ip });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.warn('Token refresh failed', {
        ip: req.ip,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN',
      });
    }
  }),
);

// GET /api/v1/auth/me
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const user = await AuthService.getCurrentUser(req.user.userId);

      logger.info('Get current user successful', {
        userId: req.user.userId,
        username: req.user.username,
        ip: req.ip,
      });

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      logger.error('Get current user failed', {
        userId: req.user?.userId,
        ip: req.ip,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      if (isDevelopment() && req.user) {
        res.json({
          success: true,
          data: {
            id: req.user.userId,
            username: req.user.username,
            role: req.user.role,
          },
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: 'Failed to get user information',
        code: 'GET_USER_FAILED',
      });
    }
  }),
);

router.post(
  '/kiosk-token',
  authenticate,
  requireRole(['LIBRARIAN']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { deviceName } = req.body;
    try {
      const result = await AuthService.createKioskToken(
        String(deviceName || 'Kiosk Display'),
      );
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      logger.error('Create kiosk token failed', {
        userId: req.user?.userId,
        ip: req.ip,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res
        .status(500)
        .json({ success: false, error: 'Failed to create kiosk token' });
    }
  }),
);

router.get(
  '/kiosk-users',
  authenticate,
  requireRole(['LIBRARIAN']),
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    try {
      const users = await prisma.users.findMany({
        where: { role: 'KIOSK_DISPLAY' },
        select: {
          id: true,
          username: true,
          full_name: true,
          is_active: true,
          created_at: true,
          last_login_at: true,
        },
        orderBy: { created_at: 'desc' },
      });
      res.json({ success: true, data: users });
    } catch (_error) {
      res
        .status(500)
        .json({ success: false, error: 'Failed to list kiosk users' });
    }
  }),
);

router.post(
  '/kiosk-revoke',
  authenticate,
  requireRole(['LIBRARIAN']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.body as { userId: string };
    if (!userId) {
      res.status(400).json({ success: false, error: 'userId is required' });
      return;
    }
    try {
      const user = await prisma.users.update({
        where: { id: String(userId) },
        data: { is_active: false },
      });
      res.json({
        success: true,
        data: { id: user.id, is_active: user.is_active },
      });
    } catch (_error) {
      res
        .status(500)
        .json({ success: false, error: 'Failed to revoke kiosk user' });
    }
  }),
);

export default router;
