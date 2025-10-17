import { logger } from './logger';

/**
 * Supported data types for inference
 */
export type InferredType = 
  | 'string' 
  | 'number' 
  | 'integer' 
  | 'date' 
  | 'datetime' 
  | 'boolean' 
  | 'enum' 
  | 'email' 
  | 'phone' 
  | 'id' 
  | 'url';

/**
 * Type inference result with confidence score
 */
export interface TypeInferenceResult {
  type: InferredType;
  confidence: number; // 0-1
  enumValues?: string[];
  format?: string;
  errors: string[];
  sampleValues: unknown[];
}

/**
 * Field mapping information
 */
export interface FieldMapping {
  fieldName: string;
  inferredType: InferredType;
  targetField?: string;
  conversion: ConversionResult;
  confidence: number;
}

/**
 * Conversion result with value and any errors
 */
export interface ConversionResult {
  success: boolean;
  value: unknown;
  originalValue: unknown;
  errors: string[];
  warnings: string[];
}

/**
 * Configuration options for type inference
 */
export interface TypeInferenceConfig {
  strictMode: boolean;
  minConfidenceThreshold: number;
  dateFormats: string[];
  numberLocale: string;
  enumThreshold: number; // Minimum unique ratio to consider as enum
  idFieldPatterns: RegExp[];
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Default configuration for type inference
 */
const DEFAULT_CONFIG: TypeInferenceConfig = {
  strictMode: false,
  minConfidenceThreshold: 0.7,
  dateFormats: [
    'YYYY-MM-DD',
    'MM/DD/YYYY',
    'DD/MM/YYYY',
    'MM-DD-YYYY',
    'DD-MM-YYYY',
    'YYYY/MM/DD',
    'DD/MM/YY',
    'MM/DD/YY',
    'ISO8601',
    'YYYY-MM-DD HH:mm:ss',
    'MM/DD/YYYY HH:mm:ss',
    'DD/MM/YYYY HH:mm:ss'
  ],
  numberLocale: 'en-US',
  enumThreshold: 0.1, // 10% unique values max
  idFieldPatterns: [
    /id$/i,
    /_id$/i,
    /no$/i,
    /_no$/i,
    /code$/i,
    /_code$/i,
    /accession/i,
    /student/i,
    /equipment/i,
    /book/i
  ],
  logLevel: 'info'
};

/**
 * Comprehensive type inference system for CSV/Excel imports
 */
export class TypeInference {
  private config: TypeInferenceConfig;
  private logger = logger.child({ component: 'TypeInference' });

  constructor(config: Partial<TypeInferenceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger.level = this.config.logLevel;
  }

