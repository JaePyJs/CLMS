import { Request, Response, NextFunction } from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { ValidationError } from '@/utils/errors'

export const validationMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req)

  if (!errors.isEmpty()) {
    const validationErrors = errors.array().map(error => ({
      field: error.type === 'field' ? (error as any).path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? (error as any).value : undefined
    }))

    throw new ValidationError('Validation failed', validationErrors)
  }

  next()
}

// Validation rules for common entities
export const studentValidationRules = {
  create: [
    body('studentId').notEmpty().withMessage('Student ID is required'),
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
    body('gradeLevel').notEmpty().withMessage('Grade level is required'),
    body('gradeCategory').isIn(['PRIMARY', 'GRADE_SCHOOL', 'JUNIOR_HIGH', 'SENIOR_HIGH']).withMessage('Invalid grade category'),
    body('section').optional().isString().withMessage('Section must be a string')
  ],

  update: [
    body('firstName').optional().notEmpty().withMessage('First name cannot be empty'),
    body('lastName').optional().notEmpty().withMessage('Last name cannot be empty'),
    body('gradeLevel').optional().notEmpty().withMessage('Grade level cannot be empty'),
    body('gradeCategory').optional().isIn(['PRIMARY', 'GRADE_SCHOOL', 'JUNIOR_HIGH', 'SENIOR_HIGH']).withMessage('Invalid grade category'),
    body('section').optional().isString().withMessage('Section must be a string'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
  ]
}

export const bookValidationRules = {
  create: [
    body('accessionNo').notEmpty().withMessage('Accession number is required'),
    body('title').notEmpty().withMessage('Title is required'),
    body('author').notEmpty().withMessage('Author is required'),
    body('category').notEmpty().withMessage('Category is required'),
    body('isbn').optional().isISBN().withMessage('Invalid ISBN format'),
    body('publisher').optional().isString().withMessage('Publisher must be a string'),
    body('subcategory').optional().isString().withMessage('Subcategory must be a string'),
    body('location').optional().isString().withMessage('Location must be a string'),
    body('totalCopies').optional().isInt({ min: 1 }).withMessage('Total copies must be a positive integer')
  ],

  update: [
    body('accessionNo').optional().notEmpty().withMessage('Accession number cannot be empty'),
    body('title').optional().notEmpty().withMessage('Title cannot be empty'),
    body('author').optional().notEmpty().withMessage('Author cannot be empty'),
    body('category').optional().notEmpty().withMessage('Category cannot be empty'),
    body('isbn').optional().isISBN().withMessage('Invalid ISBN format'),
    body('publisher').optional().isString().withMessage('Publisher must be a string'),
    body('subcategory').optional().isString().withMessage('Subcategory must be a string'),
    body('location').optional().isString().withMessage('Location must be a string'),
    body('totalCopies').optional().isInt({ min: 1 }).withMessage('Total copies must be a positive integer'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
  ]
}

export const equipmentValidationRules = {
  create: [
    body('equipmentId').notEmpty().withMessage('Equipment ID is required'),
    body('name').notEmpty().withMessage('Equipment name is required'),
    body('type').isIn(['COMPUTER', 'GAMING', 'AVR', 'PRINTER', 'SCANNER', 'OTHER']).withMessage('Invalid equipment type'),
    body('location').notEmpty().withMessage('Location is required'),
    body('status').optional().isIn(['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OUT_OF_ORDER']).withMessage('Invalid equipment status'),
    body('maxTimeMinutes').optional().isInt({ min: 1 }).withMessage('Max time minutes must be a positive integer'),
    body('requiresSupervision').optional().isBoolean().withMessage('Requires supervision must be a boolean'),
    body('description').optional().isString().withMessage('Description must be a string')
  ],

  update: [
    body('name').optional().notEmpty().withMessage('Equipment name cannot be empty'),
    body('type').optional().isIn(['COMPUTER', 'GAMING', 'AVR', 'PRINTER', 'SCANNER', 'OTHER']).withMessage('Invalid equipment type'),
    body('location').optional().notEmpty().withMessage('Location cannot be empty'),
    body('status').optional().isIn(['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OUT_OF_ORDER']).withMessage('Invalid equipment status'),
    body('maxTimeMinutes').optional().isInt({ min: 1 }).withMessage('Max time minutes must be a positive integer'),
    body('requiresSupervision').optional().isBoolean().withMessage('Requires supervision must be a boolean'),
    body('description').optional().isString().withMessage('Description must be a string')
  ]
}

export const activityValidationRules = {
  create: [
    body('studentId').notEmpty().withMessage('Student ID is required'),
    body('activityType').isIn(['COMPUTER_USE', 'GAMING_SESSION', 'AVR_SESSION', 'BOOK_CHECKOUT', 'BOOK_RETURN', 'GENERAL_VISIT', 'RECREATION', 'STUDY', 'OTHER']).withMessage('Invalid activity type'),
    body('equipmentId').optional().isString().withMessage('Equipment ID must be a string'),
    body('timeLimitMinutes').optional().isInt({ min: 1 }).withMessage('Time limit minutes must be a positive integer'),
    body('notes').optional().isString().withMessage('Notes must be a string')
  ],

  update: [
    body('status').optional().isIn(['ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED', 'EXTENDED']).withMessage('Invalid activity status'),
    body('endTime').optional().isISO8601().withMessage('End time must be a valid ISO 8601 date'),
    body('durationMinutes').optional().isInt({ min: 0 }).withMessage('Duration minutes must be a non-negative integer'),
    body('notes').optional().isString().withMessage('Notes must be a string')
  ]
}

export const paginationValidationRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('sortBy').optional().isString().withMessage('Sort by must be a string'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc')
]

export const idValidationRules = [
  param('id').notEmpty().withMessage('ID is required')
]

export const authValidationRules = {
  login: [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required')
  ]
}

export const systemConfigValidationRules = {
  update: [
    body('value').notEmpty().withMessage('Value is required'),
    body('description').optional().isString().withMessage('Description must be a string'),
    body('isSecret').optional().isBoolean().withMessage('Is secret must be a boolean')
  ]
}

export const automationJobValidationRules = {
  create: [
    body('name').notEmpty().withMessage('Job name is required'),
    body('type').isIn(['DAILY_BACKUP', 'TEACHER_NOTIFICATIONS', 'GOOGLE_SHEETS_SYNC', 'SESSION_EXPIRY_CHECK', 'OVERDUE_NOTIFICATIONS', 'WEEKLY_CLEANUP', 'MONTHLY_REPORT', 'INTEGRITY_AUDIT']).withMessage('Invalid job type'),
    body('schedule').notEmpty().withMessage('Schedule is required'),
    body('description').optional().isString().withMessage('Description must be a string'),
    body('isEnabled').optional().isBoolean().withMessage('Is enabled must be a boolean'),
    body('config').optional().isObject().withMessage('Config must be an object')
  ],

  update: [
    body('name').optional().notEmpty().withMessage('Job name cannot be empty'),
    body('schedule').optional().notEmpty().withMessage('Schedule cannot be empty'),
    body('description').optional().isString().withMessage('Description must be a string'),
    body('isEnabled').optional().isBoolean().withMessage('Is enabled must be a boolean'),
    body('config').optional().isObject().withMessage('Config must be an object')
  ]
}