/**
 * Flexible Enum Validation System with Fallback Values
 * 
 * This module provides type-safe enum validation with intelligent fallback values,
 * ensuring robust data handling during imports and API operations.
 */

// Enum type definitions based on Prisma schema
export enum StudentsGradeCategory {
  PRIMARY = 'PRIMARY',
  GRADE_SCHOOL = 'GRADE_SCHOOL',
  JUNIOR_HIGH = 'JUNIOR_HIGH',
  SENIOR_HIGH = 'SENIOR_HIGH'
}

export enum EquipmentType {
  COMPUTER = 'COMPUTER',
  GAMING = 'GAMING',
  AVR = 'AVR',
  PRINTER = 'PRINTER',
  SCANNER = 'SCANNER',
  OTHER = 'OTHER'
}

export enum EquipmentStatus {
  AVAILABLE = 'AVAILABLE',
  IN_USE = 'IN_USE',
  MAINTENANCE = 'MAINTENANCE',
  OUT_OF_ORDER = 'OUT_OF_ORDER',
  RESERVED = 'RESERVED',
  RETIRED = 'RETIRED'
}

export enum BookCheckoutsStatus {
  ACTIVE = 'ACTIVE',
  RETURNED = 'RETURNED',
  OVERDUE = 'OVERDUE',
  LOST = 'LOST',
  DAMAGED = 'DAMAGED'
}

export enum UsersRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  LIBRARIAN = 'LIBRARIAN',
  ASSISTANT = 'ASSISTANT',
  TEACHER = 'TEACHER',
  VIEWER = 'VIEWER'
}

export enum EquipmentConditionRating {
  EXCELLENT = 'EXCELLENT',
  GOOD = 'GOOD',
  FAIR = 'FAIR',
  POOR = 'POOR',
  DAMAGED = 'DAMAGED'
}

export enum StudentActivitiesStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  EXTENDED = 'EXTENDED'
}

export enum NotificationsPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

// Additional enums from schema
export enum AutomationJobsStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  RETRYING = 'RETRYING'
}

export enum AutomationLogsStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  RETRYING = 'RETRYING'
}

export enum EquipmentSessionsStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
  EXTENDED = 'EXTENDED',
  TERMINATED = 'TERMINATED'
}

export enum EquipmentReservationsStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW'
}

export enum EquipmentMaintenanceStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  ON_HOLD = 'ON_HOLD',
  PENDING_PARTS = 'PENDING_PARTS'
}

export enum EquipmentMaintenancePriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
  CRITICAL = 'CRITICAL'
}

export enum NotificationsType {
  OVERDUE_BOOK = 'OVERDUE_BOOK',
  FINE_ADDED = 'FINE_ADDED',
  FINE_WAIVED = 'FINE_WAIVED',
  BOOK_DUE_SOON = 'BOOK_DUE_SOON',
  EQUIPMENT_EXPIRING = 'EQUIPMENT_EXPIRING',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS'
}

export enum StudentActivitiesActivityType {
  COMPUTER_USE = 'COMPUTER_USE',
  GAMING_SESSION = 'GAMING_SESSION',
  AVR_SESSION = 'AVR_SESSION',
  BOOK_CHECKOUT = 'BOOK_CHECKOUT',
  BOOK_RETURN = 'BOOK_RETURN',
  GENERAL_VISIT = 'GENERAL_VISIT',
  RECREATION = 'RECREATION',
  STUDY = 'STUDY',
  OTHER = 'OTHER'
}

export enum EquipmentConditionReportsConditionBefore {
  EXCELLENT = 'EXCELLENT',
  GOOD = 'GOOD',
  FAIR = 'FAIR',
  POOR = 'POOR',
  DAMAGED = 'DAMAGED'
}

export enum EquipmentConditionReportsConditionAfter {
  EXCELLENT = 'EXCELLENT',
  GOOD = 'GOOD',
  FAIR = 'FAIR',
  POOR = 'POOR',
  DAMAGED = 'DAMAGED'
}

export enum EquipmentConditionReportsAssessmentType {
  ROUTINE = 'ROUTINE',
  DAMAGE_REPORT = 'DAMAGE_REPORT',
  PRE_MAINTENANCE = 'PRE_MAINTENANCE',
  POST_MAINTENANCE = 'POST_MAINTENANCE',
  ANNUAL_INSPECTION = 'ANNUAL_INSPECTION',
  INCIDENT = 'INCIDENT'
}