  /**
   * Analyze a column of values and infer the most likely data type
   */
  public analyzeColumn(
    columnName: string,
    values: unknown[],
    sampleSize = 100
  ): TypeInferenceResult {
    this.logger.debug('Analyzing column', { 
      columnName, 
      totalValues: values.length,
      sampleSize 
    });

    // Clean and sample values
    const cleanValues = this.cleanValues(values.slice(0, sampleSize));
    const nonEmptyValues = cleanValues.filter(v => v !== null && v !== undefined && v !== '');
    
    if (nonEmptyValues.length === 0) {
      return {
        type: 'string',
        confidence: 0,
        errors: ['No non-empty values found'],
        sampleValues: []
      };
    }

    this.logger.debug('Cleaned values', { 
      originalCount: values.length,
      cleanCount: cleanValues.length,
      nonEmptyCount: nonEmptyValues.length 
    });

    // Check for explicit type hints from column name
    const typeHint = this.getTypeHintFromColumnName(columnName);
    if (typeHint) {
      this.logger.info('Type hint detected from column name', { 
        columnName, 
        typeHint 
      });
    }

    // Analyze each possible type
    const typeAnalyses = [
      this.analyzeAsId(columnName, nonEmptyValues),
      this.analyzeAsEnum(nonEmptyValues),
      this.analyzeAsBoolean(nonEmptyValues),
      this.analyzeAsDate(nonEmptyValues),
      this.analyzeAsNumber(nonEmptyValues, false),
      this.analyzeAsNumber(nonEmptyValues, true),
      this.analyzeAsEmail(nonEmptyValues),
      this.analyzeAsPhone(nonEmptyValues),
      this.analyzeAsUrl(nonEmptyValues),
      this.analyzeAsString(nonEmptyValues)
    ];

    // Sort by confidence and select the best match
    typeAnalyses.sort((a, b) => b.confidence - a.confidence);
    const bestMatch = typeAnalyses[0];

    // Apply type hint if present and confident enough
    if (typeHint && bestMatch && typeHint !== bestMatch.type) {
      const hintedAnalysis = typeAnalyses.find(a => a.type === typeHint);
      if (hintedAnalysis && hintedAnalysis.confidence >= this.config.minConfidenceThreshold) {
        this.logger.info('Applying type hint over best match', {
          columnName,
          typeHint,
          originalBest: bestMatch?.type,
          originalConfidence: bestMatch?.confidence,
          hintedConfidence: hintedAnalysis.confidence
        });
        return hintedAnalysis;
      }
    }

    this.logger.info('Type inference complete', {
      columnName,
      inferredType: bestMatch?.type,
      confidence: bestMatch?.confidence,
      sampleCount: bestMatch?.sampleValues.length
    });

    return bestMatch || {
      type: 'string',
      confidence: 0,
      enumValues: [],
      errors: ['No type could be inferred'],
      sampleValues: []
    };
  }

