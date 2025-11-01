import { Router, Request, Response } from 'express';
import { body, param } from 'express-validator';
import { authService } from '@/services/authService';
import { enhancedAuthService } from '@/services/enhancedAuthService';
import { authMiddleware } from '@/middleware/auth';
import { validationMiddleware } from '@/middleware/validation';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/apiResponse';
import {
  AuthenticationError,
  BusinessLogicError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/utils/errors';

const router = Router();

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current authenticated user
 *     description: Retrieve the profile information of the currently authenticated user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
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
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/me',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AuthenticationError('Not authenticated');
    }

    if (!req.user.userId) {
      throw new AuthenticationError('User ID not found in token');
    }

    const user = await authService.getUserById(req.user.userId);

    if (!user) {
      throw new NotFoundError('User', req.user.userId);
    }

    sendSuccess(res, {
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        isActive: user.is_active,
        lastLoginAt: user.last_login_at,
        createdAt: user.created_at,
      },
    });
  }),
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     description: Authenticate user and receive JWT token
 *     tags: [Authentication]
 *     security: []
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
 *                 example: admin
 *               password:
 *                 type: string
 *                 format: password
 *                 example: librarian123
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
 *                     token:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                 message:
 *                   type: string
 *                   example: Login successful
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       429:
 *         description: Too many login attempts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/login',
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
    validationMiddleware,
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { username, password } = req.body;

    // Use enhancedAuthService for secure session management
    const result = await enhancedAuthService.login(username, password, req, res);

    if (!result.success || !result.user) {
      throw new AuthenticationError(result.error || 'Invalid credentials');
    }

    sendSuccess(
      res,
      {
        user: result.user,
        // Tokens are set in HttpOnly cookies
        // Also returned for mobile apps that can't use cookies
      },
      { message: 'Login successful' },
    );
  }),
);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Use refresh token to get a new access token (automatic rotation)
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token (optional, will use cookie if not provided)
 *     responses:
 *       200:
 *         description: Token refreshed successfully
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
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Try to get refresh token from cookie first, then body
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      throw new AuthenticationError('Refresh token required');
    }

    const result = await enhancedAuthService.refresh(refreshToken, req, res);

    if (!result.success) {
      throw new AuthenticationError(result.error || 'Invalid refresh token');
    }

    sendSuccess(
      res,
      {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
      { message: 'Token refreshed successfully' },
    );
  }),
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout from current session
 *     description: Logout user from current device and revoke session
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       401:
 *         description: Not authenticated
 */
router.post(
  '/logout',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.sessionId) {
      throw new AuthenticationError('Session not found');
    }

    const result = await enhancedAuthService.logout(req.user.sessionId, res);

    if (!result.success) {
      throw new BusinessLogicError(result.error || 'Logout failed');
    }

    sendSuccess(res, {}, { message: 'Logged out successfully' });
  }),
);

/**
 * @swagger
 * /api/auth/logout-all:
 *   post:
 *     summary: Logout from all devices
 *     description: Logout user from all devices and revoke all sessions
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out from all devices
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     sessionsRevoked:
 *                       type: number
 *       401:
 *         description: Not authenticated
 */
router.post(
  '/logout-all',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AuthenticationError('Not authenticated');
    }

    const result = await enhancedAuthService.logoutAll(req.user.id, res);

    if (!result.success) {
      throw new BusinessLogicError(result.error || 'Logout all failed');
    }

    sendSuccess(
      res,
      { sessionsRevoked: result.sessionsRevoked },
      { message: 'Logged out from all devices' },
    );
  }),
);

/**
 * @swagger
 * /api/auth/sessions:
 *   get:
 *     summary: Get all active sessions
 *     description: Retrieve all active sessions for the current user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active sessions retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     sessions:
 *                       type: array
 *                       items:
 *                         type: object
 *       401:
 *         description: Not authenticated
 */
router.get(
  '/sessions',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AuthenticationError('Not authenticated');
    }

    const sessions = await enhancedAuthService.getUserSessions(req.user.id);

    sendSuccess(res, { sessions });
  }),
);