export enum EquipmentConditionReportsDamageSeverity {
  NONE = 'NONE',
  MINOR = 'MINOR',
  MODERATE = 'MODERATE',
  MAJOR = 'MAJOR',
  SEVERE = 'SEVERE',
  CRITICAL = 'CRITICAL'
}

export enum EquipmentMaintenanceMaintenanceType {
  ROUTINE = 'ROUTINE',
  REPAIR = 'REPAIR',
  INSPECTION = 'INSPECTION',
  CALIBRATION = 'CALIBRATION',
  UPGRADE = 'UPGRADE',
  CLEANING = 'CLEANING'
}

export enum EquipmentReportsReportType {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUAL = 'ANNUAL',
  CUSTOM = 'CUSTOM'
}

export enum AutomationJobsType {
  DAILY_BACKUP = 'DAILY_BACKUP',
  TEACHER_NOTIFICATIONS = 'TEACHER_NOTIFICATIONS',
  GOOGLE_SHEETS_SYNC = 'GOOGLE_SHEETS_SYNC',
  SESSION_EXPIRY_CHECK = 'SESSION_EXPIRY_CHECK',
  OVERDUE_NOTIFICATIONS = 'OVERDUE_NOTIFICATIONS',
  WEEKLY_CLEANUP = 'WEEKLY_CLEANUP',
  MONTHLY_REPORT = 'MONTHLY_REPORT',
  INTEGRITY_AUDIT = 'INTEGRITY_AUDIT'
}

export enum StudentActivitiesGradeCategory {
  PRIMARY = 'PRIMARY',
  GRADE_SCHOOL = 'GRADE_SCHOOL',
  JUNIOR_HIGH = 'JUNIOR_HIGH',
  SENIOR_HIGH = 'SENIOR_HIGH'
}

// Validation result interface
export interface EnumValidationResult<T = string> {
  isValid: boolean;
  value: T | null;
  originalValue: string | null;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  suggestedValues: T[];
  confidence: number; // 0-1 confidence score
  strategy: FallbackStrategy;
}

// Fallback strategies
export enum FallbackStrategy {
  EXACT_MATCH = 'EXACT_MATCH',
  CASE_INSENSITIVE = 'CASE_INSENSITIVE',
  FUZZY_MATCH = 'FUZZY_MATCH',
  CONTEXT_AWARE = 'CONTEXT_AWARE',
  DEFAULT_VALUE = 'DEFAULT_VALUE',
  NULL_UNDEFINED = 'NULL_UNDEFINED'
}

// Validation context interface
export interface ValidationContext {
  fieldType?: string;
  dataSource?: string;
  relatedData?: Record<string, any>;
  importBatch?: boolean;
  strictMode?: boolean;
}

// Validation metrics interface
export interface ValidationMetrics {
  totalValidations: number;
  successfulValidations: number;
  fallbackUsed: number;
  strategyCounts: Record<FallbackStrategy, number>;
  enumTypeCounts: Record<string, number>;
  averageConfidence: number;
  lastValidationTime: Date;
}

// Custom validation rule interface
export interface CustomValidationRule<T> {
  name: string;
  description: string;
  validate: (value: string, enumValues: T[], context?: ValidationContext) => EnumValidationResult<T>;
  priority: number; // Higher priority rules run first
}

// Main EnumValidator class
export class EnumValidator<T extends string> {
  private enumValues: T[];
  private enumName: string;
  private defaultValue?: T;
  private customRules: CustomValidationRule<T>[] = [];
  private metrics: ValidationMetrics;
  private fuzzyMatchThreshold: number = 0.7; // Similarity threshold for fuzzy matching

