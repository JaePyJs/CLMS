import { logger } from './logger';
import { TypeInference, TypeInferenceResult, FieldMapping, ConversionResult, InferredType } from './typeInference';
import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parser';
import * as xlsx from 'xlsx';

/**
 * Pipeline stage configuration
 */
export interface PipelineStage {
  name: string;
  enabled: boolean;
  options: Record<string, any>;
}

/**
 * Pipeline configuration options
 */
export interface PipelineConfig {
  stages: PipelineStage[];
  batchSize: number;
  maxErrors: number;
  skipInvalidRows: boolean;
  strictMode: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  customFieldMappings?: Record<string, Record<string, string>>;
  validationRules?: Record<string, ValidationRule[]>;
}

/**
 * Validation rule for data fields
 */
export interface ValidationRule {
  field: string;
  required: boolean;
  type?: InferredType;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  customValidator?: (value: any) => boolean | string;
}

/**
 * Pipeline progress tracking
 */
export interface PipelineProgress {
  stage: string;
  totalRows: number;
  processedRows: number;
  successRows: number;
  errorRows: number;
  startTime: Date;
  estimatedCompletion?: Date;
  errors: PipelineError[];
  warnings: PipelineWarning[];
}

/**
 * Pipeline error with context
 */
export interface PipelineError {
  row: number;
  column?: string;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
  data?: any;
}

/**
 * Pipeline warning for non-critical issues
 */
export interface PipelineWarning {
  row: number;
  column?: string;
  field?: string;
  message: string;
  data?: any;
}

/**
 * Transformation result with statistics
 */
export interface TransformationResult {
  success: boolean;
  totalRows: number;
  processedRows: number;
  successRows: number;
  errorRows: number;
  skippedRows: number;
  data: any[];
  errors: PipelineError[];
  warnings: PipelineWarning[];
  fieldMappings: Record<string, FieldMapping>;
  statistics: Record<string, any>;
  duration: number;
}

/**
 * Entity type definitions
 */
export type EntityType = 'students' | 'books' | 'equipment';

/**
 * Repository schema definitions
 */
export interface RepositorySchema {
  [entityType: string]: {
    fields: Record<string, {
      type: InferredType;
      required: boolean;
      unique?: boolean;
      enumValues?: string[];
      transform?: (value: any) => any;
    }>;
    externalIdField: string;
  };
}

/**
 * Flexible Data Transformation Pipeline
 * 
 * Orchestrates the transformation process for CSV/Excel data imports,
 * integrating with the type inference system and repository pattern.
 */
export class DataTransformationPipeline {
  private config: PipelineConfig;
  private typeInference: TypeInference;
  private logger = logger.child({ component: 'DataTransformationPipeline' });
  private progress: PipelineProgress;
  private repositorySchemas: RepositorySchema;

  constructor(config: Partial<PipelineConfig> = {}) {
    this.config = this.mergeConfig(config);
    this.typeInference = new TypeInference({
      strictMode: this.config.strictMode,
      logLevel: this.config.logLevel
    });
    
    this.progress = {
      stage: 'initialized',
      totalRows: 0,
      processedRows: 0,
      successRows: 0,
      errorRows: 0,
      startTime: new Date(),
      errors: [],
      warnings: []
    };

    this.repositorySchemas = this.initializeRepositorySchemas();
    this.logger.level = this.config.logLevel;
  }

