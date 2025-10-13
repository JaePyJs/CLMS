import { Page } from '@playwright/test';

/**
 * Test Data Manager
 *
 * Provides utilities for managing test data:
 * - Creating test records
 * - Cleaning up test data
 * - Managing test state
 * - Providing test data factories
 * - Handling data isolation between tests
 */

export class TestDataManager {
  private page: Page;
  private createdRecords: Map<string, any[]> = new Map();

  constructor(page: Page) {
    this.page = page;
  }

  // ========== Student Data Management ==========

  async createTestStudent(overrides: Partial<TestStudent> = {}): Promise<TestStudent> {
    const student: TestStudent = {
      id: `TEST_STUDENT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      firstName: overrides.firstName || 'Test',
      lastName: overrides.lastName || `Student_${Date.now()}`,
      email: overrides.email || `test.student.${Date.now()}@test.com`,
      grade: overrides.grade || 'GRADE_10',
      studentId: overrides.studentId || `S${Date.now()}`,
      phone: overrides.phone || `555-010-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
      address: overrides.address || '123 Test Street',
      emergencyContact: overrides.emergencyContact || 'Test Parent',
      emergencyPhone: overrides.phone || '555-010-9999',
      dateOfBirth: overrides.dateOfBirth || '2008-01-01',
      enrolledDate: overrides.enrolledDate || new Date().toISOString().split('T')[0],
      isActive: overrides.isActive !== undefined ? overrides.isActive : true
    };

    // Store for cleanup
    this.addCreatedRecord('students', student);

    return student;
  }

  async createTestStudents(count: number, overrides: Partial<TestStudent> = {}): Promise<TestStudent[]> {
    const students: TestStudent[] = [];
    for (let i = 0; i < count; i++) {
      const student = await this.createTestStudent({
        ...overrides,
        firstName: overrides.firstName || `Test${i}`,
        lastName: overrides.lastName || `Student_${Date.now()}_${i}`,
        email: overrides.email || `test.student.${i}.${Date.now()}@test.com`,
        studentId: overrides.studentId || `S${Date.now()}_${i}`
      });
      students.push(student);
    }
    return students;
  }

  // ========== Book Data Management ==========

