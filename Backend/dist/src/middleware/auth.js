"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = exports.requireStaff = exports.requireLibrarian = exports.requireAdmin = exports.optionalAuthenticate = exports.authorize = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authService_1 = require("@/services/authService");
const enhancedAuthService_1 = require("@/services/enhancedAuthService");
const logger_1 = require("@/utils/logger");
const authenticate = async (req, res, next) => {
    try {
        let token;
        if (req.cookies?.accessToken) {
            token = req.cookies.accessToken;
        }
        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader?.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }
        if (!token) {
            res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
            return;
        }
        const jwtSecret = process.env.JWT_SECRET || 'default-secret-key';
        const expectedIssuer = process.env.JWT_ISSUER || 'clms-api';
        const expectedAudience = process.env.JWT_AUDIENCE || 'clms-frontend';
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, jwtSecret, {
                issuer: expectedIssuer,
                audience: expectedAudience,
                algorithms: ['HS256']
            });
        }
        catch (jwtError) {
            const error = jwtError;
            if (error.name === 'TokenExpiredError') {
                res.status(401).json({
                    success: false,
                    message: 'Token expired. Please refresh your token.',
                    code: 'TOKEN_EXPIRED'
                });
                return;
            }
            logger_1.logger.warn('Invalid JWT token', {
                error: error.message,
                name: error.name
            });
            res.status(401).json({
                success: false,
                message: 'Invalid token.'
            });
            return;
        }
        if (decoded.sessionId) {
            const isValid = await enhancedAuthService_1.enhancedAuthService.validateSession(decoded.sessionId);
            if (!isValid) {
                res.status(401).json({
                    success: false,
                    message: 'Session has been revoked. Please login again.',
                    code: 'SESSION_REVOKED'
                });
                return;
            }
        }
        req.user = decoded;
        next();
    }
    catch (error) {
        logger_1.logger.error('Authentication error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'An error occurred during authentication.'
        });
    }
};
exports.authenticate = authenticate;
const authorize = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Access denied. Authentication required.'
            });
            return;
        }
        if (!roles.includes(req.user.role)) {
            res.status(403).json({
                success: false,
                message: 'Access denied. Insufficient permissions.'
            });
            return;
        }
        next();
    };
};
exports.authorize = authorize;
const optionalAuthenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            next();
            return;
        }
        const token = authHeader.substring(7);
        const decoded = authService_1.authService.verifyToken(token);
        if (decoded) {
            req.user = decoded;
        }
        next();
    }
    catch (error) {
        logger_1.logger.error('Optional authentication error', { error: error.message });
        next();
    }
};
exports.optionalAuthenticate = optionalAuthenticate;
exports.requireAdmin = (0, exports.authorize)(['ADMIN']);
exports.requireLibrarian = (0, exports.authorize)(['ADMIN', 'LIBRARIAN']);
exports.requireStaff = (0, exports.authorize)(['ADMIN', 'LIBRARIAN', 'STAFF']);
exports.authMiddleware = exports.authenticate;
