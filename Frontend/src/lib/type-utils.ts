// Advanced TypeScript utility types for enhanced type safety

/**
 * Create a type that requires all properties of T, including optional ones
 */
export type RequiredFields<T> = Required<T>;

/**
 * Create a type that makes specified properties of T optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Create a type that makes specified properties of T required
 */
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Create a type that makes all properties of T readonly recursively
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Create a type that makes all properties of T partial recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Create a type that allows for mutation of nested properties
 */
export type DeepMutable<T> = {
  -readonly [P in keyof T]: T[P] extends object ? DeepMutable<T[P]> : T[P];
};

/**
 * Extract the type of array elements
 */
export type ArrayElement<T> = T extends (infer U)[] ? U : never;

/**
 * Create a function type with the same parameters but different return type
 */
export type OverwriteReturnType<T, NewReturn> = T extends (
  ...args: infer P
) => any
  ? (...args: P) => NewReturn
  : never;

/**
 * Create a type that represents a promise resolution
 */
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

/**
 * Create a type that flattens nested promises
 */
export type DeepUnwrapPromise<T> =
  T extends Promise<infer U>
    ? U extends Promise<any>
      ? DeepUnwrapPromise<U>
      : U
    : T;

/**
 * Create a type that makes a specific property non-nullable
 */
export type NonNullableProperty<T, K extends keyof T> = T & {
  [P in K]: NonNullable<T[P]>;
};

/**
 * Create a type that filters out nullable values from an array
 */
export type NonNullableArray<T> = T extends (infer U)[]
  ? NonNullable<U>[]
  : never;

/**
 * Create a type that represents a key-value pair object
 */
export type KeyValue<T = string> = Record<string, T>;

/**
 * Create a type that represents a numeric enum
 */
export type StringEnum<T extends string> = {
  [K in T]: K;
};

/**
 * Create a type that represents the union of all values in an object
 */
export type ValueOf<T> = T[keyof T];

/**
 * Create a type that represents the union of all keys in an object
 */
export type KeysOf<T> = keyof T;

/**
 * Create a type that filters keys by their value type
 */
export type KeysOfType<T, V> = {
  [K in keyof T]: T[K] extends V ? K : never;
}[keyof T];

/**
 * Create a type that picks keys that match a certain type
 */
export type PickByType<T, V> = Pick<T, KeysOfType<T, V>>;

/**
 * Create a type that excludes keys that match a certain type
 */
export type OmitByType<T, V> = Omit<T, KeysOfType<T, V>>;

/**
 * Create a type that represents a function with typed arguments
 */
export type TypedFunction<T extends Record<string, any>, R> = (args: T) => R;

/**
 * Create a type that represents a constructor
 */
export type Constructor<T = unknown, Args extends any[] = any[]> = new (
  ...args: Args
) => T;

/**
 * Create a type that represents an abstract constructor
 */
export type AbstractConstructor<
  T = unknown,
  Args extends any[] = any[],
> = abstract new (...args: Args) => T;

/**
 * Create a type that merges two objects
 */
export type Merge<T, U> = Omit<T, keyof U> & U;

/**
 * Create a type that represents the intersection of multiple types
 */
export type Intersection<T> = T extends (infer U)[]
  ? U extends object
    ? Intersection<U>
    : never
  : T;

/**
 * Create a type that represents the union of multiple types
 */
export type Union<T> = T extends (infer U)[] ? U : never;

/**
 * Create a type that validates email format at compile time
 */
export type Email<T extends string> = T extends `${string}@${string}.${string}`
  ? T
  : never;

/**
 * Create a type that validates URL format at compile time
 */
export type Url<T extends string> = T extends `http${'s' | ''}://${string}`
  ? T
  : never;

/**
 * Create a type that represents ISO date string
 */
export type IsoDate<T extends string> =
  T extends `${string}-${string}-${string}T${string}:${string}:${string}`
    ? T
    : never;

/**
 * Create a type that represents UUID format
 */
