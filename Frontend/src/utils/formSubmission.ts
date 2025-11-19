import { toast } from 'sonner';
import { z } from 'zod';

/**
 * Form submission state
 */
export interface FormSubmissionState {
  isSubmitting: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: string | null;
}

/**
 * Options for form submission handling
 */
export interface FormSubmissionOptions<T = unknown> {
  /** Success message to display */
  successMessage?: string;
  /** Error message to display (overrides default) */
  errorMessage?: string;
  /** Callback on success */
  onSuccess?: (data: T) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Prevent duplicate submissions */
  preventDuplicates?: boolean;
}

/**
 * Result of form submission
 */
export interface FormSubmissionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: Error;
}

/**
 * Handle form submission with loading states, validation, and toast notifications
 *
 * @example
 * ```tsx
 * const handleSubmit = handleFormSubmission(
 *   async (data) => {
 *     return await api.createStudent(data);
 *   },
 *   {
 *     successMessage: 'Student created successfully',
 *     onSuccess: () => navigate('/students'),
 *   }
 * );
 * ```
 */
export function handleFormSubmission<TInput = unknown, TOutput = unknown>(
  submitFn: (data: TInput) => Promise<TOutput>,
  options: FormSubmissionOptions<TOutput> = {}
) {
  const {
    successMessage = 'Operation completed successfully',
    errorMessage,
    onSuccess,
    onError,
    preventDuplicates = true,
  } = options;

  let isSubmitting = false;

  return async (data: TInput): Promise<FormSubmissionResult<TOutput>> => {
    // Prevent duplicate submissions
    if (preventDuplicates && isSubmitting) {
      toast.warning('Please wait, submitting...');
      return { success: false };
    }

    isSubmitting = true;

    try {
      const result = await submitFn(data);

      toast.success(successMessage);

      if (onSuccess) {
        onSuccess(result);
      }

      return { success: true, data: result };
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error('An unknown error occurred');

      toast.error(errorMessage || err.message || 'Operation failed');

      if (onError) {
        onError(err);
      }

      return { success: false, error: err };
    } finally {
      isSubmitting = false;
    }
  };
}

/**
 * Validate form data with Zod schema
 *
 * @example
 * ```tsx
 * const result = validateFormData(loginSchema, formData);
 * if (!result.success) {
 *   setErrors(result.errors);
 *   return;
 * }
 * ```
 */
export function validateFormData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
):
  | { success: true; data: T }
  | { success: false; errors: Record<string, string> } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {};

      for (const issue of error.issues) {
        const path = issue.path.join('.');
        errors[path] = issue.message;
      }

      return { success: false, errors };
    }

    return {
      success: false,
      errors: { _form: 'Validation failed' },
    };
  }
}

/**
 * Extract error message from various error types
 */
export function getErrorMessage(
  error: unknown,
  fallback = 'An error occurred'
): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }

  return fallback;
}

/**
 * Show validation errors as toast notifications
 */
export function showValidationErrors(errors: Record<string, string>): void {
  const errorMessages = Object.values(errors);

  if (errorMessages.length === 1) {
    toast.error(errorMessages[0]);
  } else if (errorMessages.length > 1) {
    toast.error('Please fix the following errors:', {
      description: errorMessages.join(', '),
    });
  }
}
