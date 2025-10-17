/**
 * Factory Index
 * 
 * Central export point for all test data factories.
 * Provides convenient access to all factory classes and utilities.
 */

// Core factories
export { BaseFactory } from './BaseFactory';
export { StudentFactory } from './StudentFactory';
export { BookFactory } from './BookFactory';
export { EquipmentFactory } from './EquipmentFactory';
export { CheckoutFactory } from './CheckoutFactory';
export { UserFactory } from './UserFactory';
export { RelationshipFactory } from './RelationshipFactory';

// Type exports for convenience
export type {
  students,
  books,
  equipment,
  users,
  book_checkouts,
  students_grade_category,
  equipment_type,
  equipment_status,
  equipment_condition_rating,
  book_checkouts_status,
  users_role
} from '@prisma/client';

import { StudentFactory } from './StudentFactory';
import { BookFactory } from './BookFactory';
import { EquipmentFactory } from './EquipmentFactory';
import { CheckoutFactory } from './CheckoutFactory';
import { UserFactory } from './UserFactory';
import { RelationshipFactory } from './RelationshipFactory';
import { BaseFactory } from './BaseFactory';

/**
 * Factory Manager
 * 
 * Provides a unified interface for managing all factories
 * and creating comprehensive test datasets.
 */
export class FactoryManager {
  private static instance: FactoryManager;
  private studentFactory: StudentFactory;
  private bookFactory: BookFactory;
  private equipmentFactory: EquipmentFactory;
  private checkoutFactory: CheckoutFactory;
  private userFactory: UserFactory;
  private relationshipFactory: RelationshipFactory;

  private constructor() {
    this.studentFactory = new StudentFactory();
    this.bookFactory = new BookFactory();
    this.equipmentFactory = new EquipmentFactory();
    this.checkoutFactory = new CheckoutFactory();
    this.userFactory = new UserFactory();
    this.relationshipFactory = new RelationshipFactory();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): FactoryManager {
    if (!FactoryManager.instance) {
      FactoryManager.instance = new FactoryManager();
    }
    return FactoryManager.instance;
  }

  /**
   * Reset all factory counters
   */
  resetAll(): void {
    BaseFactory.resetAllCounters();
  }

  // Factory accessors
  get students(): StudentFactory {
    return this.studentFactory;
  }

  get books(): BookFactory {
    return this.bookFactory;
  }

  get equipment(): EquipmentFactory {
    return this.equipmentFactory;
  }

  get checkouts(): CheckoutFactory {
    return this.checkoutFactory;
  }

  get users(): UserFactory {
    return this.userFactory;
  }

  get relationships(): RelationshipFactory {
    return this.relationshipFactory;
  }

  /**
   * Quick factory methods for common scenarios
   */
  async createQuickDataset(): Promise<{
    students: any[];
    books: any[];
    equipment: any[];
    users: any[];
    checkouts: any[];
  }> {
    const ecosystem = await this.relationships.createCompleteEcosystem({
      studentCount: 20,
      bookCount: 40,
      equipmentCount: 15,
      userCount: 5,
      checkoutCount: 30
    });

    return {
      students: ecosystem.students,
      books: ecosystem.books,
      equipment: ecosystem.equipment,
      users: ecosystem.users,
      checkouts: ecosystem.checkouts
    };
  }

  async createAuthTestData(): Promise<{
    superAdmin: any;
    admin: any;
    librarian: any;
    testUser: any;
  }> {
    const superAdmin = await this.users.createSuperAdmin();
    const admin = await this.users.createAdmin();
    const librarian = await this.users.createLibrarian();
    const testUser = await this.users.createTestUser();

    return {
      superAdmin,
      admin,
      librarian,
      testUser
    };
  }

  createPerformanceTestData(scale: 'small' | 'medium' | 'large' = 'medium') {
    return this.relationships.createStressTestData(scale);
  }