  async createTestBook(overrides: Partial<TestBook> = {}): Promise<TestBook> {
    const book: TestBook = {
      id: `TEST_BOOK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: overrides.title || `Test Book ${Date.now()}`,
      author: overrides.author || `Test Author ${Date.now()}`,
      isbn: overrides.isbn || `9780000000000${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      accessionNumber: overrides.accessionNumber || `ACC${Date.now()}`,
      publisher: overrides.publisher || 'Test Publisher',
      publishYear: overrides.publishYear || 2023,
      category: overrides.category || 'Fiction',
      location: overrides.location || 'Main Library',
      status: overrides.status || 'Available',
      totalCopies: overrides.totalCopies || 1,
      availableCopies: overrides.availableCopies || 1,
      description: overrides.description || 'A test book for testing purposes',
      addedDate: overrides.addedDate || new Date().toISOString().split('T')[0]
    };

    this.addCreatedRecord('books', book);
    return book;
  }

  async createTestBooks(count: number, overrides: Partial<TestBook> = {}): Promise<TestBook[]> {
    const books: TestBook[] = [];
    for (let i = 0; i < count; i++) {
      const book = await this.createTestBook({
        ...overrides,
        title: overrides.title || `Test Book ${i} ${Date.now()}`,
        author: overrides.author || `Test Author ${i}`,
        isbn: overrides.isbn || `9780000000000${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        accessionNumber: overrides.accessionNumber || `ACC${Date.now()}_${i}`
      });
      books.push(book);
    }
    return books;
  }

  // ========== Equipment Data Management ==========

  async createTestEquipment(overrides: Partial<TestEquipment> = {}): Promise<TestEquipment> {
    const equipment: TestEquipment = {
      id: `TEST_EQ_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: overrides.name || `Test Equipment ${Date.now()}`,
      type: overrides.type || 'Computer',
      brand: overrides.brand || 'Test Brand',
      model: overrides.model || 'Test Model',
      serialNumber: overrides.serialNumber || `SN${Date.now()}`,
      location: overrides.location || 'Computer Lab',
      status: overrides.status || 'Available',
      condition: overrides.condition || 'Good',
      purchaseDate: overrides.purchaseDate || new Date().toISOString().split('T')[0],
      warrantyExpiry: overrides.warrantyExpiry || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      description: overrides.description || 'Test equipment for testing purposes'
    };

    this.addCreatedRecord('equipment', equipment);
    return equipment;
  }

  // ========== User Data Management ==========

  async createTestUser(role: string, overrides: Partial<TestUser> = {}): Promise<TestUser> {
    const user: TestUser = {
      id: `TEST_USER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      username: overrides.username || `testuser_${role.toLowerCase()}_${Date.now()}`,
      email: overrides.email || `test.${role.toLowerCase()}.${Date.now()}@test.com`,
      firstName: overrides.firstName || 'Test',
      lastName: overrides.lastName || `${role} User`,
      role: role,
      isActive: overrides.isActive !== undefined ? overrides.isActive : true,
      createdDate: overrides.createdDate || new Date().toISOString().split('T')[0],
      lastLogin: overrides.lastLogin || null
    };

    this.addCreatedRecord('users', user);
    return user;
  }

  // ========== Cleanup Management ==========

  async cleanupAllTestData(): Promise<void> {
    console.log('🧹 Cleaning up all test data...');

    const cleanupPromises: Promise<void>[] = [];

    // Clean up in reverse order of dependencies
    const cleanupOrder = ['users', 'equipment', 'books', 'students'];

    for (const recordType of cleanupOrder) {
      const records = this.createdRecords.get(recordType) || [];
      if (records.length > 0) {
        cleanupPromises.push(this.cleanupRecords(recordType, records));
      }
    }

    await Promise.allSettled(cleanupPromises);
    this.createdRecords.clear();

    console.log('✅ Test data cleanup completed');
  }

  private async cleanupRecords(recordType: string, records: any[]): Promise<void> {
    try {
      console.log(`Cleaning up ${records.length} ${recordType} records`);

      for (const record of records) {
        switch (recordType) {
          case 'students':
            await this.cleanupStudent(record);
            break;
          case 'books':
            await this.cleanupBook(record);
            break;
          case 'equipment':
            await this.cleanupEquipment(record);
            break;
          case 'users':
            await this.cleanupUser(record);
            break;
        }
      }

      console.log(`✅ Cleaned up ${records.length} ${recordType} records`);
    } catch (error) {
      console.error(`❌ Error cleaning up ${recordType}:`, error);
    }
  }

  private async cleanupStudent(student: TestStudent): Promise<void> {
    // Make API call to delete student
    const response = await this.page.request.delete(`/api/students/${student.id}`, {
      headers: {
        'Authorization': `Bearer ${await this.getAuthToken()}`
      }
    });

    if (response.status() !== 200 && response.status() !== 404) {
      console.warn(`Failed to cleanup student ${student.id}: ${response.status()}`);
    }
  }

  private async cleanupBook(book: TestBook): Promise<void> {
    const response = await this.page.request.delete(`/api/books/${book.id}`, {
      headers: {
        'Authorization': `Bearer ${await this.getAuthToken()}`
      }
    });

    if (response.status() !== 200 && response.status() !== 404) {
      console.warn(`Failed to cleanup book ${book.id}: ${response.status()}`);
    }
  }

  private async cleanupEquipment(equipment: TestEquipment): Promise<void> {
    const response = await this.page.request.delete(`/api/equipment/${equipment.id}`, {
      headers: {
        'Authorization': `Bearer ${await this.getAuthToken()}`
      }
    });

    if (response.status() !== 200 && response.status() !== 404) {
      console.warn(`Failed to cleanup equipment ${equipment.id}: ${response.status()}`);
    }
  }

  private async cleanupUser(user: TestUser): Promise<void> {
    const response = await this.page.request.delete(`/api/users/${user.id}`, {
      headers: {
        'Authorization': `Bearer ${await this.getAuthToken()}`
      }
    });

    if (response.status() !== 200 && response.status() !== 404) {
      console.warn(`Failed to cleanup user ${user.id}: ${response.status()}`);
    }
  }

  // ========== Utility Methods ==========

  private addCreatedRecord(type: string, record: any): void {
    if (!this.createdRecords.has(type)) {
      this.createdRecords.set(type, []);
    }
    this.createdRecords.get(type)!.push(record);
  }

  private async getAuthToken(): Promise<string> {
    return await this.page.evaluate(() => localStorage.getItem('token') || '');
  }

  async setupTestDataForTest(testType: string): Promise<any> {
    console.log(`📊 Setting up test data for ${testType}`);

    switch (testType) {
      case 'student-management':
        return await this.setupStudentManagementTestData();
      case 'book-catalog':
        return await this.setupBookCatalogTestData();
      case 'equipment':
        return await this.setupEquipmentTestData();
      case 'authentication':
        return await this.setupAuthenticationTestData();
      default:
        return {};
    }
  }

  private async setupStudentManagementTestData(): Promise<any> {
    const students = await this.createTestStudents(5);
    const adminUser = await this.createTestUser('ADMIN');
    const teacherUser = await this.createTestUser('TEACHER');

    return { students, adminUser, teacherUser };
  }

  private async setupBookCatalogTestData(): Promise<any> {
    const books = await this.createTestBooks(10);
    return { books };
  }

  private async setupEquipmentTestData(): Promise<any> {
    const equipment = await this.createTestEquipment();
    return { equipment };
  }

  private async setupAuthenticationTestData(): Promise<any> {
    const users = [
      await this.createTestUser('ADMIN'),
      await this.createTestUser('LIBRARIAN'),
      await this.createTestUser('TEACHER'),
      await this.createTestUser('STUDENT')
    ];

    return { users };
  }

  getCreatedRecords(type: string): any[] {
    return this.createdRecords.get(type) || [];
  }

  getTotalCreatedRecords(): number {
    let total = 0;
    for (const records of this.createdRecords.values()) {
      total += records.length;
    }
    return total;
  }
}

// ========== Type Definitions ==========

export interface TestStudent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  grade: string;
  studentId: string;
  phone: string;
  address: string;
  emergencyContact: string;
  emergencyPhone: string;
  dateOfBirth: string;
  enrolledDate: string;
  isActive: boolean;
}

export interface TestBook {
  id: string;
  title: string;
  author: string;
  isbn: string;
  accessionNumber: string;
  publisher: string;
  publishYear: number;
  category: string;
  location: string;
  status: string;
  totalCopies: number;
  availableCopies: number;
  description: string;
  addedDate: string;
}

export interface TestEquipment {
  id: string;
  name: string;
  type: string;
  brand: string;
  model: string;
  serialNumber: string;
  location: string;
  status: string;
  condition: string;
  purchaseDate: string;
  warrantyExpiry: string;
  description: string;
}

export interface TestUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  createdDate: string;
  lastLogin: string | null;
}

// ========== Test Data Factories ==========

export class TestDataFactory {
  static createValidStudent(): TestStudent {
    return {
      id: `TEST_STUDENT_${Date.now()}`,
      firstName: 'John',
      lastName: 'Doe',
      email: `john.doe.${Date.now()}@test.com`,
      grade: 'GRADE_10',
      studentId: `S${Date.now()}`,
      phone: '555-0123',
      address: '123 Main St, Test City, TC 12345',
      emergencyContact: 'Jane Doe',
      emergencyPhone: '555-0124',
      dateOfBirth: '2008-05-15',
      enrolledDate: '2023-08-15',
      isActive: true
    };
  }

  static createValidBook(): TestBook {
    return {
      id: `TEST_BOOK_${Date.now()}`,
      title: 'The Great Test Book',
      author: 'Test Author',
      isbn: `9780000000000${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      accessionNumber: `ACC${Date.now()}`,
      publisher: 'Test Publishing House',
      publishYear: 2023,
      category: 'Fiction',
      location: 'Main Library - Shelf A',
      status: 'Available',
      totalCopies: 3,
      availableCopies: 3,
      description: 'A comprehensive test book for library management testing.',
      addedDate: new Date().toISOString().split('T')[0]
    };
  }

  static createValidEquipment(): TestEquipment {
    return {
      id: `TEST_EQ_${Date.now()}`,
      name: 'Test Laptop Computer',
      type: 'Computer',
      brand: 'TestBrand',
      model: 'TB-2023',
      serialNumber: `TB${Date.now()}${Math.floor(Math.random() * 1000)}`,
      location: 'Computer Lab - Room 101',
      status: 'Available',
      condition: 'Excellent',
      purchaseDate: '2023-01-15',
      warrantyExpiry: '2025-01-15',
      description: 'High-performance laptop for student use.'
    };
  }

  static createValidUser(role: string): TestUser {
    return {
      id: `TEST_USER_${Date.now()}`,
      username: `test_${role.toLowerCase()}_${Date.now()}`,
      email: `test.${role.toLowerCase()}.${Date.now()}@test.com`,
      firstName: 'Test',
      lastName: `${role} User`,
      role: role,
      isActive: true,
      createdDate: new Date().toISOString().split('T')[0],
      lastLogin: null
    };
  }
}