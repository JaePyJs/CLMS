import { faker } from '@faker-js/faker';
import type { Prisma } from '@prisma/client';

/**
 * Base Factory Class
 * 
 * Provides common functionality for all entity factories including:
 * - ID generation with prefixes
 * - Timestamp management
 * - Data validation
 * - Bulk generation capabilities
 * - Override handling
 */
export abstract class BaseFactory<TModel, TCreateInput, TUpdateInput> {
  protected static counter = 0;
  protected static entityCounters: Record<string, number> = {};

  /**
   * Get the next ID for a specific entity type
   */
  protected static getNextId(prefix: string): string {
    if (!this.entityCounters[prefix]) {
      this.entityCounters[prefix] = 0;
    }
    const counter = ++this.entityCounters[prefix];
    return `${prefix}-${Date.now()}-${counter.toString().padStart(4, '0')}`;
  }

  /**
   * Reset all counters for consistent test results
   */
  static resetAllCounters(): void {
    BaseFactory.counter = 0;
    BaseFactory.entityCounters = {};
  }

  /**
   * Generate a valid ISBN-13 number
   */
  protected static generateISBN(): string {
    // Generate 12 random digits
    let isbn = '';
    for (let i = 0; i < 12; i++) {
      isbn += faker.number.int({ min: 0, max: 9 }).toString();
    }
    
    // Calculate check digit
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(isbn[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    
    return isbn + checkDigit.toString();
  }

  /**
   * Generate a realistic student ID based on grade level
   */
  protected static generateStudentId(gradeLevel: string): string {
    const year = new Date().getFullYear();
    const gradeNumber = gradeLevel.replace(/[^0-9]/g, '');
    const random = faker.number.int({ min: 1000, max: 9999 });
    return `${year}-${gradeNumber}-${random}`;
  }

  /**
   * Generate a realistic accession number
   */
  protected static generateAccessionNumber(): string {
    const year = faker.number.int({ min: 2020, max: 2024 });
    const sequence = faker.number.int({ min: 1000, max: 9999 });
    return `ACC-${year}-${sequence}`;
  }

  /**
   * Generate a realistic equipment ID
   */
  protected static generateEquipmentId(): string {
    const prefix = faker.helpers.arrayElement(['EQ', 'DEV', 'LAB', 'LIB']);
    const year = faker.number.int({ min: 2020, max: 2024 });
    const sequence = faker.number.int({ min: 100, max: 999 });
    return `${prefix}-${year}-${sequence}`;
  }

  /**
   * Generate realistic timestamps
   */
  protected static generateTimestamps(options: {
    createdAt?: Date;
    updatedAt?: Date;
    ageInDays?: number;
  } = {}): { created_at: Date; updated_at: Date } {
    const now = new Date();
    const createdAt = options.createdAt || 
      (options.ageInDays ? faker.date.past({ days: options.ageInDays }) : faker.date.past({ years: 2 }));
    const updatedAt = options.updatedAt || 
      faker.date.between({ from: createdAt, to: now });

    return {
      created_at: createdAt,
      updated_at: updatedAt
    };
  }

  /**
   * Apply overrides to base data
   */
  protected static applyOverrides<T>(baseData: T, overrides: Partial<T>): T {
    return { ...baseData, ...overrides };
  }

  /**
   * Validate generated data against schema requirements
   */
  protected static validateData(data: any, requiredFields: string[]): void {
    const missingFields = requiredFields.filter(field => 
      data[field] === null || data[field] === undefined || data[field] === ''
    );

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
  }

  /**
   * Generate array of entities with optional overrides
   */
  static createMany<T>(
    count: number,
    factory: () => T,
    overrides?: Partial<T>
  ): T[] {
    return Array.from({ length: count }, (_, index) => {
      const entity = factory();
      if (overrides) {
        return this.applyOverrides(entity, overrides);
      }
      return entity;
    });
  }

  /**
   * Generate array with varying overrides
   */
  static createManyWithVariations<T>(
    count: number,
    factory: () => T,
    overridesArray: Partial<T>[]
  ): T[] {
    return Array.from({ length: count }, (_, index) => {
      const entity = factory();
      const override = overridesArray[index % overridesArray.length];
      return this.applyOverrides(entity, override);
    });
  }

  /**
   * Generate a random element from enum values
   */
  protected static randomEnum<T>(enumValues: T[]): T {
    return faker.helpers.arrayElement(enumValues);
  }

  /**
   * Generate a random boolean with probability
   */
  protected static randomBoolean(probability: number = 0.5): boolean {
    return faker.datatype.boolean({ probability });
  }

  /**
   * Generate a random integer in range
   */
  protected static randomInt(min: number, max: number): number {
    return faker.number.int({ min, max });
  }

  /**
   * Generate a random float in range
   */
  protected static randomFloat(min: number, max: number, fractionDigits: number = 2): number {
    return faker.number.float({ min, max, fractionDigits });
  }

  /**
   * Generate a random date in range
   */
  protected static randomDate(from: Date, to: Date): Date {
    return faker.date.between({ from, to });
  }

  /**
   * Generate a random past date
   */
  protected static randomPastDate(options: { years?: number; days?: number } = {}): Date {
    if (options.years) {
      return faker.date.past({ years: options.years });
    }
    if (options.days) {
      return faker.date.past({ days: options.days });
    }
    return faker.date.past({ years: 1 });
  }

  /**
   * Generate a random future date
   */
  protected static randomFutureDate(options: { years?: number; days?: number } = {}): Date {
    if (options.years) {
      return faker.date.future({ years: options.years });
    }
    if (options.days) {
      return faker.date.future({ days: options.days });
    }
    return faker.date.future({ years: 1 });
  }

  /**
   * Generate a random recent date
   */
  protected static randomRecentDate(options: { hours?: number; days?: number } = {}): Date {
    if (options.hours) {
      return faker.date.recent({ hours: options.hours });
    }
    if (options.days) {
      return faker.date.recent({ days: options.days });
    }
    return faker.date.recent({ hours: 24 });
  }

  /**
   * Generate random text with specified length
   */
  protected static randomText(options: {
    min?: number;
    max?: number;
    length?: number;
  } = {}): string {
    const { min = 1, max = 100, length } = options;
    
    if (length !== undefined) {
      return faker.lorem.words({ min: length, max: length });
    }
    
    return faker.lorem.words({ min, max });
  }

  /**
   * Generate random paragraph
   */
  protected static randomParagraph(options: { min?: number; max?: number } = {}): string {
    const { min = 1, max = 3 } = options;
    return faker.lorem.paragraphs({ min, max });
  }

  /**
   * Generate random email
   */
  protected static randomEmail(): string {
    return faker.internet.email();
  }

  /**
   * Generate random phone number
   */
  protected static randomPhone(): string {
    return faker.phone.number();
  }

  /**
   * Generate random URL
   */
  protected static randomUrl(): string {
    return faker.internet.url();
  }

  /**
   * Generate random name
   */
  protected static randomName(): { first: string; last: string; full: string } {
    const first = faker.person.firstName();
    const last = faker.person.lastName();
    return { first, last, full: `${first} ${last}` };
  }

  /**
   * Generate random company name
   */
  protected static randomCompany(): string {
    return faker.company.name();
  }

  /**
   * Generate random address
   */
  protected static randomAddress(): string {
    return faker.location.streetAddress();
  }

  /**
   * Generate random alphanumeric string
   */
  protected static randomAlphanumeric(length: number): string {
    return faker.string.alphanumeric({ length });
  }

  /**
   * Generate random numeric string
   */
  protected static randomNumeric(length: number): string {
    return faker.string.numeric({ length });
  }

  /**
   * Generate random alpha string
   */
  protected static randomAlpha(length: number): string {
    return faker.string.alpha({ length });
  }

  /**
   * Abstract method to create a single entity
   */
  abstract create(overrides?: Partial<TCreateInput>): TModel;

  /**
   * Create multiple entities with optional overrides
   */
  createMany(count: number, overrides?: Partial<TCreateInput>): TModel[] {
    return BaseFactory.createMany(count, () => this.create(overrides));
  }

  /**
   * Create entities with specific variations
   */
  createManyWithVariations(
    count: number,
    overridesArray: Partial<TCreateInput>[]
  ): TModel[] {
    return BaseFactory.createManyWithVariations(
      count,
      () => this.create(),
      overridesArray
    );
  }
}