  /**
   * Seed data for development/testing
   */
  async seedDevelopmentData(): Promise<{
    message: string;
    counts: Record<string, number>;
    data: any;
  }> {
    this.resetAll();

    // Create user hierarchy
    const { superAdmin, admins, librarians, assistants } = await this.users.createCompleteHierarchy();

    // Create diverse student population
    const students = this.students.createDiverseSet(100);

    // Create comprehensive book collection
    const books = this.books.createDiverseCollection(200);

    // Create equipment inventory
    const equipment = this.equipmentFactory.createDiverseInventory(50);

    // Create realistic checkout history
    const checkouts = this.checkouts.createRealisticHistory(150);

    // Create interconnected relationships
    const relationships = await this.relationships.createCompleteEcosystem({
      studentCount: 50,
      bookCount: 100,
      equipmentCount: 25,
      userCount: 8,
      checkoutCount: 75
    });

    const counts = {
      users: 1 + admins.length + librarians.length + assistants.length,
      students: students.length,
      books: books.length,
      equipment: equipment.length,
      checkouts: checkouts.length,
      activities: relationships.activities.length
    };

    return {
      message: 'Development data seeded successfully',
      counts,
      data: {
        users: { superAdmin, admins, librarians, assistants },
        students,
        books,
        equipment,
        checkouts,
        relationships
      }
    };
  }
}

/**
 * Export singleton instance for convenience
 */
export const factories = FactoryManager.getInstance();

/**
 * Utility functions for common test scenarios
 */
export const TestScenarios = {
  /**
   * Create data for API testing
   */
  async createAPITestData() {
    return {
      users: await factories.createAuthTestData(),
      students: factories.students.createDiverseSet(10),
      books: factories.books.createDiverseCollection(20),
      equipment: factories.equipmentFactory.createDiverseInventory(10),
      checkouts: factories.checkouts.createRealisticHistory(25)
    };
  },

  /**
   * Create data for UI testing
   */
  async createUITestData() {
    return {
      dashboard: await factories.relationships.createLibraryWorkflowScenario(),
      analytics: factories.books.createWithCirculationPatterns(),
      reports: factories.checkouts.createWithFineScenarios()
    };
  },

  /**
   * Create data for performance testing
   */
  async createPerformanceData(scale: 'small' | 'medium' | 'large' = 'medium') {
    return factories.createPerformanceTestData(scale);
  },

  /**
   * Create data for edge case testing
   */
  async createEdgeCaseData() {
    return factories.relationships.createEdgeCaseScenarios();
  }
};

/**
 * Data validation utilities
 */
export const DataValidation = {
  /**
   * Validate generated data against schema requirements
   */
  validateStudent(student: any): boolean {
    return !!(student.id && student.student_id && student.first_name && 
             student.last_name && student.grade_level && student.grade_category);
  },

  validateBook(book: any): boolean {
    return !!(book.id && book.accession_no && book.title && book.author && 
             book.category && book.is_active !== undefined);
  },

  validateEquipment(equipment: any): boolean {
    return !!(equipment.id && equipment.name && equipment.type && 
             equipment.location && equipment.status);
  },

  validateUser(user: any): boolean {
    return !!(user.id && user.username && user.password && user.role);
  },

  validateCheckout(checkout: any): boolean {
    return !!(checkout.id && checkout.book_id && checkout.student_id && 
             checkout.checkout_date && checkout.due_date && checkout.status);
  },

  /**
   * Validate relationships between entities
   */
  validateRelationships(data: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if checkouts reference valid students and books
    if (data.checkouts && data.students && data.books) {
      data.checkouts.forEach((checkout: any) => {
        const studentExists = data.students.some((s: any) => s.id === checkout.student_id);
        const bookExists = data.books.some((b: any) => b.id === checkout.book_id);

        if (!studentExists) {
          errors.push(`Checkout ${checkout.id} references non-existent student ${checkout.student_id}`);
        }
        if (!bookExists) {
          errors.push(`Checkout ${checkout.id} references non-existent book ${checkout.book_id}`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
};

/**
 * Export all factories for individual use
 */
export {
  StudentFactory,
  BookFactory,
  EquipmentFactory,
  CheckoutFactory,
  UserFactory,
  RelationshipFactory,
  BaseFactory
};

/**
 * Default export for convenience
 */
export default factories;