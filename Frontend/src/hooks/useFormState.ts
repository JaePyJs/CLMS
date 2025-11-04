import { useState, useCallback, useRef, useEffect } from 'react';

interface FormErrors {
  [key: string]: string | string[] | null | undefined;
}

interface FormState {
  values: Record<string, any>;
  errors: FormErrors;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValidating: boolean;
  submitCount: number;
}

interface FormActions {
  setValue: (name: string, value: any, shouldValidate?: boolean) => void;
  setFieldValue: (name: string, value: any, shouldValidate?: boolean) => void;
  setValues: (values: Record<string, any>, shouldValidate?: boolean) => void;
  setError: (name: string, error: string | string[]) => void;
  setErrors: (errors: FormErrors) => void;
  clearError: (name: string) => void;
  clearErrors: () => void;
  setTouched: (name: string, touched?: boolean) => void;
  reset: (values?: Record<string, any>) => void;
  validate: () => boolean;
  validateField: (name: string) => boolean;
  submit: () => Promise<void>;
  resetForm: () => void;
}

/**
 * Hook for managing form states with validation and submission handling
 * 
 * @param options - Form configuration options
 * @returns [state, actions] - Current state and actions to modify it
 * 
 * @example
 * const [state, actions] = useForm({
 *   initialValues: { name: '', email: '' },
 *   validationSchema: {
 *     name: { required: true, minLength: 2 },
 *     email: { required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
 *   },
 *   onSubmit: async (values) => {
 *     await submitStudent(values);
 *   },
 * });
 * 
 * // In JSX
 * <input
 *   value={state.values.name}
 *   onChange={(e) => actions.setValue('name', e.target.value)}
 *   onBlur={() => actions.setTouched('name')}
 * />
 * {state.errors.name && <span>{state.errors.name}</span>}
 */
export function useForm(
  options: {
    initialValues?: Record<string, any>;
    validationSchema?: Record<string, {
      required?: boolean;
      minLength?: number;
      maxLength?: number;
      pattern?: RegExp;
      custom?: (value: any, values: Record<string, any>) => string | null;
    }>;
    onSubmit?: (values: Record<string, any>) => Promise<void> | void;
    validateOnChange?: boolean;
    validateOnBlur?: boolean;
    resetOnSubmit?: boolean;
  } = {}
) {
  const {
    initialValues = {},
    validationSchema = {},
    onSubmit,
    validateOnChange = true,
    validateOnBlur = true,
    resetOnSubmit = false,
  } = options;

  const [state, setState] = useState<FormState>({
    values: initialValues,
    errors: {},
    touched: {},
    isSubmitting: false,
    isValidating: false,
    submitCount: 0,
  });

  const validationCache = useRef(new Map<string, string | null>());

  // Validation functions
  const validateField = useCallback((name: string, value: any, values: Record<string, any> = state.values): string | null => {
    const rules = validationSchema[name];
    if (!rules) return null;

    // Required validation
    if (rules.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      return `${name} is required`;
    }

    // Skip other validations if value is empty and not required
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return null;
    }

    // Min length validation
    if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
      return `${name} must be at least ${rules.minLength} characters`;
    }

    // Max length validation
    if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
      return `${name} must be no more than ${rules.maxLength} characters`;
    }

    // Pattern validation
    if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
      return `${name} format is invalid`;
    }

    // Custom validation
    if (rules.custom) {
      return rules.custom(value, values);
    }

    return null;
  }, [validationSchema]);

  const validateForm = useCallback((values: Record<string, any> = state.values): boolean => {
    const errors: FormErrors = {};
    let isValid = true;

    // Validate all fields
    Object.keys(validationSchema).forEach(fieldName => {
      const error = validateField(fieldName, values[fieldName], values);
      if (error) {
        errors[fieldName] = error;
        isValid = false;
      }
    });

    setState(prev => ({
      ...prev,
      errors,
      isValidating: false,
    }));

    return isValid;
  }, [validationSchema, validateField, state.values]);

  // State update functions
  const setValue = useCallback((name: string, value: any, shouldValidate: boolean = validateOnChange) => {
    setState(prev => ({
      ...prev,
      values: {
        ...prev.values,
        [name]: value,
      },
    }));

    if (shouldValidate && state.touched[name]) {
      // Clear validation cache for this field
      validationCache.current.delete(name);
      
      // Validate the field
      const error = validateField(name, value);
      setState(prev => ({
        ...prev,
        errors: {
          ...prev.errors,
          [name]: error,
        },
      }));
    }
  }, [validateOnChange, state.touched, validateField]);

  // Alias for setValue (for compatibility)
  const setFieldValue = setValue;

  const setValues = useCallback((values: Record<string, any>, shouldValidate: boolean = validateOnChange) => {
    const newValues = { ...state.values, ...values };
    
    setState(prev => ({
      ...prev,
      values: newValues,
    }));

    if (shouldValidate) {
      validateForm(newValues);
    }
  }, [validateOnChange, validateForm, state.values]);

  const setError = useCallback((name: string, error: string | string[]) => {
    setState(prev => ({
      ...prev,
      errors: {
        ...prev.errors,
        [name]: error,
      },
    }));
  }, []);

  const setErrors = useCallback((errors: FormErrors) => {
    setState(prev => ({
      ...prev,
      errors,
    }));
  }, []);

  const clearError = useCallback((name: string) => {
    setState(prev => {
      const newErrors = { ...prev.errors };
      delete newErrors[name];
      return {
        ...prev,
        errors: newErrors,
      };
    });
  }, []);

  const clearErrors = useCallback(() => {
    setState(prev => ({
      ...prev,
      errors: {},
    }));
  }, []);

  const setTouched = useCallback((name: string, touched: boolean = true) => {
    setState(prev => ({
      ...prev,
      touched: {
        ...prev.touched,
        [name]: touched,
      },
    }));

    // Validate on blur if enabled
    if (touched && validateOnBlur) {
      const error = validateField(name, state.values[name]);
      setState(prev => ({
        ...prev,
        errors: {
          ...prev.errors,
          [name]: error,
        },
      }));
    }
  }, [validateOnBlur, validateField, state.values]);

  const reset = useCallback((values?: Record<string, any>) => {
    const resetValues = values || initialValues;
    
    setState(prev => ({
      ...prev,
      values: resetValues,
      errors: {},
      touched: {},
      isSubmitting: false,
      isValidating: false,
    }));

    validationCache.current.clear();
  }, [initialValues]);

  const resetForm = useCallback(() => {
    setState({
      values: initialValues,
      errors: {},
      touched: {},
      isSubmitting: false,
      isValidating: false,
      submitCount: 0,
    });

    validationCache.current.clear();
  }, [initialValues]);

  const submit = useCallback(async () => {
    if (state.isSubmitting) return;

    // Mark all fields as touched
    const allTouched = Object.keys(validationSchema).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {} as Record<string, boolean>);

    setState(prev => ({
      ...prev,
      touched: allTouched,
      isSubmitting: true,
      isValidating: true,
      submitCount: prev.submitCount + 1,
    }));

    // Validate form
    const isValid = validateForm();

    if (!isValid) {
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        isValidating: false,
      }));
      return;
    }

    try {
      if (onSubmit) {
        await onSubmit(state.values);
      }

      if (resetOnSubmit) {
        resetForm();
      }
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        isValidating: false,
      }));
    }
  }, [state.isSubmitting, state.values, onSubmit, resetOnSubmit, validateForm, resetForm]);

  const actions: FormActions = {
    setValue,
    setFieldValue,
    setValues,
    setError,
    setErrors,
    clearError,
    clearErrors,
    setTouched,
    reset,
    validate: () => validateForm(),
    validateField: (name: string) => {
      const error = validateField(name, state.values[name]);
      setState(prev => ({
        ...prev,
        errors: {
          ...prev.errors,
          [name]: error,
        },
      }));
      return !error;
    },
    submit,
    resetForm,
  };

  return [state, actions] as const;
}