  /**
   * Process a file through the transformation pipeline
   */
  async processFile(
    filePath: string,
    entityType: EntityType,
    options: {
      customMappings?: Record<string, string>;
      validationRules?: ValidationRule[];
      dryRun?: boolean;
    } = {}
  ): Promise<TransformationResult> {
    const startTime = Date.now();
    this.logger.info('Starting pipeline processing', {
      filePath,
      entityType,
      options
    });

    try {
      // Reset progress
      this.resetProgress();
      
      // Stage 1: File Parsing
      const rawData = await this.parseFile(filePath);
      this.updateProgress('parsing', rawData.length, 0);

      // Stage 2: Header Detection and Normalization
      const normalizedData = this.normalizeHeaders(rawData);
      this.updateProgress('normalization', normalizedData.length, 0);

      // Stage 3: Type Inference and Conversion
      const typedData = await this.performTypeInference(normalizedData, entityType);
      this.updateProgress('type-inference', typedData.length, 0);

      // Stage 4: Field Mapping
      const mappedData = this.performFieldMapping(typedData, entityType, options.customMappings);
      this.updateProgress('field-mapping', mappedData.length, 0);

      // Stage 5: Data Validation
      const validatedData = this.validateData(mappedData, entityType, options.validationRules);
      this.updateProgress('validation', validatedData.length, 0);

      // Stage 6: Data Transformation
      const transformedData = this.transformToRepositoryFormat(validatedData, entityType);
      this.updateProgress('transformation', transformedData.length, 0);

      // Stage 7: Batch Preparation
      const batches = this.prepareBatches(transformedData);
      this.updateProgress('batch-preparation', transformedData.length, transformedData.length);

      const duration = Date.now() - startTime;
      
      const result: TransformationResult = {
        success: this.progress.errorRows <= this.config.maxErrors,
        totalRows: rawData.length,
        processedRows: this.progress.processedRows,
        successRows: this.progress.successRows,
        errorRows: this.progress.errorRows,
        skippedRows: rawData.length - this.progress.processedRows,
        data: options.dryRun ? [] : transformedData,
        errors: this.progress.errors,
        warnings: this.progress.warnings,
        fieldMappings: this.getFieldMappings(normalizedData, entityType),
        statistics: this.generateStatistics(rawData, transformedData),
        duration
      };

      this.logger.info('Pipeline processing completed', {
        success: result.success,
        totalRows: result.totalRows,
        successRows: result.successRows,
        errorRows: result.errorRows,
        duration
      });

      return result;
    } catch (error) {
      this.logger.error('Pipeline processing failed', {
        error: error instanceof Error ? error.message : String(error),
        filePath,
        entityType
      });
      
      throw error;
    }
  }

  /**
   * Get current pipeline progress
   */
  getProgress(): PipelineProgress {
    return { ...this.progress };
  }

  /**
   * Parse CSV or Excel file
   */
  private async parseFile(filePath: string): Promise<any[]> {
    this.logger.debug('Parsing file', { filePath });
    
    const ext = path.extname(filePath).toLowerCase();
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    switch (ext) {
      case '.csv':
        return this.parseCsv(filePath);
      case '.xlsx':
      case '.xls':
        return this.parseExcel(filePath);
      default:
        throw new Error(`Unsupported file format: ${ext}`);
    }
  }