  constructor(
    enumValues: T[],
    enumName: string,
    defaultValue?: T,
    options?: {
      fuzzyMatchThreshold?: number;
      customRules?: CustomValidationRule<T>[];
    }
  ) {
    this.enumValues = enumValues;
    this.enumName = enumName;
    this.defaultValue = defaultValue as T;
    this.fuzzyMatchThreshold = options?.fuzzyMatchThreshold || 0.7;
    this.customRules = options?.customRules || [];
    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics(): ValidationMetrics {
    return {
      totalValidations: 0,
      successfulValidations: 0,
      fallbackUsed: 0,
      strategyCounts: {
        [FallbackStrategy.EXACT_MATCH]: 0,
        [FallbackStrategy.CASE_INSENSITIVE]: 0,
        [FallbackStrategy.FUZZY_MATCH]: 0,
        [FallbackStrategy.CONTEXT_AWARE]: 0,
        [FallbackStrategy.DEFAULT_VALUE]: 0,
        [FallbackStrategy.NULL_UNDEFINED]: 0
      },
      enumTypeCounts: {},
      averageConfidence: 0,
      lastValidationTime: new Date()
    };
  }

  /**
   * Main validation method
   */
  public validate(
    value: string | null | undefined,
    context?: ValidationContext
  ): EnumValidationResult<T> {
    this.metrics.totalValidations++;
    this.metrics.lastValidationTime = new Date();
    
    // Update enum type count
    this.metrics.enumTypeCounts[this.enumName] = (this.metrics.enumTypeCounts[this.enumName] || 0) + 1;

    // Handle null/undefined values
    if (value === null || value === undefined) {
      return this.handleNullUndefined(context);
    }

    const originalValue = value;
    const trimmedValue = value.trim();

    // Try custom validation rules first (highest priority)
    for (const rule of this.customRules.sort((a, b) => b.priority - a.priority)) {
      const result = rule.validate(trimmedValue, this.enumValues, context);
      if (result.isValid || result.fallbackUsed) {
        this.updateMetrics(result);
        return result;
      }
    }

    // Try exact match
    const exactMatch = this.tryExactMatch(trimmedValue);
    if (exactMatch.isValid) {
      this.updateMetrics(exactMatch);
      return exactMatch;
    }

    // Try case-insensitive match
    const caseInsensitiveMatch = this.tryCaseInsensitiveMatch(trimmedValue);
    if (caseInsensitiveMatch.isValid) {
      this.updateMetrics(caseInsensitiveMatch);
      return caseInsensitiveMatch;
    }

    // Try fuzzy match
    const fuzzyMatch = this.tryFuzzyMatch(trimmedValue);
    if (fuzzyMatch.isValid) {
      this.updateMetrics(fuzzyMatch);
      return fuzzyMatch;
    }

    // Try context-aware match
    if (context) {
      const contextAwareMatch = this.tryContextAwareMatch(trimmedValue, context);
      if (contextAwareMatch.isValid) {
        this.updateMetrics(contextAwareMatch);
        return contextAwareMatch;
      }
    }

    // Use default value as fallback
    const defaultFallback = this.useDefaultValue(originalValue);
    this.updateMetrics(defaultFallback);
    return defaultFallback;
  }

  /**
   * Handle null/undefined values
   */
  private handleNullUndefined(context?: ValidationContext): EnumValidationResult<T> {
    this.metrics.strategyCounts[FallbackStrategy.NULL_UNDEFINED]++;
    
    if (context?.strictMode) {
      return {
        isValid: false,
        value: null,
        originalValue: null,
        fallbackUsed: false,
        fallbackReason: 'Null/undefined value in strict mode',
        suggestedValues: this.enumValues,
        confidence: 0,
        strategy: FallbackStrategy.NULL_UNDEFINED
      };
    }

    return {
      isValid: true,
      value: this.defaultValue || null,
      originalValue: null,
      fallbackUsed: !!this.defaultValue,
      fallbackReason: this.defaultValue ? 'Used default value for null/undefined' : 'Null/undefined value allowed',
      suggestedValues: this.defaultValue ? [] : this.enumValues,
      confidence: this.defaultValue ? 0.5 : 1.0,
      strategy: FallbackStrategy.NULL_UNDEFINED
    };
  }

  /**
   * Try exact match
   */
  private tryExactMatch(value: string): EnumValidationResult<T> {
    const matchedValue = this.enumValues.find(enumValue => enumValue === value);
    
    if (matchedValue) {
      this.metrics.strategyCounts[FallbackStrategy.EXACT_MATCH]++;
      this.metrics.successfulValidations++;
      
      return {
        isValid: true,
        value: matchedValue,
        originalValue: value,
        fallbackUsed: false,
        fallbackReason: null,
        suggestedValues: [],
        confidence: 1.0,
        strategy: FallbackStrategy.EXACT_MATCH
      };
    }

    return {
      isValid: false,
      value: null,
      originalValue: value,
      fallbackUsed: false,
      fallbackReason: null,
      suggestedValues: [],
      confidence: 0,
      strategy: FallbackStrategy.EXACT_MATCH
    };
  }

  /**
   * Try case-insensitive match
   */
  private tryCaseInsensitiveMatch(value: string): EnumValidationResult<T> {
    const normalizedValue = value.toUpperCase();
    const matchedValue = this.enumValues.find(enumValue => 
      enumValue.toUpperCase() === normalizedValue
    );
    
    if (matchedValue) {
      this.metrics.strategyCounts[FallbackStrategy.CASE_INSENSITIVE]++;
      this.metrics.successfulValidations++;
      
      return {
        isValid: true,
        value: matchedValue,
        originalValue: value,
        fallbackUsed: true,
        fallbackReason: 'Case-insensitive match',
        suggestedValues: [],
        confidence: 0.9,
        strategy: FallbackStrategy.CASE_INSENSITIVE
      };
    }

    return {
      isValid: false,
      value: null,
      originalValue: value,
      fallbackUsed: false,
      fallbackReason: null,
      suggestedValues: [],
      confidence: 0,
      strategy: FallbackStrategy.CASE_INSENSITIVE
    };
  }

  /**
   * Try fuzzy match using string similarity
   */
  private tryFuzzyMatch(value: string): EnumValidationResult<T> {
    let bestMatch: T | null = null;
    let bestScore = 0;
    
    for (const enumValue of this.enumValues) {
      const score = this.calculateSimilarity(value, enumValue);
      if (score > bestScore && score >= this.fuzzyMatchThreshold) {
        bestScore = score;
        bestMatch = enumValue;
      }
    }
    
    if (bestMatch) {
      this.metrics.strategyCounts[FallbackStrategy.FUZZY_MATCH]++;
      this.metrics.successfulValidations++;
      
      return {
        isValid: true,
        value: bestMatch,
        originalValue: value,
        fallbackUsed: true,
        fallbackReason: `Fuzzy match (${(bestScore * 100).toFixed(1)}% similarity)`,
        suggestedValues: this.getSimilarValues(value, 3),
        confidence: bestScore,
        strategy: FallbackStrategy.FUZZY_MATCH
      };
    }

    return {
      isValid: false,
      value: null,
      originalValue: value,
      fallbackUsed: false,
      fallbackReason: null,
      suggestedValues: this.getSimilarValues(value, 3),
      confidence: 0,
      strategy: FallbackStrategy.FUZZY_MATCH
    };
  }

  /**
   * Try context-aware match
   */
  private tryContextAwareMatch(value: string, context: ValidationContext): EnumValidationResult<T> {
    // Context-aware matching based on field type and related data
    let suggestedValues: T[] = [];
    let confidence = 0;
    
    // Example context rules
    if (context.fieldType === 'grade_category' && context.relatedData?.grade_level) {
      suggestedValues = this.suggestGradeCategory(context.relatedData.grade_level);
      confidence = 0.8;
    } else if (context.fieldType === 'equipment_status' && context.relatedData?.type) {
      suggestedValues = this.suggestEquipmentStatus(context.relatedData.type);
      confidence = 0.7;
    }
    
    // Check if any suggested values match the input
    const matchedValue = suggestedValues.find(suggested => 
      suggested.toUpperCase() === value.toUpperCase()
    );
    
    if (matchedValue) {
      this.metrics.strategyCounts[FallbackStrategy.CONTEXT_AWARE]++;
      this.metrics.successfulValidations++;
      
      return {
        isValid: true,
        value: matchedValue,
        originalValue: value,
        fallbackUsed: true,
        fallbackReason: 'Context-aware match',
        suggestedValues: [],
        confidence,
        strategy: FallbackStrategy.CONTEXT_AWARE
      };
    }

    return {
      isValid: false,
      value: null,
      originalValue: value,
      fallbackUsed: false,
      fallbackReason: null,
      suggestedValues,
      confidence: 0,
      strategy: FallbackStrategy.CONTEXT_AWARE
    };
  }

  /**
   * Use default value as fallback
   */
  private useDefaultValue(originalValue: string): EnumValidationResult<T> {
    this.metrics.strategyCounts[FallbackStrategy.DEFAULT_VALUE]++;
    
    if (this.defaultValue) {
      this.metrics.successfulValidations++;
      
      return {
        isValid: true,
        value: this.defaultValue,
        originalValue,
        fallbackUsed: true,
        fallbackReason: `Used default value "${this.defaultValue}"`,
        suggestedValues: this.getSimilarValues(originalValue, 3),
        confidence: 0.3,
        strategy: FallbackStrategy.DEFAULT_VALUE
      };
    }

    return {
      isValid: false,
      value: null,
      originalValue,
      fallbackUsed: false,
      fallbackReason: 'No valid match found and no default value available',
      suggestedValues: this.getSimilarValues(originalValue, 3),
      confidence: 0,
      strategy: FallbackStrategy.DEFAULT_VALUE
    };
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = Array(str2.length + 1).fill(null).map(() =>
      Array(str1.length + 1).fill(null)
    );
    
    for (let i = 0; i <= str1.length; i++) matrix[0]![i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j]![0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j]![i] = Math.min(
          matrix[j]![i - 1]! + 1,
          matrix[j - 1]![i]! + 1,
          matrix[j - 1]![i - 1]! + indicator
        );
      }
    }
    