/**
 * Hook for managing multi-step form states
 * 
 * @param steps - Array of step configurations
 * @returns [state, actions] - Current state and actions for step navigation
 * 
 * @example
 * const [state, actions] = useMultiStepForm([
 *   { title: 'Personal Info', validation: personalValidation },
 *   { title: 'Contact Info', validation: contactValidation },
 *   { title: 'Preferences', validation: preferencesValidation },
 * ]);
 */
export function useMultiStepForm(
  steps: Array<{
    title: string;
    validation?: (values: Record<string, any>) => Record<string, string | null>;
    isOptional?: boolean;
  }>
) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const nextStep = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep, steps.length]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback((stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < steps.length) {
      setCurrentStep(stepIndex);
    }
  }, [steps.length]);

  const markStepComplete = useCallback((stepIndex: number) => {
    setCompletedSteps(prev => new Set([...prev, stepIndex]));
  }, []);

  const isStepComplete = useCallback((stepIndex: number) => {
    return completedSteps.has(stepIndex);
  }, [completedSteps]);

  const canGoToNext = useCallback(() => {
    return currentStep < steps.length - 1;
  }, [currentStep]);

  const canGoToPrev = useCallback(() => {
    return currentStep > 0;
  }, [currentStep]);

  const getStepStatus = useCallback((stepIndex: number) => {
    if (stepIndex === currentStep) return 'current';
    if (completedSteps.has(stepIndex)) return 'completed';
    if (stepIndex < currentStep) return 'completed';
    return 'upcoming';
  }, [currentStep, completedSteps]);

  const progress = useCallback(() => {
    return ((completedSteps.size + (currentStep < steps.length - 1 ? 0 : 1)) / steps.length) * 100;
  }, [completedSteps.size, currentStep, steps.length]);

  const actions = {
    nextStep,
    prevStep,
    goToStep,
    markStepComplete,
    isStepComplete,
  };

  const state = {
    currentStep,
    completedSteps: Array.from(completedSteps),
    canGoToNext: canGoToNext(),
    canGoToPrev: canGoToPrev(),
    totalSteps: steps.length,
    progress: progress(),
    stepStatus: getStepStatus(currentStep),
  };

  return [state, actions] as const;
}

/**
 * Hook for managing form validation in real-time
 * 
 * @param debounceMs - Debounce delay for validation in milliseconds
 * @returns [validateDebounced] - Debounced validation function
 */
/**
 * Hook for managing form validation in real-time
 * 
 * @param debounceMs - Debounce delay for validation in milliseconds
 * @returns [validateDebounced] - Debounced validation function
 */
export function useFormValidation(debounceMs: number = 300) {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const validateDebounced = useCallback((validateFn: () => void) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      validateFn();
    }, debounceMs);
  }, [debounceMs]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { validateDebounced };
}

export default useForm;