export type UUID<T extends string> =
  T extends `${string}-${string}-${string}-${string}-${string}` ? T : never;

/**
 * Create a type that enforces minimum string length
 */
export type MinLength<T extends string, L extends number> = T extends {
  length: infer U;
}
  ? U extends L
    ? T
    : never
  : never;

/**
 * Create a type that enforces maximum string length
 */
export type MaxLength<T extends string, L extends number> = T extends {
  length: infer U;
}
  ? U extends L
    ? T
    : never
  : never;

/**
 * Create a type that represents a numeric string
 */
export type NumericString<T extends string> = T extends `${number}` ? T : never;

/**
 * Create a type that represents a boolean string
 */
export type BooleanString<T extends string> = T extends 'true' | 'false'
  ? T
  : never;

/**
 * Create a type for tagged strings (compile-time validation)
 */
export type TaggedString<T extends string, Tag extends string> = T & {
  __tag: Tag;
};

/**
 * Create a type that represents a valid ID string
 */
export type IdString<T extends string> = TaggedString<T, 'id'>;

/**
 * Create a type that represents a timestamp string
 */
export type TimestampString<T extends string> = TaggedString<T, 'timestamp'>;

/**
 * Create a type guard function
 */
export type TypeGuard<T> = (value: unknown) => value is T;

/**
 * Create a type for a validator function
 */
export type Validator<T> = (value: unknown) => ValidationResult<T>;

/**
 * Create a type for validation results
 */
export type ValidationResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      errors: string[];
    };

/**
 * Create a type for async validators
 */
export type AsyncValidator<T> = (
  value: unknown
) => Promise<ValidationResult<T>>;

/**
 * Create a type that represents a branded type
 */
export type Branded<T, B> = T & { __brand: B };

/**
 * Create a type that represents an entity with ID
 */
export type Entity<T> = T & { id: string };

/**
 * Create a type that represents a paginated response
 */
export type Paginated<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/**
 * Create a type that represents API response structure
 */
export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
};

/**
 * Create a type that represents a form field configuration
 */
export type FormField<T = unknown> = {
  name: string;
  label: string;
  type: FormFieldType;
  value: T;
  required: boolean;
  disabled?: boolean;
  placeholder?: string;
  validation?: ValidationRule[];
  options?: FormOption[];
};

/**
 * Create a type for form field types
 */
export type FormFieldType =
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'radio'
  | 'textarea'
  | 'date'
  | 'file';

/**
 * Create a type for validation rules
 */
export type ValidationRule =
  | { type: 'required'; message: string }
  | { type: 'minLength'; value: number; message: string }
  | { type: 'maxLength'; value: number; message: string }
  | { type: 'pattern'; value: RegExp; message: string }
  | { type: 'custom'; validator: (value: unknown) => boolean; message: string };

/**
 * Create a type for form options
 */
export type FormOption = {
  label: string;
  value: string | number;
  disabled?: boolean;
};

/**
 * Runtime type guards and validators
 */
export const TypeGuards = {
  /**
   * Check if a value is a string
   */
  isString: (value: unknown): value is string => {
    return typeof value === 'string';
  },

  /**
   * Check if a value is a number
   */
  isNumber: (value: unknown): value is number => {
    return typeof value === 'number' && !isNaN(value);
  },

  /**
   * Check if a value is a boolean
   */
  isBoolean: (value: unknown): value is boolean => {
    return typeof value === 'boolean';
  },

  /**
   * Check if a value is an object
   */
  isObject: (value: unknown): value is Record<string, unknown> => {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  },

  /**
   * Check if a value is an array
   */
  isArray: <T = unknown>(value: unknown): value is T[] => {
    return Array.isArray(value);
  },

  /**
   * Check if a value is a date
   */
  isDate: (value: unknown): value is Date => {
    return value instanceof Date && !isNaN(value.getTime());
  },

  /**
   * Check if a value is a valid email
   */
  isEmail: (value: unknown): value is string => {
    return (
      typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    );
  },

  /**
   * Check if a value is a valid URL
   */
  isUrl: (value: unknown): value is string => {
    return typeof value === 'string' && /^https?:\/\/.+/.test(value);
  },

  /**
   * Check if a value is a UUID
   */
  isUUID: (value: unknown): value is string => {
    return (
      typeof value === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value
      )
    );
  },

  /**
   * Check if a value is null or undefined
   */
  isNullable: (value: unknown): value is null | undefined => {
    return value === null || value === undefined;
  },

  /**
   * Check if a value is not null or undefined
   */
  isNonNullable: <T>(value: T): value is NonNullable<T> => {
    return value !== null && value !== undefined;
  },
};

