import { z } from 'zod';

/**
 * Student form validation schema
 */
export const studentSchema = z.object({
  studentId: z
    .string()
    .min(1, 'Student ID is required')
    .max(50, 'Student ID must be less than 50 characters')
    .regex(
      /^[A-Za-z0-9-]+$/,
      'Student ID must contain only letters, numbers, and hyphens'
    ),

  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name must be less than 100 characters')
    .regex(
      /^[A-Za-z\s'-]+$/,
      'First name must contain only letters, spaces, hyphens, and apostrophes'
    ),

  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(100, 'Last name must be less than 100 characters')
    .regex(
      /^[A-Za-z\s'-]+$/,
      'Last name must contain only letters, spaces, hyphens, and apostrophes'
    ),

  email: z
    .string()
    .email('Invalid email address')
    .max(255, 'Email must be less than 255 characters')
    .optional()
    .or(z.literal('')),

  phone: z
    .string()
    .regex(
      /^[0-9\s\-+()]*$/,
      'Phone number must contain only numbers and standard formatting characters'
    )
    .max(20, 'Phone number must be less than 20 characters')
    .optional()
    .or(z.literal('')),

  gradeLevel: z
    .string()
    .min(1, 'Grade level is required')
    .max(50, 'Grade level must be less than 50 characters'),

  status: z
    .enum(['ACTIVE', 'INACTIVE', 'SUSPENDED'], {
      errorMap: () => ({ message: 'Invalid student status' }),
    })
    .default('ACTIVE'),

  notes: z
    .string()
    .max(500, 'Notes must be less than 500 characters')
    .optional()
    .or(z.literal('')),
});

/**
 * Book form validation schema
 */
export const bookSchema = z.object({
  isbn: z
    .string()
    .regex(/^(?:\d{10}|\d{13})$/, 'ISBN must be 10 or 13 digits')
    .optional()
    .or(z.literal('')),

  title: z
    .string()
    .min(1, 'Title is required')
    .max(500, 'Title must be less than 500 characters'),

  author: z
    .string()
    .min(1, 'Author is required')
    .max(255, 'Author must be less than 255 characters'),

  publisher: z
    .string()
    .max(255, 'Publisher must be less than 255 characters')
    .optional()
    .or(z.literal('')),

  publishedYear: z
    .number()
    .int('Year must be a whole number')
    .min(1000, 'Year must be 1000 or later')
    .max(new Date().getFullYear() + 1, 'Year cannot be in the future')
    .optional()
    .or(z.literal(null)),

  genre: z
    .string()
    .max(100, 'Genre must be less than 100 characters')
    .optional()
    .or(z.literal('')),

  deweyDecimal: z
    .string()
    .regex(
      /^\d{3}(?:\.\d+)?$/,
      'Dewey Decimal must be in format: 123 or 123.45'
    )
    .optional()
    .or(z.literal('')),

  quantity: z
    .number()
    .int('Quantity must be a whole number')
    .min(0, 'Quantity cannot be negative')
    .default(1),

  location: z
    .string()
    .max(100, 'Location must be less than 100 characters')
    .optional()
    .or(z.literal('')),

  status: z
    .enum(['AVAILABLE', 'CHECKED_OUT', 'LOST', 'DAMAGED', 'PROCESSING'], {
      errorMap: () => ({ message: 'Invalid book status' }),
    })
    .default('AVAILABLE'),

  notes: z
    .string()
    .max(1000, 'Notes must be less than 1000 characters')
    .optional()
    .or(z.literal('')),
});

/**
 * Checkout form validation schema
 */
export const checkoutSchema = z.object({
  studentId: z.string().min(1, 'Student is required'),

  bookId: z.string().min(1, 'Book is required'),

  dueDate: z
    .date()
    .min(new Date(), 'Due date must be in the future')
    .optional(),

  notes: z
    .string()
    .max(500, 'Notes must be less than 500 characters')
    .optional()
    .or(z.literal('')),
});

/**
 * Bulk import validation schema
 */
export const bulkImportSchema = z.object({
  file: z
    .instanceof(File, { message: 'Please select a file to upload' })
    .refine(
      (file) => file.size <= 5 * 1024 * 1024,
      'File size must be less than 5MB'
    )
    .refine(
      (file) =>
        [
          'text/csv',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ].includes(file.type),
      'File must be CSV or Excel format'
    ),

  type: z.enum(['students', 'books'], {
    errorMap: () => ({ message: 'Invalid import type' }),
  }),

  skipDuplicates: z.boolean().default(true),

  updateExisting: z.boolean().default(false),
});

// Type exports
export type StudentFormData = z.infer<typeof studentSchema>;
export type BookFormData = z.infer<typeof bookSchema>;
export type CheckoutFormData = z.infer<typeof checkoutSchema>;
export type BulkImportFormData = z.infer<typeof bulkImportSchema>;