// Create user endpoint (admin only)
router.post(
  '/users',
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    body('role').notEmpty().withMessage('Role is required'),
    validationMiddleware,
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { username, password, role, isActive } = req.body;

    const result = await authService.createUser({
      username,
      password,
      role,
      isActive,
    });

    if (!result.success || !result.user) {
      if (result.error?.toLowerCase().includes('exists')) {
        throw new ConflictError('User', 'username', username);
      }

      throw new BusinessLogicError(
        result.error || 'Failed to create user',
        'USER_CREATE_FAILED',
      );
    }

    sendSuccess(
      res,
      {
        user: result.user,
      },
      { status: 201, message: 'User created successfully' },
    );
  }),
);

// Update password endpoint
router.put(
  '/password',
  authMiddleware,
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters'),
    validationMiddleware,
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    if (!req.user.userId) {
      throw new AuthenticationError('User ID not found in token');
    }

    const { currentPassword, newPassword } = req.body;

    const loginResult = await authService.login(
      req.user.username,
      currentPassword,
    );

    if (!loginResult.success) {
      throw new AuthenticationError('Current password is incorrect');
    }

    const updateResult = await authService.updatePassword(
      req.user.userId,
      currentPassword,
      newPassword,
    );

    if (!updateResult.success) {
      throw new BusinessLogicError(
        updateResult.error || 'Failed to update password',
        'PASSWORD_UPDATE_FAILED',
      );
    }

    sendSuccess(res, null, {
      message: 'Password updated successfully',
    });
  }),
);

// Reset password endpoint (admin only)
router.put(
  '/reset-password',
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters'),
    validationMiddleware,
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { userId, newPassword } = req.body;

    const result = await authService.resetPassword(userId, newPassword);

    if (!result.success) {
      if (result.error?.toLowerCase().includes('not found')) {
        throw new NotFoundError('User', userId);
      }

      throw new BusinessLogicError(
        result.error || 'Failed to reset password',
        'PASSWORD_RESET_FAILED',
      );
    }

    sendSuccess(res, null, {
      message: 'Password reset successfully',
    });
  }),
);

// Get users endpoint (admin only)
router.get(
  '/users',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const users = await authService.getUsers();

    sendSuccess(res, { users });
  }),
);

// Get user by ID endpoint (admin only)
router.get(
  '/users/:id',
  [param('id').notEmpty().withMessage('User ID is required'), validationMiddleware],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!id) {
      throw new ValidationError('User ID is required');
    }

    const user = await authService.getUserById(id);

    if (!user) {
      throw new NotFoundError('User', id);
    }

    sendSuccess(res, { user });
  }),
);

// Update user endpoint (admin only)
router.put(
  '/users/:id',
  [
    param('id').notEmpty().withMessage('User ID is required'),
    body('username')
      .optional()
      .notEmpty()
      .withMessage('Username cannot be empty'),
    body('role').optional().notEmpty().withMessage('Role cannot be empty'),
    body('is_active')
      .optional()
      .isBoolean()
      .withMessage('is_active must be a boolean'),
    validationMiddleware,
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { username, role, isActive } = req.body;

    if (!id) {
      throw new ValidationError('User ID is required');
    }

    const result = await authService.updateUser(id, {
      username,
      role,
      isActive,
    });

    if (!result.success || !result.user) {
      if (result.error?.toLowerCase().includes('exists')) {
        throw new ConflictError('User', 'username', username);
      }

      if (result.error?.toLowerCase().includes('not found')) {
        throw new NotFoundError('User', id);
      }

      throw new BusinessLogicError(
        result.error || 'Failed to update user',
        'USER_UPDATE_FAILED',
      );
    }

    sendSuccess(res, {
      user: result.user,
    });
  }),
);

// Delete user endpoint (admin only)
router.delete(
  '/users/:id',
  [param('id').notEmpty().withMessage('User ID is required'), validationMiddleware],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!id) {
      throw new ValidationError('User ID is required');
    }

    const result = await authService.deleteUser(id);

    if (!result.success) {
      if (result.error?.toLowerCase().includes('not found')) {
        throw new NotFoundError('User', id);
      }

      throw new BusinessLogicError(
        result.error || 'Failed to delete user',
        'USER_DELETE_FAILED',
      );
    }

    sendSuccess(res, null, {
      message: 'User deleted successfully',
    });
  }),
);

export default router;