/**
 * Runtime validators with detailed error messages
 */
export const Validators = {
  /**
   * Validate a string with optional constraints
   */
  string: (options?: {
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
  }) => {
    return (value: unknown): ValidationResult<string> => {
      if (typeof value !== 'string') {
        return {
          success: false,
          errors: ['Value must be a string'],
        };
      }

      const errors: string[] = [];

      if (options?.minLength && value.length < options.minLength) {
        errors.push(
          `String must be at least ${options.minLength} characters long`
        );
      }

      if (options?.maxLength && value.length > options.maxLength) {
        errors.push(
          `String must be no more than ${options.maxLength} characters long`
        );
      }

      if (options?.pattern && !options.pattern.test(value)) {
        errors.push('String does not match required pattern');
      }

      if (errors.length > 0) {
        return { success: false, errors };
      }

      return { success: true, data: value };
    };
  },

  /**
   * Validate a number with optional constraints
   */
  number: (options?: { min?: number; max?: number; integer?: boolean }) => {
    return (value: unknown): ValidationResult<number> => {
      if (typeof value !== 'number' || isNaN(value)) {
        return {
          success: false,
          errors: ['Value must be a valid number'],
        };
      }

      const errors: string[] = [];

      if (options?.integer && !Number.isInteger(value)) {
        errors.push('Value must be an integer');
      }

      if (options?.min !== undefined && value < options.min) {
        errors.push(`Value must be at least ${options.min}`);
      }

      if (options?.max !== undefined && value > options.max) {
        errors.push(`Value must be no more than ${options.max}`);
      }

      if (errors.length > 0) {
        return { success: false, errors };
      }

      return { success: true, data: value };
    };
  },

  /**
   * Validate an email address
   */
  email: (value: unknown): ValidationResult<string> => {
    if (!TypeGuards.isEmail(value)) {
      return {
        success: false,
        errors: ['Value must be a valid email address'],
      };
    }

    return { success: true, data: value };
  },

  /**
   * Validate a UUID
   */
  uuid: (value: unknown): ValidationResult<string> => {
    if (!TypeGuards.isUUID(value)) {
      return {
        success: false,
        errors: ['Value must be a valid UUID'],
      };
    }

    return { success: true, data: value };
  },

  /**
   * Validate an array with optional constraints
   */
  array: <T>(
    itemValidator: Validator<T>,
    options?: { minLength?: number; maxLength?: number }
  ) => {
    return (value: unknown): ValidationResult<T[]> => {
      if (!Array.isArray(value)) {
        return {
          success: false,
          errors: ['Value must be an array'],
        };
      }

      const errors: string[] = [];
      const validItems: T[] = [];

      for (let i = 0; i < value.length; i++) {
        const result = itemValidator(value[i]);
        if (result.success) {
          validItems.push(result.data);
        } else {
          const resultAny = result as any;
          errors.push(`Item at index ${i}: ${resultAny.errors.join(', ')}`);
        }
      }

      if (options?.minLength && value.length < options.minLength) {
        errors.push(`Array must have at least ${options.minLength} items`);
      }

      if (options?.maxLength && value.length > options.maxLength) {
        errors.push(`Array must have no more than ${options.maxLength} items`);
      }

      if (errors.length > 0) {
        return { success: false, errors };
      }

      return { success: true, data: validItems };
    };
  },
};