  /**
   * Convert a value to the inferred type
   */
  public convertValue(
    value: unknown,
    targetType: InferredType,
    enumValues?: string[]
  ): ConversionResult {
    const result: ConversionResult = {
      success: false,
      value: null,
      originalValue: value,
      errors: [],
      warnings: []
    };

    if (value === null || value === undefined || value === '') {
      result.success = true;
      result.value = null;
      return result;
    }

    try {
      switch (targetType) {
        case 'string':
          result.value = String(value);
          result.success = true;
          break;

        case 'number':
          result.value = this.convertToNumber(value);
          result.success = !isNaN(Number(result.value));
          if (!result.success) {
            result.errors.push(`Failed to convert "${value}" to number`);
          }
          break;

        case 'integer':
          result.value = this.convertToInteger(value);
          result.success = !isNaN(Number(result.value));
          if (!result.success) {
            result.errors.push(`Failed to convert "${value}" to integer`);
          }
          break;

        case 'boolean':
          result.value = this.convertToBoolean(value);
          result.success = true;
          break;

        case 'date':
        case 'datetime':
          result.value = this.convertToDate(value);
          result.success = result.value !== null;
          if (!result.success) {
            result.errors.push(`Failed to convert "${value}" to date`);
          }
          break;

        case 'email':
          result.value = this.convertToEmail(value);
          result.success = this.isValidEmail(result.value as string);
          if (!result.success) {
            result.errors.push(`Invalid email format: "${value}"`);
          }
          break;

        case 'phone':
          result.value = this.convertToPhone(value);
          result.success = this.isValidPhone(result.value as string);
          if (!result.success) {
            result.errors.push(`Invalid phone format: "${value}"`);
          }
          break;

        case 'url':
          result.value = this.convertToUrl(value);
          result.success = this.isValidUrl(result.value as string);
          if (!result.success) {
            result.errors.push(`Invalid URL format: "${value}"`);
          }
          break;

        case 'id':
          result.value = this.convertToId(value);
          result.success = true;
          break;

        case 'enum':
          if (enumValues && enumValues.length > 0) {
            result.value = this.convertToEnum(value, enumValues);
            result.success = enumValues.includes(result.value as string);
            if (!result.success) {
              result.errors.push(`Value "${value}" not in enum values: [${enumValues.join(', ')}]`);
            }
          } else {
            result.value = String(value);
            result.success = true;
            result.warnings.push('No enum values provided, treating as string');
          }
          break;

        default:
          result.value = String(value);
          result.success = true;
          result.warnings.push(`Unknown type "${targetType}", treating as string`);
      }
    } catch (error) {
      result.errors.push(`Conversion error: ${error instanceof Error ? error.message : String(error)}`);
      this.logger.error('Value conversion failed', {
        value,
        targetType,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return result;
  }

  /**
   * Create field mappings for a set of columns
   */
  public createFieldMappings(
    columns: Record<string, unknown[]>,
    targetSchema?: Record<string, { type: InferredType; enumValues?: string[] }>
  ): Record<string, FieldMapping> {
    const mappings: Record<string, FieldMapping> = {};

    for (const [columnName, values] of Object.entries(columns)) {
      const inference = this.analyzeColumn(columnName, values);
      
      // Determine target field if schema is provided
      let targetField = columnName;
      let targetType = inference.type;
      let enumValues = inference.enumValues;

      if (targetSchema) {
        const schemaMatch = this.findBestSchemaMatch(columnName, targetSchema);
        if (schemaMatch) {
          targetField = schemaMatch.fieldName;
          targetType = schemaMatch.type;
          enumValues = schemaMatch.enumValues;
        }
      }

      // Convert a sample value to test the conversion
      const sampleValue = values.find(v => v !== null && v !== undefined && v !== '');
      const conversion = this.convertValue(sampleValue, targetType, enumValues);

      mappings[columnName] = {
        fieldName: columnName,
        inferredType: targetType,
        targetField,
        conversion,
        confidence: inference.confidence
      };

      this.logger.debug('Field mapping created', {
        columnName,
        targetField,
        targetType,
        confidence: inference.confidence,
        conversionSuccess: conversion.success
      });
    }

    return mappings;
  }

  /**
   * Clean and normalize values for analysis
   */
  private cleanValues(values: unknown[]): unknown[] {
    return values.map(value => {
      if (value === null || value === undefined) {
        return null;
      }

      if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed === '' ? null : trimmed;
      }

      return value;
    });
  }

  /**
   * Get type hint from column name
   */
  private getTypeHintFromColumnName(columnName: string): InferredType | null {
    const lowerName = columnName.toLowerCase();

    // Check for ID patterns
    if (this.config.idFieldPatterns.some(pattern => pattern.test(columnName))) {
      return 'id';
    }

    // Check for specific type patterns
    if (lowerName.includes('email') || lowerName.includes('e-mail')) {
      return 'email';
    }

    if (lowerName.includes('phone') || lowerName.includes('tel') || lowerName.includes('mobile')) {
      return 'phone';
    }

    if (lowerName.includes('url') || lowerName.includes('website') || lowerName.includes('link')) {
      return 'url';
    }

    if (lowerName.includes('date') || lowerName.includes('time') || lowerName.includes('created') || lowerName.includes('updated')) {
      return lowerName.includes('time') ? 'datetime' : 'date';
    }

    if (lowerName.includes('status') || lowerName.includes('type') || lowerName.includes('category') || lowerName.includes('grade')) {
      return 'enum';
    }

    if (lowerName.includes('active') || lowerName.includes('enabled') || lowerName.includes('boolean')) {
      return 'boolean';
    }

    if (lowerName.includes('amount') || lowerName.includes('price') || lowerName.includes('cost') || lowerName.includes('quantity')) {
      return 'number';
    }

    return null;
  }

  /**
   * Analyze values as ID type
   */
  private analyzeAsId(columnName: string, values: unknown[]): TypeInferenceResult {
    const errors: string[] = [];
    const sampleValues: unknown[] = [];
    let matchCount = 0;

    for (const value of values) {
      if (typeof value === 'string' || typeof value === 'number') {
        const strValue = String(value);
        // IDs are typically alphanumeric, not too long, and consistent
        if (/^[a-zA-Z0-9\-_]+$/.test(strValue) && strValue.length <= 50) {
          matchCount++;
          sampleValues.push(value);
        }
      }
    }

    const confidence = matchCount / values.length;
    
    // Boost confidence if column name suggests ID
    const nameBoost = this.config.idFieldPatterns.some(pattern => pattern.test(columnName)) ? 0.3 : 0;
    const finalConfidence = Math.min(1, confidence + nameBoost);

    return {
      type: 'id',
      confidence: finalConfidence,
      errors,
      sampleValues
    };
  }

  /**
   * Analyze values as enum type
   */
  private analyzeAsEnum(values: unknown[]): TypeInferenceResult {
    const errors: string[] = [];
    const uniqueValues = new Set(values.map(v => String(v).toLowerCase()));
    const totalValues = values.length;
    const uniqueRatio = uniqueValues.size / totalValues;

    // Consider enum if unique values are limited
    const isEnum = uniqueRatio <= this.config.enumThreshold && uniqueValues.size <= 20;
    const confidence = isEnum ? 1 - uniqueRatio : 0;

    return {
      type: 'enum',
      confidence,
      enumValues: isEnum ? Array.from(uniqueValues) : [],
      errors,
      sampleValues: values.slice(0, 5)
    };
  }

  /**
   * Analyze values as boolean type
   */
  private analyzeAsBoolean(values: unknown[]): TypeInferenceResult {
    const errors: string[] = [];
    const sampleValues: unknown[] = [];
    let matchCount = 0;

    const booleanPatterns = [
      /^(true|false|yes|no|1|0|y|n|on|off)$/i,
      /^(✓|✗|t|f)$/i
    ];

    for (const value of values) {
      if (typeof value === 'boolean') {
        matchCount++;
        sampleValues.push(value);
      } else if (typeof value === 'string' || typeof value === 'number') {
        const strValue = String(value).trim();
        if (booleanPatterns.some(pattern => pattern.test(strValue))) {
          matchCount++;
          sampleValues.push(value);
        }
      }
    }

    const confidence = matchCount / values.length;

    return {
      type: 'boolean',
      confidence,
      errors,
      sampleValues
    };
  }

  /**
   * Analyze values as date type
   */
  private analyzeAsDate(values: unknown[]): TypeInferenceResult {
    const errors: string[] = [];
    const sampleValues: unknown[] = [];
    let matchCount = 0;
    const detectedFormats = new Set<string>();

    for (const value of values) {
      if (value instanceof Date) {
        matchCount++;
        sampleValues.push(value);
        detectedFormats.add('native');
      } else if (typeof value === 'string' || typeof value === 'number') {
        const parsedDate = this.parseDate(String(value));
        if (parsedDate) {
          matchCount++;
          sampleValues.push(parsedDate);
          detectedFormats.add(this.detectDateFormat(String(value)));
        }
      }
    }

    const confidence = matchCount / values.length;
    const format = detectedFormats.size > 0 ? Array.from(detectedFormats)[0] : undefined;

    return {
      type: 'date',
      confidence,
      format,
      errors,
      sampleValues
    };
  }

  /**
   * Analyze values as number type
   */
  private analyzeAsNumber(values: unknown[], integerOnly = false): TypeInferenceResult {
    const errors: string[] = [];
    const sampleValues: unknown[] = [];
    let matchCount = 0;

    for (const value of values) {
      if (typeof value === 'number') {
        if (integerOnly) {
          if (Number.isInteger(value)) {
            matchCount++;
            sampleValues.push(value);
          }
        } else {
          matchCount++;
          sampleValues.push(value);
        }
      } else if (typeof value === 'string') {
        const numValue = integerOnly ? this.convertToInteger(value) : this.convertToNumber(value);
        if (!isNaN(Number(numValue))) {
          matchCount++;
          sampleValues.push(numValue);
        }
      }
    }

    const confidence = matchCount / values.length;

    return {
      type: integerOnly ? 'integer' : 'number',
      confidence,
      errors,
      sampleValues
    };
  }

  /**
   * Analyze values as email type
   */
  private analyzeAsEmail(values: unknown[]): TypeInferenceResult {
    const errors: string[] = [];
    const sampleValues: unknown[] = [];
    let matchCount = 0;

    for (const value of values) {
      if (typeof value === 'string') {
        if (this.isValidEmail(value)) {
          matchCount++;
          sampleValues.push(value);
        }
      }
    }

    const confidence = matchCount / values.length;

    return {
      type: 'email',
      confidence,
      errors,
      sampleValues
    };
  }

  /**
   * Analyze values as phone type
   */
  private analyzeAsPhone(values: unknown[]): TypeInferenceResult {
    const errors: string[] = [];
    const sampleValues: unknown[] = [];
    let matchCount = 0;

    for (const value of values) {
      if (typeof value === 'string') {
        if (this.isValidPhone(value)) {
          matchCount++;
          sampleValues.push(value);
        }
      }
    }

    const confidence = matchCount / values.length;

    return {
      type: 'phone',
      confidence,
      errors,
      sampleValues
    };
  }

  /**
   * Analyze values as URL type
   */
  private analyzeAsUrl(values: unknown[]): TypeInferenceResult {
    const errors: string[] = [];
    const sampleValues: unknown[] = [];
    let matchCount = 0;

    for (const value of values) {
      if (typeof value === 'string') {
        if (this.isValidUrl(value)) {
          matchCount++;
          sampleValues.push(value);
        }
      }
    }

    const confidence = matchCount / values.length;

    return {
      type: 'url',
      confidence,
      errors,
      sampleValues
    };
  }

  /**
   * Analyze values as string type (fallback)
   */
  private analyzeAsString(values: unknown[]): TypeInferenceResult {
    return {
      type: 'string',
      confidence: 0.1, // Low confidence as it's the fallback
      errors: [],
      sampleValues: values.slice(0, 5)
    };
  }

  /**
   * Convert value to number
   */
  private convertToNumber(value: unknown): number {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      // Remove common number formatting characters
      const cleanValue = value.replace(/[,$%]/g, '').trim();
      const parsed = parseFloat(cleanValue);
      return isNaN(parsed) ? NaN : parsed;
    }

    return NaN;
  }

  /**
   * Convert value to integer
   */
  private convertToInteger(value: unknown): number {
    const numValue = this.convertToNumber(value);
    return isNaN(numValue) ? NaN : Math.floor(numValue);
  }

  /**
   * Convert value to boolean
   */
  private convertToBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value !== 0;
    }

    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase().trim();
      return /^(true|yes|1|y|on|✓|t)$/i.test(lowerValue);
    }

