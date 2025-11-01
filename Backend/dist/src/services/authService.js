"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = require("@/utils/logger");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient({
    log: process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'info', 'warn']
        : ['error'],
});
class AuthService {
    jwtSecret;
    jwtExpiration;
    constructor() {
        this.jwtSecret = process.env.JWT_SECRET || 'default-secret-key';
        this.jwtExpiration = process.env.JWT_EXPIRATION || '24h';
    }
    async login(username, password) {
        try {
            const user = await prisma.users.findUnique({
                where: { username },
            });
            if (!user) {
                logger_1.logger.warn(`Login attempt with non-existent username: ${username}`);
                return {
                    success: false,
                    error: 'Invalid username or password',
                };
            }
            if (!user.is_active) {
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
                id: user.id,
                username: user.username,
                role: user.role,
            };
            const token = jsonwebtoken_1.default.sign(payload, this.jwtSecret, {
                expiresIn: this.jwtExpiration,
            });
            await prisma.users.update({
                where: { id: user.id },
                data: {
                    id: crypto.randomUUID(),
                    updated_at: new Date(),
                    last_login_at: new Date(),
                },
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
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
        return bcryptjs_1.default.hash(password, saltRounds);
    }
    async createUser(userData) {
        try {
            const existingUser = await prisma.users.findUnique({
                where: { username: userData.username },
            });
            if (existingUser) {
                return {
                    success: false,
                    error: 'Username already exists',
                };
            }
            const hashedPassword = await this.hashPassword(userData.password);
            const id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            const user = await prisma.users.create({
                data: {
                    id: id,
                    username: userData.username,
                    password: hashedPassword,
                    role: userData.role,
                    is_active: userData.isActive !== undefined ? userData.isActive : true,
                    email: null,
                    full_name: null,
                    permissions: {},
                    updated_at: new Date(),
                },
            });
            logger_1.logger.info(`New user created: ${userData.username}`);
            return {
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    is_active: user.is_active,
                    last_login_at: user.last_login_at,
                    created_at: user.created_at,
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
    async updatePassword(id, currentPassword, newPassword) {
        try {
            const user = await prisma.users.findUnique({
                where: { id: id },
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
            await prisma.users.update({
                where: { id: id },
                data: {
                    id: crypto.randomUUID(),
                    updated_at: new Date(),
                    password: hashedPassword,
                },
            });
            logger_1.logger.info(`Password updated for user: ${user.username}`);
            return {
                success: true,
            };
        }
        catch (error) {
            logger_1.logger.error('Update password error', {
                error: error.message,
                id,
            });
            return {
                success: false,
                error: 'An error occurred while updating the password',
            };
        }
    }
    async resetPassword(id, newPassword) {
        try {
            const user = await prisma.users.findUnique({
                where: { id: id },
            });
            if (!user) {
                return {
                    success: false,
                    error: 'User not found',
                };
            }
            const hashedPassword = await this.hashPassword(newPassword);
            await prisma.users.update({
                where: { id: id },
                data: {
                    id: crypto.randomUUID(),
                    updated_at: new Date(),
                    password: hashedPassword,
                },
            });
            logger_1.logger.info(`Password reset for user: ${user.username}`);
            return {
                success: true,
            };
        }
        catch (error) {
            logger_1.logger.error('Reset password error', {
                error: error.message,
                id,
            });
            return {
                success: false,
                error: 'An error occurred while resetting the password',
            };
        }
    }
    async getUsers() {
        try {
            const users = await prisma.users.findMany({
                select: {
                    id: true,
                    username: true,
                    role: true,
                    is_active: true,
                    last_login_at: true,
                    created_at: true,
                },
                orderBy: { created_at: 'desc' },
            });
            return users.map(user => ({
                id: user.id,
                username: user.username,
                role: user.role,
                is_active: user.is_active,
                last_login_at: user.last_login_at,
                created_at: user.created_at,
            }));
        }
        catch (error) {
            logger_1.logger.error('Get users error', { error: error.message });
            throw error;
        }
    }
    async getUserById(id) {
        try {
            const user = await prisma.users.findUnique({
                where: { id: id },
                select: {
                    id: true,
                    username: true,
                    role: true,
                    is_active: true,
                    last_login_at: true,
                    created_at: true,
                },
            });
            if (!user) {
                return null;
            }
            return {
                id: user.id,
                username: user.username,
                role: user.role,
                is_active: user.is_active,
                last_login_at: user.last_login_at,
                created_at: user.created_at,
            };
        }
        catch (error) {
            logger_1.logger.error('Get user by ID error', {
                error: error.message,
                id,
            });
            throw error;
        }
    }
    async updateUser(id, updateData) {
        try {
            if (updateData.username) {
                const existingUser = await prisma.users.findFirst({
                    where: {
                        username: updateData.username,
                        id: { not: id },
                    },
                });
                if (existingUser) {
                    return {
                        success: false,
                        error: 'Username already exists',
                    };
                }
            }
            const updatedUser = await prisma.users.update({
                where: { id: id },
                data: {
                    username: updateData.username,
                    role: updateData.role,
                    is_active: updateData.isActive,
                    updated_at: new Date(),
                },
                select: {
                    id: true,
                    username: true,
                    role: true,
                    is_active: true,
                    last_login_at: true,
                    created_at: true,
                },
            });
            logger_1.logger.info(`User updated: ${updatedUser.username}`);
            return {
                success: true,
                user: {
                    id: updatedUser.id,
                    username: updatedUser.username,
                    role: updatedUser.role,
                    is_active: updatedUser.is_active,
                    last_login_at: updatedUser.last_login_at,
                    created_at: updatedUser.created_at,
                },
            };
        }
        catch (error) {
            logger_1.logger.error('Update user error', {
                error: error.message,
                id,
            });
            return {
                success: false,
                error: 'An error occurred while updating the user',
            };
        }
    }
    async deleteUser(id) {
        try {
            const user = await prisma.users.findUnique({
                where: { id: id },
            });
            if (!user) {
                return {
                    success: false,
                    error: 'User not found',
                };
            }
            await prisma.users.delete({
                where: { id: id },
            });
            logger_1.logger.info(`User deleted: ${user.username}`);
            return {
                success: true,
            };
        }
        catch (error) {
            logger_1.logger.error('Delete user error', {
                error: error.message,
                id,
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