    return matrix[str2.length]![str1.length]!;
  }

  /**
   * Get similar values based on string similarity
   */
  private getSimilarValues(value: string, limit: number): T[] {
    const similarities = this.enumValues
      .map(enumValue => ({
        value: enumValue,
        similarity: this.calculateSimilarity(value, enumValue)
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .filter(item => item.similarity > 0.3);
    
    return similarities.map(item => item.value);
  }

  /**
   * Suggest grade category based on grade level
   */
  private suggestGradeCategory(gradeLevel: string): T[] {
    const grade = parseInt(gradeLevel);
    if (isNaN(grade)) return [];
    
    if (grade <= 6) {
      return this.enumValues.filter(v => 
        v === StudentsGradeCategory.PRIMARY || 
        v === StudentsGradeCategory.GRADE_SCHOOL
      ) as T[];
    } else if (grade <= 10) {
      return this.enumValues.filter(v => 
        v === StudentsGradeCategory.JUNIOR_HIGH
      ) as T[];
    } else {
      return this.enumValues.filter(v => 
        v === StudentsGradeCategory.SENIOR_HIGH
      ) as T[];
    }
  }

  /**
   * Suggest equipment status based on equipment type
   */
  private suggestEquipmentStatus(equipmentType: string): T[] {
    // Context-aware suggestions based on equipment type
    const commonStatuses = {
      [EquipmentType.COMPUTER]: [EquipmentStatus.AVAILABLE, EquipmentStatus.IN_USE, EquipmentStatus.MAINTENANCE],
      [EquipmentType.GAMING]: [EquipmentStatus.AVAILABLE, EquipmentStatus.IN_USE, EquipmentStatus.MAINTENANCE],
      [EquipmentType.AVR]: [EquipmentStatus.AVAILABLE, EquipmentStatus.RESERVED, EquipmentStatus.MAINTENANCE],
      [EquipmentType.PRINTER]: [EquipmentStatus.AVAILABLE, EquipmentStatus.IN_USE, EquipmentStatus.OUT_OF_ORDER],
      [EquipmentType.SCANNER]: [EquipmentStatus.AVAILABLE, EquipmentStatus.IN_USE, EquipmentStatus.MAINTENANCE],
      [EquipmentType.OTHER]: [EquipmentStatus.AVAILABLE, EquipmentStatus.IN_USE, EquipmentStatus.MAINTENANCE]
    };
    
    const suggestions = commonStatuses[equipmentType as EquipmentType] || 
                       [EquipmentStatus.AVAILABLE, EquipmentStatus.IN_USE];
    
    return this.enumValues.filter(v => suggestions.includes(v as EquipmentStatus)) as T[];
  }

  /**
   * Update validation metrics
   */
  private updateMetrics(result: EnumValidationResult<T>): void {
    if (result.isValid) {
      this.metrics.successfulValidations++;
    }
    
    if (result.fallbackUsed) {
      this.metrics.fallbackUsed++;
    }
    
    // Update average confidence
    const totalConfidence = this.metrics.averageConfidence * (this.metrics.totalValidations - 1) + result.confidence;
    this.metrics.averageConfidence = totalConfidence / this.metrics.totalValidations;
  }

  /**
   * Get validation metrics
   */
  public getMetrics(): ValidationMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset validation metrics
   */
  public resetMetrics(): void {
    this.metrics = this.initializeMetrics();
  }

  /**
   * Add custom validation rule
   */
  public addCustomRule(rule: CustomValidationRule<T>): void {
    this.customRules.push(rule);
  }

  /**
   * Remove custom validation rule
   */
  public removeCustomRule(ruleName: string): void {
    this.customRules = this.customRules.filter(rule => rule.name !== ruleName);
  }

  /**
   * Get all enum values
   */
  public getEnumValues(): T[] {
    return [...this.enumValues];
  }

  /**
   * Check if value is valid enum member
   */
  public isValidEnumValue(value: string): boolean {
    return this.enumValues.includes(value as T);
  }
}

// Pre-configured validators for common enums
export const enumValidators = {
  studentsGradeCategory: new EnumValidator(
    Object.values(StudentsGradeCategory),
    'StudentsGradeCategory',
    StudentsGradeCategory.JUNIOR_HIGH,
    { fuzzyMatchThreshold: 0.7 }
  ),
  
  equipmentType: new EnumValidator(
    Object.values(EquipmentType),
    'EquipmentType',
    EquipmentType.OTHER,
    { fuzzyMatchThreshold: 0.6 }
  ),
  
  equipmentStatus: new EnumValidator(
    Object.values(EquipmentStatus),
    'EquipmentStatus',
    EquipmentStatus.AVAILABLE,
    { fuzzyMatchThreshold: 0.7 }
  ),
  
  bookCheckoutsStatus: new EnumValidator(
    Object.values(BookCheckoutsStatus),
    'BookCheckoutsStatus',
    BookCheckoutsStatus.ACTIVE,
    { fuzzyMatchThreshold: 0.7 }
  ),
  
  usersRole: new EnumValidator(
    Object.values(UsersRole),
    'UsersRole',
    UsersRole.VIEWER,
    { fuzzyMatchThreshold: 0.7 }
  ),
  
  equipmentConditionRating: new EnumValidator(
    Object.values(EquipmentConditionRating),
    'EquipmentConditionRating',
    EquipmentConditionRating.GOOD,
    { fuzzyMatchThreshold: 0.7 }
  ),
  
  studentActivitiesStatus: new EnumValidator(
    Object.values(StudentActivitiesStatus),
    'StudentActivitiesStatus',
    StudentActivitiesStatus.ACTIVE,
    { fuzzyMatchThreshold: 0.7 }
  ),
  
  notificationsPriority: new EnumValidator(
    Object.values(NotificationsPriority),
    'NotificationsPriority',
    NotificationsPriority.NORMAL,
    { fuzzyMatchThreshold: 0.7 }
  )
};

// Global enum validator factory
export function createEnumValidator<T extends string>(
  enumValues: T[],
  enumName: string,
  defaultValue?: T,
  options?: {
    fuzzyMatchThreshold?: number;
    customRules?: CustomValidationRule<T>[];
  }
): EnumValidator<T> {
  return new EnumValidator(enumValues, enumName, defaultValue, options);
}

// Convenience function for validating enums
export function validateEnum<T extends string>(
  enumValues: T[],
  value: string | null | undefined,
  defaultValue?: T,
  context?: ValidationContext
): EnumValidationResult<T> {
  const validator = new EnumValidator(enumValues, 'TempEnum', defaultValue);
  return validator.validate(value, context);
}

// Export all metrics
export function getAllValidationMetrics(): Record<string, ValidationMetrics> {
  const metrics: Record<string, ValidationMetrics> = {};
  
  for (const [key, validator] of Object.entries(enumValidators)) {
    metrics[key] = validator.getMetrics();
  }
  
  return metrics;
}

// Reset all metrics
export function resetAllValidationMetrics(): void {
  for (const validator of Object.values(enumValidators)) {
    validator.resetMetrics();
  }
}