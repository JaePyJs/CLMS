"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = exports.requireStaff = exports.requireLibrarian = exports.requireAdmin = exports.optionalAuthenticate = exports.authorize = exports.authenticate = void 0;
const authService_1 = require("@/services/authService");
const logger_1 = require("@/utils/logger");
const authenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
            return;
        }
        const token = authHeader.substring(7);
        const decoded = authService_1.authService.verifyToken(token);
        if (!decoded) {
            res.status(401).json({
                success: false,
                message: 'Invalid token.'
            });
            return;
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
//# sourceMappingURL=auth.js.map