  /**
   * Parse CSV file
   */
  private async parseCsv(filePath: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          this.logger.debug('CSV parsing completed', { rows: results.length });
          resolve(results);
        })
        .on('error', (error) => {
          this.logger.error('CSV parsing failed', { error: error.message });
          reject(error);
        });
    });
  }

  /**
   * Parse Excel file
   */
  private async parseExcel(filePath: string): Promise<any[]> {
    try {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(worksheet);
      
      this.logger.debug('Excel parsing completed', { 
        sheet: sheetName, 
        rows: data.length 
      });
      
      return data;
    } catch (error) {
      this.logger.error('Excel parsing failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Normalize headers to consistent format
   */
  private normalizeHeaders(data: any[]): any[] {
    if (data.length === 0) return data;

    const firstRow = data[0];
    const headerMapping: Record<string, string> = {};
    
    // Create normalized header mapping
    for (const [originalHeader] of Object.entries(firstRow)) {
      const normalized = this.normalizeHeaderName(originalHeader);
      headerMapping[originalHeader] = normalized;
    }

    // Apply mapping to all rows
    return data.map((row, index) => {
      const normalizedRow: any = {};
      
      for (const [originalHeader, value] of Object.entries(row)) {
        const normalizedHeader = headerMapping[originalHeader];
        normalizedRow[normalizedHeader] = value;
      }
      
      return normalizedRow;
    });
  }

  /**
   * Normalize a single header name
   */
  private normalizeHeaderName(header: string): string {
    return header
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Perform type inference on data
   */
  private async performTypeInference(data: any[], entityType: EntityType): Promise<any[]> {
    this.logger.debug('Performing type inference', { rows: data.length, entityType });
    
    if (data.length === 0) return data;

    // Get column data
    const columns: Record<string, unknown[]> = {};
    for (const row of data) {
      for (const [key, value] of Object.entries(row)) {
        if (!columns[key]) columns[key] = [];
        columns[key].push(value);
      }
    }

    // Perform type inference for each column
    const typeResults: Record<string, TypeInferenceResult> = {};
    for (const [columnName, values] of Object.entries(columns)) {
      typeResults[columnName] = this.typeInference.analyzeColumn(columnName, values);
    }

    // Convert values based on inferred types
    return data.map((row, rowIndex) => {
      const convertedRow: any = {};
      
      for (const [key, value] of Object.entries(row)) {
        const typeResult = typeResults[key];
        if (typeResult) {
          const conversion = this.typeInference.convertValue(
            value, 
            typeResult.type, 
            typeResult.enumValues
          );
          
          if (conversion.success) {
            convertedRow[key] = conversion.value;
          } else {
            convertedRow[key] = value; // Keep original if conversion fails
            this.addError(rowIndex, key, `Type conversion failed: ${conversion.errors.join(', ')}`);
          }
          
          // Log warnings
          if (conversion.warnings.length > 0) {
            conversion.warnings.forEach(warning => {
              this.addWarning(rowIndex, key, warning);
            });
          }
        } else {
          convertedRow[key] = value;
        }
      }
      
      return convertedRow;
    });
  }

  /**
   * Perform field mapping to repository schema
   */
  private performFieldMapping(
    data: any[], 
    entityType: EntityType, 
    customMappings?: Record<string, string>
  ): any[] {
    this.logger.debug('Performing field mapping', { rows: data.length, entityType });
    
    if (data.length === 0) return data;

    const schema = this.repositorySchemas[entityType];
    if (!schema) {
      throw new Error(`No schema found for entity type: ${entityType}`);
    }

    // Create field mappings
    const mappings = this.createFieldMappings(data[0], schema, customMappings);
    
    // Apply mappings to all rows
    return data.map((row, rowIndex) => {
      const mappedRow: any = {};
      
      for (const [sourceField, targetField] of Object.entries(mappings)) {
        const value = row[sourceField];
        if (value !== undefined && value !== null && value !== '') {
          mappedRow[targetField] = value;
        }
      }
      
      return mappedRow;
    });
  }

  /**
   * Create field mappings from source to target schema
   */
  private createFieldMappings(
    sampleRow: any,
    schema: any,
    customMappings?: Record<string, string>
  ): Record<string, string> {
    const mappings: Record<string, string> = {};
    
    // Apply custom mappings first
    if (customMappings) {
      Object.assign(mappings, customMappings);
    }
    
    // Auto-map remaining fields
    for (const [sourceField] of Object.entries(sampleRow)) {
      if (mappings[sourceField]) continue; // Already mapped
      
      // Try exact match
      if (schema.fields[sourceField]) {
        mappings[sourceField] = sourceField;
        continue;
      }
      
      // Try fuzzy matching
      const targetField = this.findBestFieldMatch(sourceField, Object.keys(schema.fields));
      if (targetField) {
        mappings[sourceField] = targetField;
      }
    }
    
    return mappings;
  }

  /**
   * Find best field match using fuzzy matching
   */
  private findBestFieldMatch(sourceField: string, targetFields: string[]): string | null {
    const source = sourceField.toLowerCase().replace(/[_-]/g, '');
    
    let bestMatch: string | null = null;
    let bestScore = 0;
    
    for (const target of targetFields) {
      const targetNormalized = target.toLowerCase().replace(/[_-]/g, '');
      
      // Calculate similarity score
      let score = 0;
      
      // Exact match gets highest score
      if (source === targetNormalized) {
        score = 100;
      }
      // Contains match
      else if (source.includes(targetNormalized) || targetNormalized.includes(source)) {
        score = 80;
      }
      // Partial match
      else {
        const commonChars = this.countCommonChars(source, targetNormalized);
        score = (commonChars / Math.max(source.length, targetNormalized.length)) * 60;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = target;
      }
    }
    
    return bestScore > 30 ? bestMatch : null;
  }

  /**
   * Count common characters between two strings
   */
  private countCommonChars(str1: string, str2: string): number {
    const chars1 = new Set(str1);
    const chars2 = new Set(str2);
    let common = 0;
    
    for (const char of chars1) {
      if (chars2.has(char)) common++;
    }
    
    return common;
  }

  /**
   * Validate data against rules
   */
  private validateData(
    data: any[], 
    entityType: EntityType, 
    customRules?: ValidationRule[]
  ): any[] {
    this.logger.debug('Validating data', { rows: data.length, entityType });
    
    if (data.length === 0) return data;

    const schema = this.repositorySchemas[entityType];
    const rules = customRules || this.getValidationRules(entityType);
    
    return data.filter((row, rowIndex) => {
      let isValid = true;
      
      for (const rule of rules) {
        const value = row[rule.field];
        
        // Check required fields
        if (rule.required && (value === undefined || value === null || value === '')) {
          this.addError(rowIndex, rule.field, `Required field is missing or empty`);
          isValid = false;
          continue;
        }
        
        // Skip validation if field is empty and not required
        if (value === undefined || value === null || value === '') {
          continue;
        }
        
        // Type validation
        if (rule.type) {
          const conversion = this.typeInference.convertValue(value, rule.type);
          if (!conversion.success) {
            this.addError(rowIndex, rule.field, `Invalid type: ${conversion.errors.join(', ')}`);
            isValid = false;
          }
        }
        
        // Length validation
        if (typeof value === 'string') {
          if (rule.minLength && value.length < rule.minLength) {
            this.addError(rowIndex, rule.field, `Minimum length is ${rule.minLength} characters`);
            isValid = false;
          }
          
          if (rule.maxLength && value.length > rule.maxLength) {
            this.addError(rowIndex, rule.field, `Maximum length is ${rule.maxLength} characters`);
            isValid = false;
          }
        }
        
        // Pattern validation
        if (rule.pattern && typeof value === 'string') {
          if (!rule.pattern.test(value)) {
            this.addError(rowIndex, rule.field, `Value does not match required pattern`);
            isValid = false;
          }
        }
        
        // Custom validation
        if (rule.customValidator) {
          const result = rule.customValidator(value);
          if (result !== true) {
            this.addError(rowIndex, rule.field, typeof result === 'string' ? result : 'Custom validation failed');
            isValid = false;
          }
        }
      }
      
      if (isValid) {
        this.progress.successRows++;
      } else {
        this.progress.errorRows++;
        
        if (!this.config.skipInvalidRows) {
          throw new Error(`Validation failed for row ${rowIndex + 1}`);
        }
      }
      
      this.progress.processedRows++;
      return isValid;
    });
  }

  /**
   * Transform data to repository format
   */
  private transformToRepositoryFormat(data: any[], entityType: EntityType): any[] {
    this.logger.debug('Transforming to repository format', { rows: data.length, entityType });
    
    const schema = this.repositorySchemas[entityType];
    
    return data.map((row) => {
      const transformedRow: any = {};
      
      for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
        const value = row[fieldName];
        
        if (value !== undefined && value !== null && value !== '') {
          // Apply field transformation if defined
          if (fieldDef.transform) {
            transformedRow[fieldName] = fieldDef.transform(value);
          } else {
            transformedRow[fieldName] = value;
          }
        }
      }
      
      return transformedRow;
    });
  }

  /**
   * Prepare data in batches for processing
   */
  private prepareBatches(data: any[]): any[][] {
    this.logger.debug('Preparing batches', { 
      totalRows: data.length, 
      batchSize: this.config.batchSize 
    });
    
    const batches: any[][] = [];
    for (let i = 0; i < data.length; i += this.config.batchSize) {
      batches.push(data.slice(i, i + this.config.batchSize));
    }
    
    return batches;
  }

  /**
   * Initialize repository schemas for each entity type
   */
  private initializeRepositorySchemas(): RepositorySchema {
    return {
      students: {
        externalIdField: 'student_id',
        fields: {
          student_id: {
            type: 'id',
            required: true,
            unique: true
          },
          first_name: {
            type: 'string',
            required: true,
            maxLength: 255
          },
          last_name: {
            type: 'string',
            required: true,
            maxLength: 255
          },
          grade_level: {
            type: 'string',
            required: true
          },
          grade_category: {
            type: 'enum',
            required: true,
            enumValues: ['GRADE_7', 'GRADE_8', 'GRADE_9', 'GRADE_10', 'GRADE_11', 'GRADE_12']
          },
          section: {
            type: 'string',
            required: false
          },
          is_active: {
            type: 'boolean',
            required: false
          }
        }
      },
      books: {
        externalIdField: 'accession_no',
        fields: {
          accession_no: {
            type: 'id',
            required: true,
            unique: true
          },
          title: {
            type: 'string',
            required: true,
            maxLength: 500
          },
          author: {
            type: 'string',
            required: true,
            maxLength: 500
          },
          isbn: {
            type: 'string',
            required: false
          },
          publisher: {
            type: 'string',
            required: false
          },
          category: {
            type: 'string',
            required: true
          },
          subcategory: {
            type: 'string',
            required: false
          },
          location: {
            type: 'string',
            required: false
          },
          total_copies: {
            type: 'integer',
            required: false,
            transform: (value) => parseInt(value) || 1
          },
          available_copies: {
            type: 'integer',
            required: false,
            transform: (value) => parseInt(value) || 1
          },
          cost_price: {
            type: 'number',
            required: false,
            transform: (value) => parseFloat(value) || null
          },
          year: {
            type: 'integer',
            required: false,
            transform: (value) => parseInt(value) || null
          }
        }
      },
      equipment: {
        externalIdField: 'equipment_id',
        fields: {
          equipment_id: {
            type: 'id',
            required: true,
            unique: true
          },
          name: {
            type: 'string',
            required: true
          },
          type: {
            type: 'enum',
            required: true,
            enumValues: ['COMPUTER', 'GAMING', 'AVR', 'PRINTER', 'SCANNER', 'OTHER']
          },
          location: {
            type: 'string',
            required: true
          },
          status: {
            type: 'enum',
            required: false,
            enumValues: ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OUT_OF_ORDER']
          },
          description: {
            type: 'string',
            required: false
          },
          max_time_minutes: {
            type: 'integer',
            required: true,
            transform: (value) => parseInt(value) || 60
          },
          requires_supervision: {
            type: 'boolean',
            required: false
          },
          purchase_date: {
            type: 'date',
            required: false
          },
          purchase_cost: {
            type: 'number',
            required: false,
            transform: (value) => parseFloat(value) || null
          },
          serial_number: {
            type: 'string',
            required: false
          },
          asset_tag: {
            type: 'string',
            required: false
          }
        }
      }
    };
  }

  /**
   * Get validation rules for entity type
   */
  private getValidationRules(entityType: EntityType): ValidationRule[] {
    const schema = this.repositorySchemas[entityType];
    const rules: ValidationRule[] = [];
    
    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
      rules.push({
        field: fieldName,
        required: fieldDef.required,
        type: fieldDef.type,
        maxLength: fieldDef.maxLength
      });
    }
    
    return rules;
  }

  /**
   * Get field mappings for data
   */
  private getFieldMappings(data: any[], entityType: EntityType): Record<string, FieldMapping> {
    if (data.length === 0) return {};
    
    const schema = this.repositorySchemas[entityType];
    
    // Convert data to column format for type inference
    const columns: Record<string, unknown[]> = {};
    for (const row of data) {
      for (const [key, value] of Object.entries(row)) {
        if (!columns[key]) columns[key] = [];
        columns[key].push(value);
      }
    }
    
    // Create target schema for type inference
    const targetSchema: Record<string, { type: InferredType; enumValues?: string[] }> = {};
    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
      targetSchema[fieldName] = {
        type: fieldDef.type,
        enumValues: fieldDef.enumValues
      };
    }
    
    return this.typeInference.createFieldMappings(columns, targetSchema);
  }

  /**
   * Generate statistics for the transformation
   */
  private generateStatistics(originalData: any[], transformedData: any[]): Record<string, any> {
    return {
      originalRowCount: originalData.length,
      transformedRowCount: transformedData.length,
      transformationRate: originalData.length > 0 ? (transformedData.length / originalData.length) * 100 : 0,
      errorRate: this.progress.processedRows > 0 ? (this.progress.errorRows / this.progress.processedRows) * 100 : 0,
      warningCount: this.progress.warnings.length,
      processingTime: Date.now() - this.progress.startTime.getTime()
    };
  }

  /**
   * Update pipeline progress
   */
  private updateProgress(stage: string, totalRows: number, processedRows: number): void {
    this.progress.stage = stage;
    this.progress.totalRows = totalRows;
    this.progress.processedRows = processedRows;
    
    // Calculate estimated completion time
    if (processedRows > 0 && totalRows > processedRows) {
      const elapsed = Date.now() - this.progress.startTime.getTime();
      const avgTimePerRow = elapsed / processedRows;
      const remainingRows = totalRows - processedRows;
      const estimatedRemaining = remainingRows * avgTimePerRow;
      this.progress.estimatedCompletion = new Date(Date.now() + estimatedRemaining);
    }
    
    this.logger.debug('Progress updated', {
      stage,
      totalRows,
      processedRows,
      successRows: this.progress.successRows,
      errorRows: this.progress.errorRows
    });
  }

  /**
   * Add error to progress
   */
  private addError(row: number, field: string, message: string): void {
    this.progress.errors.push({
      row: row + 1, // Convert to 1-based indexing
      field,
      message,
      severity: 'error'
    });
    
    this.progress.errorRows++;
  }

  /**
   * Add warning to progress
   */
  private addWarning(row: number, field: string, message: string): void {
    this.progress.warnings.push({
      row: row + 1, // Convert to 1-based indexing
      field,
      message
    });
  }

  /**
   * Reset pipeline progress
   */
  private resetProgress(): void {
    this.progress = {
      stage: 'initialized',
      totalRows: 0,
      processedRows: 0,
      successRows: 0,
      errorRows: 0,
      startTime: new Date(),
      errors: [],
      warnings: []
    };
  }

  /**
   * Merge configuration with defaults
   */
  private mergeConfig(config: Partial<PipelineConfig>): PipelineConfig {
    const defaultConfig: PipelineConfig = {
      stages: [
        { name: 'parsing', enabled: true, options: {} },
        { name: 'normalization', enabled: true, options: {} },
        { name: 'type-inference', enabled: true, options: {} },
        { name: 'field-mapping', enabled: true, options: {} },
        { name: 'validation', enabled: true, options: {} },
        { name: 'transformation', enabled: true, options: {} },
        { name: 'batch-preparation', enabled: true, options: {} }
      ],
      batchSize: 100,
      maxErrors: 10,
      skipInvalidRows: true,
      strictMode: false,
      logLevel: 'info',
      customFieldMappings: {},
      validationRules: {}
    };
    
    return { ...defaultConfig, ...config };
  }
}