    return Boolean(value);
  }

  /**
   * Convert value to date
   */
  private convertToDate(value: unknown): Date | null {
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      return this.parseDate(String(value));
    }

    return null;
  }

  /**
   * Convert value to email (normalize)
   */
  private convertToEmail(value: unknown): string {
    return String(value).toLowerCase().trim();
  }

  /**
   * Convert value to phone (normalize)
   */
  private convertToPhone(value: unknown): string {
    const phone = String(value).replace(/[^\d+]/g, '');
    return phone;
  }

  /**
   * Convert value to URL (normalize)
   */
  private convertToUrl(value: unknown): string {
    let url = String(value).trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    return url;
  }

  /**
   * Convert value to ID (normalize)
   */
  private convertToId(value: unknown): string {
    return String(value).trim().toUpperCase();
  }

  /**
   * Convert value to enum
   */
  private convertToEnum(value: unknown, enumValues: string[]): string {
    const strValue = String(value).trim();
    
    // Exact match
    if (enumValues.includes(strValue)) {
      return strValue;
    }

    // Case-insensitive match
    const lowerValue = strValue.toLowerCase();
    for (const enumValue of enumValues) {
      if (enumValue.toLowerCase() === lowerValue) {
        return enumValue;
      }
    }

    return strValue;
  }

  /**
   * Parse date using various formats
   */
  private parseDate(value: string): Date | null {
    // Try ISO format first
    const isoDate = new Date(value);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }

    // Try common formats
    const formats = [
      /^(\d{4})-(\d{2})-(\d{2})$/,
      /^(\d{2})\/(\d{2})\/(\d{4})$/,
      /^(\d{2})-(\d{2})-(\d{4})$/,
      /^(\d{2})\/(\d{2})\/(\d{2})$/,
      /^(\d{4})\/(\d{2})\/(\d{2})$/
    ];

    for (const format of formats) {
      const match = value.match(format);
      if (match) {
        let year, month, day;
        
        if (format.source.includes('\\d{4}')) {
          // Year is 4 digits
          if (format.source.startsWith('^\\d{4}')) {
            // YYYY-MM-DD or YYYY/MM/DD
            [, year, month, day] = match;
          } else {
            // MM/DD/YYYY or DD/MM/YYYY
            if (format.source.includes('\\d{2})\\/\\d{2})\\/\\d{4}')) {
              // MM/DD/YYYY
              [, month, day, year] = match;
            } else {
              // DD/MM/YYYY
              [, day, month, year] = match;
            }
          }
        } else {
          // YY format
          [, month, day, year] = match;
          year = '20' + year;
        }

        const date = new Date(parseInt(year || '0'), parseInt(month || '0') - 1, parseInt(day || '0'));
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    return null;
  }

  /**
   * Detect date format from string
   */
  private detectDateFormat(value: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'YYYY-MM-DD';
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return 'MM/DD/YYYY';
    if (/^\d{2}-\d{2}-\d{4}$/.test(value)) return 'DD-MM-YYYY';
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(value)) return 'YYYY/MM/DD';
    if (/^\d{2}\/\d{2}\/\d{2}$/.test(value)) return 'MM/DD/YY';
    return 'unknown';
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone format
   */
  private isValidPhone(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Find best schema match for a column
   */
  private findBestSchemaMatch(
    columnName: string,
    schema: Record<string, { type: InferredType; enumValues?: string[] }>
  ): { fieldName: string; type: InferredType; enumValues?: string[] } | null {
    const lowerColumnName = columnName.toLowerCase();
    
    // Exact match
    if (schema[columnName]) {
      return { fieldName: columnName, ...schema[columnName] };
    }

    // Case-insensitive match
    for (const [fieldName, config] of Object.entries(schema)) {
      if (fieldName.toLowerCase() === lowerColumnName) {
        return { fieldName, ...config };
      }
    }

    // Partial match
    for (const [fieldName, config] of Object.entries(schema)) {
      const lowerFieldName = fieldName.toLowerCase();
      if (lowerColumnName.includes(lowerFieldName) || lowerFieldName.includes(lowerColumnName)) {
        return { fieldName, ...config };
      }
    }

    return null;
  }
}

/**
 * Default instance for immediate use
 */
export const defaultTypeInference = new TypeInference();

/**
 * Convenience function to analyze a single column
 */
export function analyzeColumnType(
  columnName: string,
  values: unknown[],
  config?: Partial<TypeInferenceConfig>
): TypeInferenceResult {
  const inference = config ? new TypeInference(config) : defaultTypeInference;
  return inference.analyzeColumn(columnName, values);
}

/**
 * Convenience function to convert a value
 */
export function convertValueType(
  value: unknown,
  targetType: InferredType,
  enumValues?: string[],
  config?: Partial<TypeInferenceConfig>
): ConversionResult {
  const inference = config ? new TypeInference(config) : defaultTypeInference;
  return inference.convertValue(value, targetType, enumValues);
}

/**
 * Convenience function to create field mappings
 */
export function createFieldMappingsFromData(
  data: Record<string, unknown[]>,
  targetSchema?: Record<string, { type: InferredType; enumValues?: string[] }>,
  config?: Partial<TypeInferenceConfig>
): Record<string, FieldMapping> {
  const inference = config ? new TypeInference(config) : defaultTypeInference;
  return inference.createFieldMappings(data, targetSchema);
}