"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = require("@/utils/logger");
const prisma_1 = require("@/utils/prisma");
class AuthService {
    jwtSecret;
    jwtExpiration;
    constructor() {
        this.jwtSecret = process.env.JWT_SECRET || 'default-secret-key';
        this.jwtExpiration = process.env.JWT_EXPIRATION || '24h';
    }
    async login(username, password) {
        try {
            const user = await prisma_1.prisma.user.findUnique({
                where: { username },
            });
            if (!user) {
                logger_1.logger.warn(`Login attempt with non-existent username: ${username}`);
                return {
                    success: false,
                    error: 'Invalid username or password',
                };
            }
            if (!user.isActive) {
                logger_1.logger.warn(`Login attempt with inactive user: ${username}`);
                return {
                    success: false,
                    error: 'Account is disabled',
                };
            }
            const isPasswordValid = await bcryptjs_1.default.compare(password, user.password);
            if (!isPasswordValid) {
                logger_1.logger.warn(`Login attempt with invalid password for user: ${username}`);
                return {
                    success: false,
                    error: 'Invalid username or password',
                };
            }
            const payload = {
                userId: user.id,
                username: user.username,
                role: user.role,
            };
            const token = jsonwebtoken_1.default.sign(payload, this.jwtSecret, {
                expiresIn: this.jwtExpiration,
            });
            await prisma_1.prisma.user.update({
                where: { id: user.id },
                data: { lastLoginAt: new Date() },
            });
            logger_1.logger.info(`User logged in successfully: ${username}`);
            return {
                success: true,
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                },
            };
        }
        catch (error) {
            logger_1.logger.error('Login error', {
                error: error.message,
                username,
            });
            return {
                success: false,
                error: 'An error occurred during login',
            };
        }
    }
    verifyToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, this.jwtSecret);
            return decoded;
        }
        catch (error) {
            logger_1.logger.warn('Invalid JWT token', { error: error.message });
            return null;
        }
    }
    async hashPassword(password) {
        const saltRounds = 10;
        return bcryptjs_1.default.hash(password, saltRounds);
    }
    async createUser(userData) {
        try {
            const existingUser = await prisma_1.prisma.user.findUnique({
                where: { username: userData.username },
            });
            if (existingUser) {
                return {
                    success: false,
                    error: 'Username already exists',
                };
            }
            const hashedPassword = await this.hashPassword(userData.password);
            const user = await prisma_1.prisma.user.create({
                data: {
                    username: userData.username,
                    password: hashedPassword,
                    role: userData.role,
                    isActive: userData.isActive !== undefined ? userData.isActive : true,
                },
            });
            logger_1.logger.info(`New user created: ${userData.username}`);
            return {
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    isActive: user.isActive,
                    lastLoginAt: user.lastLoginAt,
                    createdAt: user.createdAt,
                },
            };
        }
        catch (error) {
            logger_1.logger.error('Create user error', {
                error: error.message,
                username: userData.username,
            });
            return {
                success: false,
                error: 'An error occurred while creating the user',
            };
        }
    }
    async updatePassword(userId, currentPassword, newPassword) {
        try {
            const user = await prisma_1.prisma.user.findUnique({
                where: { id: userId },
            });
            if (!user) {
                return {
                    success: false,
                    error: 'User not found',
                };
            }
            const isPasswordValid = await bcryptjs_1.default.compare(currentPassword, user.password);
            if (!isPasswordValid) {
                return {
                    success: false,
                    error: 'Current password is incorrect',
                };
            }
            const hashedPassword = await this.hashPassword(newPassword);
            await prisma_1.prisma.user.update({
                where: { id: userId },
                data: { password: hashedPassword },
            });
            logger_1.logger.info(`Password updated for user: ${user.username}`);
            return {
                success: true,
            };
        }
        catch (error) {
            logger_1.logger.error('Update password error', {
                error: error.message,
                userId,
            });
            return {
                success: false,
                error: 'An error occurred while updating the password',
            };
        }
    }
    async resetPassword(userId, newPassword) {
        try {
            const user = await prisma_1.prisma.user.findUnique({
                where: { id: userId },
            });
            if (!user) {
                return {
                    success: false,
                    error: 'User not found',
                };
            }
            const hashedPassword = await this.hashPassword(newPassword);
            await prisma_1.prisma.user.update({
                where: { id: userId },
                data: { password: hashedPassword },
            });
            logger_1.logger.info(`Password reset for user: ${user.username}`);
            return {
                success: true,
            };
        }
        catch (error) {
            logger_1.logger.error('Reset password error', {
                error: error.message,
                userId,
            });
            return {
                success: false,
                error: 'An error occurred while resetting the password',
            };
        }
    }
    async getUsers() {
        try {
            const users = await prisma_1.prisma.user.findMany({
                select: {
                    id: true,
                    username: true,
                    role: true,
                    isActive: true,
                    lastLoginAt: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
            });
            return users.map(user => ({
                id: user.id,
                username: user.username,
                role: user.role,
                isActive: user.isActive,
                lastLoginAt: user.lastLoginAt,
                createdAt: user.createdAt,
            }));
        }
        catch (error) {
            logger_1.logger.error('Get users error', { error: error.message });
            throw error;
        }
    }
    async getUserById(userId) {
        try {
            const user = await prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    username: true,
                    role: true,
                    isActive: true,
                    lastLoginAt: true,
                    createdAt: true,
                },
            });
            if (!user) {
                return null;
            }
            return {
                id: user.id,
                username: user.username,
                role: user.role,
                isActive: user.isActive,
                lastLoginAt: user.lastLoginAt,
                createdAt: user.createdAt,
            };
        }
        catch (error) {
            logger_1.logger.error('Get user by ID error', {
                error: error.message,
                userId,
            });
            throw error;
        }
    }
    async updateUser(userId, updateData) {
        try {
            if (updateData.username) {
                const existingUser = await prisma_1.prisma.user.findFirst({
                    where: {
                        username: updateData.username,
                        id: { not: userId },
                    },
                });
                if (existingUser) {
                    return {
                        success: false,
                        error: 'Username already exists',
                    };
                }
            }
            const updatedUser = await prisma_1.prisma.user.update({
                where: { id: userId },
                data: updateData,
                select: {
                    id: true,
                    username: true,
                    role: true,
                    isActive: true,
                    lastLoginAt: true,
                    createdAt: true,
                },
            });
            logger_1.logger.info(`User updated: ${updatedUser.username}`);
            return {
                success: true,
                user: {
                    id: updatedUser.id,
                    username: updatedUser.username,
                    role: updatedUser.role,
                    isActive: updatedUser.isActive,
                    lastLoginAt: updatedUser.lastLoginAt,
                    createdAt: updatedUser.createdAt,
                },
            };
        }
        catch (error) {
            logger_1.logger.error('Update user error', {
                error: error.message,
                userId,
            });
            return {
                success: false,
                error: 'An error occurred while updating the user',
            };
        }
    }
    async deleteUser(userId) {
        try {
            const user = await prisma_1.prisma.user.findUnique({
                where: { id: userId },
            });
            if (!user) {
                return {
                    success: false,
                    error: 'User not found',
                };
            }
            await prisma_1.prisma.user.delete({
                where: { id: userId },
            });
            logger_1.logger.info(`User deleted: ${user.username}`);
            return {
                success: true,
            };
        }
        catch (error) {
            logger_1.logger.error('Delete user error', {
                error: error.message,
                userId,
            });
            return {
                success: false,
                error: 'An error occurred while deleting the user',
            };
        }
    }
}
exports.AuthService = AuthService;
exports.authService = new AuthService();
exports.default = exports.authService;
//# sourceMappingURL=authService.js.map