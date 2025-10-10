"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const authService_1 = require("@/services/authService");
const logger_1 = require("@/utils/logger");
const router = (0, express_1.Router)();
router.post('/login', [
    (0, express_validator_1.body)('username').notEmpty().withMessage('Username is required'),
    (0, express_validator_1.body)('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }
        const { username, password } = req.body;
        const result = await authService_1.authService.login(username, password);
        if (result.success) {
            res.json({
                success: true,
                message: 'Login successful',
                data: {
                    token: result.token,
                    user: result.user
                }
            });
        }
        else {
            res.status(401).json({
                success: false,
                message: result.error || 'Login failed'
            });
        }
    }
    catch (error) {
        logger_1.logger.error('Login error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'An error occurred during login'
        });
    }
});
router.post('/users', [
    (0, express_validator_1.body)('username').notEmpty().withMessage('Username is required'),
    (0, express_validator_1.body)('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    (0, express_validator_1.body)('role').notEmpty().withMessage('Role is required')
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }
        const { username, password, role, isActive } = req.body;
        const result = await authService_1.authService.createUser({
            username,
            password,
            role,
            isActive
        });
        if (result.success) {
            res.status(201).json({
                success: true,
                message: 'User created successfully',
                data: {
                    user: result.user
                }
            });
        }
        else {
            res.status(400).json({
                success: false,
                message: result.error || 'Failed to create user'
            });
        }
    }
    catch (error) {
        logger_1.logger.error('Create user error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'An error occurred while creating the user'
        });
    }
});
router.put('/password', [
    (0, express_validator_1.body)('currentPassword').notEmpty().withMessage('Current password is required'),
    (0, express_validator_1.body)('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        const { currentPassword, newPassword } = req.body;
        const result = await authService_1.authService.updatePassword(req.user.userId, currentPassword, newPassword);
        if (result.success) {
            res.json({
                success: true,
                message: 'Password updated successfully'
            });
        }
        else {
            res.status(400).json({
                success: false,
                message: result.error || 'Failed to update password'
            });
        }
    }
    catch (error) {
        logger_1.logger.error('Update password error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'An error occurred while updating the password'
        });
    }
});
router.put('/reset-password', [
    (0, express_validator_1.body)('userId').notEmpty().withMessage('User ID is required'),
    (0, express_validator_1.body)('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }
        const { userId, newPassword } = req.body;
        const result = await authService_1.authService.resetPassword(userId, newPassword);
        if (result.success) {
            res.json({
                success: true,
                message: 'Password reset successfully'
            });
        }
        else {
            res.status(400).json({
                success: false,
                message: result.error || 'Failed to reset password'
            });
        }
    }
    catch (error) {
        logger_1.logger.error('Reset password error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'An error occurred while resetting the password'
        });
    }
});
router.get('/users', async (req, res) => {
    try {
        const users = await authService_1.authService.getUsers();
        res.json({
            success: true,
            data: {
                users
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Get users error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching users'
        });
    }
});
router.get('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }
        const user = await authService_1.authService.getUserById(id);
        if (user) {
            res.json({
                success: true,
                data: {
                    user
                }
            });
        }
        else {
            res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
    }
    catch (error) {
        logger_1.logger.error('Get user by ID error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching the user'
        });
    }
});
router.put('/users/:id', [
    (0, express_validator_1.body)('username').optional().notEmpty().withMessage('Username cannot be empty'),
    (0, express_validator_1.body)('role').optional().notEmpty().withMessage('Role cannot be empty'),
    (0, express_validator_1.body)('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }
        const { id } = req.params;
        const { username, role, isActive } = req.body;
        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }
        const result = await authService_1.authService.updateUser(id, {
            username,
            role,
            isActive
        });
        if (result.success) {
            res.json({
                success: true,
                message: 'User updated successfully',
                data: {
                    user: result.user
                }
            });
        }
        else {
            res.status(400).json({
                success: false,
                message: result.error || 'Failed to update user'
            });
        }
    }
    catch (error) {
        logger_1.logger.error('Update user error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'An error occurred while updating the user'
        });
    }
});
router.delete('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }
        const result = await authService_1.authService.deleteUser(id);
        if (result.success) {
            res.json({
                success: true,
                message: 'User deleted successfully'
            });
        }
        else {
            res.status(400).json({
                success: false,
                message: result.error || 'Failed to delete user'
            });
        }
    }
    catch (error) {
        logger_1.logger.error('Delete user error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'An error occurred while deleting the user'
        });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map