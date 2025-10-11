"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.automationJobValidationRules = exports.systemConfigValidationRules = exports.authValidationRules = exports.idValidationRules = exports.paginationValidationRules = exports.activityValidationRules = exports.equipmentValidationRules = exports.bookValidationRules = exports.studentValidationRules = exports.validationMiddleware = void 0;
const express_validator_1 = require("express-validator");
const errors_1 = require("@/utils/errors");
const validationMiddleware = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        const validationErrors = errors
            .array()
            .map(error => {
            if (error.type === 'field') {
                const fieldError = error;
                return {
                    field: fieldError.path ?? 'unknown',
                    message: fieldError.msg,
                    value: fieldError.value,
                };
            }
            return {
                field: 'unknown',
                message: error.msg,
                value: undefined,
            };
        });
        throw new errors_1.ValidationError('Validation failed', validationErrors);
    }
    next();
};
exports.validationMiddleware = validationMiddleware;
exports.studentValidationRules = {
    create: [
        (0, express_validator_1.body)('studentId').notEmpty().withMessage('Student ID is required'),
        (0, express_validator_1.body)('firstName').notEmpty().withMessage('First name is required'),
        (0, express_validator_1.body)('lastName').notEmpty().withMessage('Last name is required'),
        (0, express_validator_1.body)('gradeLevel').notEmpty().withMessage('Grade level is required'),
        (0, express_validator_1.body)('gradeCategory')
            .isIn(['PRIMARY', 'GRADE_SCHOOL', 'JUNIOR_HIGH', 'SENIOR_HIGH'])
            .withMessage('Invalid grade category'),
        (0, express_validator_1.body)('section')
            .optional()
            .isString()
            .withMessage('Section must be a string'),
    ],
    update: [
        (0, express_validator_1.body)('firstName')
            .optional()
            .notEmpty()
            .withMessage('First name cannot be empty'),
        (0, express_validator_1.body)('lastName')
            .optional()
            .notEmpty()
            .withMessage('Last name cannot be empty'),
        (0, express_validator_1.body)('gradeLevel')
            .optional()
            .notEmpty()
            .withMessage('Grade level cannot be empty'),
        (0, express_validator_1.body)('gradeCategory')
            .optional()
            .isIn(['PRIMARY', 'GRADE_SCHOOL', 'JUNIOR_HIGH', 'SENIOR_HIGH'])
            .withMessage('Invalid grade category'),
        (0, express_validator_1.body)('section')
            .optional()
            .isString()
            .withMessage('Section must be a string'),
        (0, express_validator_1.body)('isActive')
            .optional()
            .isBoolean()
            .withMessage('isActive must be a boolean'),
    ],
};
exports.bookValidationRules = {
    create: [
        (0, express_validator_1.body)('accessionNo').notEmpty().withMessage('Accession number is required'),
        (0, express_validator_1.body)('title').notEmpty().withMessage('Title is required'),
        (0, express_validator_1.body)('author').notEmpty().withMessage('Author is required'),
        (0, express_validator_1.body)('category').notEmpty().withMessage('Category is required'),
        (0, express_validator_1.body)('isbn').optional().isISBN().withMessage('Invalid ISBN format'),
        (0, express_validator_1.body)('publisher')
            .optional()
            .isString()
            .withMessage('Publisher must be a string'),
        (0, express_validator_1.body)('subcategory')
            .optional()
            .isString()
            .withMessage('Subcategory must be a string'),
        (0, express_validator_1.body)('location')
            .optional()
            .isString()
            .withMessage('Location must be a string'),
        (0, express_validator_1.body)('totalCopies')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Total copies must be a positive integer'),
    ],
    update: [
        (0, express_validator_1.body)('accessionNo')
            .optional()
            .notEmpty()
            .withMessage('Accession number cannot be empty'),
        (0, express_validator_1.body)('title').optional().notEmpty().withMessage('Title cannot be empty'),
        (0, express_validator_1.body)('author').optional().notEmpty().withMessage('Author cannot be empty'),
        (0, express_validator_1.body)('category')
            .optional()
            .notEmpty()
            .withMessage('Category cannot be empty'),
        (0, express_validator_1.body)('isbn').optional().isISBN().withMessage('Invalid ISBN format'),
        (0, express_validator_1.body)('publisher')
            .optional()
            .isString()
            .withMessage('Publisher must be a string'),
        (0, express_validator_1.body)('subcategory')
            .optional()
            .isString()
            .withMessage('Subcategory must be a string'),
        (0, express_validator_1.body)('location')
            .optional()
            .isString()
            .withMessage('Location must be a string'),
        (0, express_validator_1.body)('totalCopies')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Total copies must be a positive integer'),
        (0, express_validator_1.body)('isActive')
            .optional()
            .isBoolean()
            .withMessage('isActive must be a boolean'),
    ],
};
exports.equipmentValidationRules = {
    create: [
        (0, express_validator_1.body)('equipmentId').notEmpty().withMessage('Equipment ID is required'),
        (0, express_validator_1.body)('name').notEmpty().withMessage('Equipment name is required'),
        (0, express_validator_1.body)('type')
            .isIn(['COMPUTER', 'GAMING', 'AVR', 'PRINTER', 'SCANNER', 'OTHER'])
            .withMessage('Invalid equipment type'),
        (0, express_validator_1.body)('location').notEmpty().withMessage('Location is required'),
        (0, express_validator_1.body)('status')
            .optional()
            .isIn(['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OUT_OF_ORDER'])
            .withMessage('Invalid equipment status'),
        (0, express_validator_1.body)('maxTimeMinutes')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Max time minutes must be a positive integer'),
        (0, express_validator_1.body)('requiresSupervision')
            .optional()
            .isBoolean()
            .withMessage('Requires supervision must be a boolean'),
        (0, express_validator_1.body)('description')
            .optional()
            .isString()
            .withMessage('Description must be a string'),
    ],
    update: [
        (0, express_validator_1.body)('name')
            .optional()
            .notEmpty()
            .withMessage('Equipment name cannot be empty'),
        (0, express_validator_1.body)('type')
            .optional()
            .isIn(['COMPUTER', 'GAMING', 'AVR', 'PRINTER', 'SCANNER', 'OTHER'])
            .withMessage('Invalid equipment type'),
        (0, express_validator_1.body)('location')
            .optional()
            .notEmpty()
            .withMessage('Location cannot be empty'),
        (0, express_validator_1.body)('status')
            .optional()
            .isIn(['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OUT_OF_ORDER'])
            .withMessage('Invalid equipment status'),
        (0, express_validator_1.body)('maxTimeMinutes')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Max time minutes must be a positive integer'),
        (0, express_validator_1.body)('requiresSupervision')
            .optional()
            .isBoolean()
            .withMessage('Requires supervision must be a boolean'),
        (0, express_validator_1.body)('description')
            .optional()
            .isString()
            .withMessage('Description must be a string'),
    ],
};
exports.activityValidationRules = {
    create: [
        (0, express_validator_1.body)('studentId').notEmpty().withMessage('Student ID is required'),
        (0, express_validator_1.body)('activityType')
            .isIn([
            'COMPUTER_USE',
            'GAMING_SESSION',
            'AVR_SESSION',
            'BOOK_CHECKOUT',
            'BOOK_RETURN',
            'GENERAL_VISIT',
            'RECREATION',
            'STUDY',
            'OTHER',
        ])
            .withMessage('Invalid activity type'),
        (0, express_validator_1.body)('equipmentId')
            .optional()
            .isString()
            .withMessage('Equipment ID must be a string'),
        (0, express_validator_1.body)('timeLimitMinutes')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Time limit minutes must be a positive integer'),
        (0, express_validator_1.body)('notes').optional().isString().withMessage('Notes must be a string'),
    ],
    update: [
        (0, express_validator_1.body)('status')
            .optional()
            .isIn(['ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED', 'EXTENDED'])
            .withMessage('Invalid activity status'),
        (0, express_validator_1.body)('endTime')
            .optional()
            .isISO8601()
            .withMessage('End time must be a valid ISO 8601 date'),
        (0, express_validator_1.body)('durationMinutes')
            .optional()
            .isInt({ min: 0 })
            .withMessage('Duration minutes must be a non-negative integer'),
        (0, express_validator_1.body)('notes').optional().isString().withMessage('Notes must be a string'),
    ],
};
exports.paginationValidationRules = [
    (0, express_validator_1.query)('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    (0, express_validator_1.query)('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    (0, express_validator_1.query)('sortBy').optional().isString().withMessage('Sort by must be a string'),
    (0, express_validator_1.query)('sortOrder')
        .optional()
        .isIn(['asc', 'desc'])
        .withMessage('Sort order must be asc or desc'),
];
exports.idValidationRules = [
    (0, express_validator_1.param)('id').notEmpty().withMessage('ID is required'),
];
exports.authValidationRules = {
    login: [
        (0, express_validator_1.body)('username').notEmpty().withMessage('Username is required'),
        (0, express_validator_1.body)('password').notEmpty().withMessage('Password is required'),
    ],
};
exports.systemConfigValidationRules = {
    update: [
        (0, express_validator_1.body)('value').notEmpty().withMessage('Value is required'),
        (0, express_validator_1.body)('description')
            .optional()
            .isString()
            .withMessage('Description must be a string'),
        (0, express_validator_1.body)('isSecret')
            .optional()
            .isBoolean()
            .withMessage('Is secret must be a boolean'),
    ],
};
exports.automationJobValidationRules = {
    create: [
        (0, express_validator_1.body)('name').notEmpty().withMessage('Job name is required'),
        (0, express_validator_1.body)('type')
            .isIn([
            'DAILY_BACKUP',
            'TEACHER_NOTIFICATIONS',
            'GOOGLE_SHEETS_SYNC',
            'SESSION_EXPIRY_CHECK',
            'OVERDUE_NOTIFICATIONS',
            'WEEKLY_CLEANUP',
            'MONTHLY_REPORT',
            'INTEGRITY_AUDIT',
        ])
            .withMessage('Invalid job type'),
        (0, express_validator_1.body)('schedule').notEmpty().withMessage('Schedule is required'),
        (0, express_validator_1.body)('description')
            .optional()
            .isString()
            .withMessage('Description must be a string'),
        (0, express_validator_1.body)('isEnabled')
            .optional()
            .isBoolean()
            .withMessage('Is enabled must be a boolean'),
        (0, express_validator_1.body)('config')
            .optional()
            .isObject()
            .withMessage('Config must be an object'),
    ],
    update: [
        (0, express_validator_1.body)('name').optional().notEmpty().withMessage('Job name cannot be empty'),
        (0, express_validator_1.body)('schedule')
            .optional()
            .notEmpty()
            .withMessage('Schedule cannot be empty'),
        (0, express_validator_1.body)('description')
            .optional()
            .isString()
            .withMessage('Description must be a string'),
        (0, express_validator_1.body)('isEnabled')
            .optional()
            .isBoolean()
            .withMessage('Is enabled must be a boolean'),
        (0, express_validator_1.body)('config')
            .optional()
            .isObject()
            .withMessage('Config must be an object'),
    ],
};
//# sourceMappingURL=validation.js.map