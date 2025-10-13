"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const authService_1 = require("@/services/authService");
const auth_1 = require("@/middleware/auth");
const validation_1 = require("@/middleware/validation");
const asyncHandler_1 = require("@/utils/asyncHandler");
const apiResponse_1 = require("@/utils/apiResponse");
const errors_1 = require("@/utils/errors");
const router = (0, express_1.Router)();
router.get('/me', auth_1.authMiddleware, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        throw new errors_1.AuthenticationError('Not authenticated');
    }
    const user = await authService_1.authService.getUserById(req.user.userId);
    if (!user) {
        throw new errors_1.NotFoundError('User', req.user.userId);
    }
    return (0, apiResponse_1.sendSuccess)(res, {
        user: {
            id: user.id,
            username: user.username,
            role: user.role,
            isActive: user.isActive,
            lastLoginAt: user.lastLoginAt,
            createdAt: user.createdAt,
        },
    });
}));
router.post('/login', [
    (0, express_validator_1.body)('username').notEmpty().withMessage('Username is required'),
    (0, express_validator_1.body)('password').notEmpty().withMessage('Password is required'),
    validation_1.validationMiddleware,
], (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { username, password } = req.body;
    const result = await authService_1.authService.login(username, password);
    if (!result.success || !result.token || !result.user) {
        throw new errors_1.AuthenticationError(result.error || 'Invalid credentials');
    }
    return (0, apiResponse_1.sendSuccess)(res, {
        token: result.token,
        user: result.user,
    }, { message: 'Login successful' });
}));
router.post('/users', [
    (0, express_validator_1.body)('username').notEmpty().withMessage('Username is required'),
    (0, express_validator_1.body)('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters'),
    (0, express_validator_1.body)('role').notEmpty().withMessage('Role is required'),
    validation_1.validationMiddleware,
], (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { username, password, role, isActive } = req.body;
    const result = await authService_1.authService.createUser({
        username,
        password,
        role,
        isActive,
    });
    if (!result.success || !result.user) {
        if (result.error?.toLowerCase().includes('exists')) {
            throw new errors_1.ConflictError('User', 'username', username);
        }
        throw new errors_1.BusinessLogicError(result.error || 'Failed to create user', 'USER_CREATE_FAILED');
    }
    return (0, apiResponse_1.sendSuccess)(res, {
        user: result.user,
    }, { status: 201, message: 'User created successfully' });
}));
router.put('/password', auth_1.authMiddleware, [
    (0, express_validator_1.body)('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),
    (0, express_validator_1.body)('newPassword')
        .isLength({ min: 6 })
        .withMessage('New password must be at least 6 characters'),
    validation_1.validationMiddleware,
], (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        throw new errors_1.AuthenticationError('Authentication required');
    }
    const { currentPassword, newPassword } = req.body;
    const loginResult = await authService_1.authService.login(req.user.username, currentPassword);
    if (!loginResult.success) {
        throw new errors_1.AuthenticationError('Current password is incorrect');
    }
    const updateResult = await authService_1.authService.updatePassword(req.user.userId, currentPassword, newPassword);
    if (!updateResult.success) {
        throw new errors_1.BusinessLogicError(updateResult.error || 'Failed to update password', 'PASSWORD_UPDATE_FAILED');
    }
    return (0, apiResponse_1.sendSuccess)(res, null, {
        message: 'Password updated successfully',
    });
}));
router.put('/reset-password', [
    (0, express_validator_1.body)('userId').notEmpty().withMessage('User ID is required'),
    (0, express_validator_1.body)('newPassword')
        .isLength({ min: 6 })
        .withMessage('New password must be at least 6 characters'),
    validation_1.validationMiddleware,
], (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { userId, newPassword } = req.body;
    const result = await authService_1.authService.resetPassword(userId, newPassword);
    if (!result.success) {
        if (result.error?.toLowerCase().includes('not found')) {
            throw new errors_1.NotFoundError('User', userId);
        }
        throw new errors_1.BusinessLogicError(result.error || 'Failed to reset password', 'PASSWORD_RESET_FAILED');
    }
    return (0, apiResponse_1.sendSuccess)(res, null, {
        message: 'Password reset successfully',
    });
}));
router.get('/users', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const users = await authService_1.authService.getUsers();
    return (0, apiResponse_1.sendSuccess)(res, { users });
}));
router.get('/users/:id', [(0, express_validator_1.param)('id').notEmpty().withMessage('User ID is required'), validation_1.validationMiddleware], (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const user = await authService_1.authService.getUserById(id);
    if (!user) {
        throw new errors_1.NotFoundError('User', id);
    }
    return (0, apiResponse_1.sendSuccess)(res, { user });
}));
router.put('/users/:id', [
    (0, express_validator_1.param)('id').notEmpty().withMessage('User ID is required'),
    (0, express_validator_1.body)('username')
        .optional()
        .notEmpty()
        .withMessage('Username cannot be empty'),
    (0, express_validator_1.body)('role').optional().notEmpty().withMessage('Role cannot be empty'),
    (0, express_validator_1.body)('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean'),
    validation_1.validationMiddleware,
], (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { username, role, isActive } = req.body;
    const result = await authService_1.authService.updateUser(id, {
        username,
        role,
        isActive,
    });
    if (!result.success || !result.user) {
        if (result.error?.toLowerCase().includes('exists')) {
            throw new errors_1.ConflictError('User', 'username', username);
        }
        if (result.error?.toLowerCase().includes('not found')) {
            throw new errors_1.NotFoundError('User', id);
        }
        throw new errors_1.BusinessLogicError(result.error || 'Failed to update user', 'USER_UPDATE_FAILED');
    }
    return (0, apiResponse_1.sendSuccess)(res, {
        user: result.user,
    });
}));
router.delete('/users/:id', [(0, express_validator_1.param)('id').notEmpty().withMessage('User ID is required'), validation_1.validationMiddleware], (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const result = await authService_1.authService.deleteUser(id);
    if (!result.success) {
        if (result.error?.toLowerCase().includes('not found')) {
            throw new errors_1.NotFoundError('User', id);
        }
        throw new errors_1.BusinessLogicError(result.error || 'Failed to delete user', 'USER_DELETE_FAILED');
    }
    return (0, apiResponse_1.sendSuccess)(res, null, {
        message: 'User deleted successfully',
    });
}));
exports.default = router;
//# sourceMappingURL=auth.js.map