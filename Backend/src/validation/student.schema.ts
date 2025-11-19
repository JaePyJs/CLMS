import { z } from 'zod';

// Student ID validation - alphanumeric, 5-20 characters
const studentIdSchema = z
  .string()
  .min(5, 'Student ID must be at least 5 characters')
  .max(20, 'Student ID must be at most 20 characters')
  .regex(/^[A-Z0-9]+$/i, 'Student ID must contain only letters and numbers');

// Name validation - 2-50 characters, letters, spaces, hyphens
const nameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(50, 'Name must be at most 50 characters')
  .regex(
    /^[A-Za-z\s-']+$/,
    'Name must contain only letters, spaces, hyphens, and apostrophes',
  );

// Grade level validation - 1-12 (standard school grades)
const gradeLevelSchema = z
  .number()
  .int('Grade level must be a whole number')
  .min(1, 'Grade level must be at least 1')
  .max(12, 'Grade level must be at most 12');

// Barcode validation - numeric only, 9-12 digits
const barcodeSchema = z
  .string()
  .regex(/^\d{9,12}$/, 'Barcode must be 9-12 digits');

// Grade category enum
const gradeCategoryEnum = z.enum([
  'GENERAL',
  'HONOR',
  'ADVANCED_PLACEMENT',
  'SPECIAL_NEEDS',
  'OTHER',
]);

// Create student schema
export const createStudentSchema = z.object({
  student_id: studentIdSchema,
  first_name: nameSchema,
  last_name: nameSchema,
  grade_level: gradeLevelSchema,
  grade_category: gradeCategoryEnum,
  section: z.string().max(10).optional(),
  email: z.string().email('Invalid email address').optional(),
  phone: z
    .string()
    .regex(/^\+?[\d\s-()]+$/, 'Invalid phone number')
    .optional(),
  barcode: barcodeSchema.optional(),
  is_active: z.boolean().default(true),
});

// Update student schema (all fields optional)
export const updateStudentSchema = z.object({
  first_name: nameSchema.optional(),
  last_name: nameSchema.optional(),
  grade_level: gradeLevelSchema.optional(),
  grade_category: gradeCategoryEnum.optional(),
  section: z.string().max(10).optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable(),
  phone: z
    .string()
    .regex(/^\+?[\d\s-()]+$/, 'Invalid phone number')
    .optional()
    .nullable(),
  barcode: barcodeSchema.optional().nullable(),
  is_active: z.boolean().optional(),
});

// Search parameters schema
export const searchStudentsSchema = z.object({
  query: z
    .string()
    .min(1, 'Search query is required')
    .max(100, 'Search query too long'),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

// Get by barcode schema
export const getStudentByBarcodeSchema = z.object({
  barcode: barcodeSchema,
});

// Export types
export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type SearchStudentsInput = z.infer<typeof searchStudentsSchema>;
export type GetStudentByBarcodeInput = z.infer<
  typeof getStudentByBarcodeSchema
>;
