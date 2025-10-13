import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

interface TestDatabaseConfig {
  databaseUrl: string;
  resetBeforeEachTest: boolean;
  seedTestData: boolean;
}

class TestDatabaseManager {
  private config: TestDatabaseConfig;
  private originalDatabaseUrl: string;
  private testDatabaseName: string;

  constructor(config: TestDatabaseConfig) {
    this.config = config;
    this.originalDatabaseUrl = process.env.DATABASE_URL || '';
    this.testDatabaseName = `clms_test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Setup test database
   */
  async setup(): Promise<void> {
    console.log('Setting up test database...');

    // Create test database URL
    const testDatabaseUrl = this.originalDatabaseUrl.replace(/\/[^\/]+$/, `/${this.testDatabaseName}`);
    process.env.DATABASE_URL = testDatabaseUrl;

    try {
      // Create the test database
      await this.createTestDatabase();

      // Run migrations
      await this.runMigrations();

      // Seed test data if requested
      if (this.config.seedTestData) {
        await this.seedTestData();
      }

      console.log('Test database setup completed');
    } catch (error) {
      console.error('Failed to setup test database:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Reset database to clean state
   */
  async reset(): Promise<void> {
    if (!this.config.resetBeforeEachTest) return;

    console.log('Resetting test database...');

    try {
      // Delete all data in correct order respecting foreign key constraints
      await this.deleteAllData();

      // Re-seed if needed
      if (this.config.seedTestData) {
        await this.seedTestData();
      }

      console.log('Test database reset completed');
    } catch (error) {
      console.error('Failed to reset test database:', error);
      throw error;
    }
  }

  /**
   * Cleanup test database
   */
  async cleanup(): Promise<void> {
    console.log('Cleaning up test database...');

    try {
      // Disconnect Prisma
      await prisma.$disconnect();

      // Drop test database
      await this.dropTestDatabase();

      // Restore original DATABASE_URL
      process.env.DATABASE_URL = this.originalDatabaseUrl;

      console.log('Test database cleanup completed');
    } catch (error) {
      console.error('Failed to cleanup test database:', error);
    }
  }

  /**
   * Create test database
   */
  private async createTestDatabase(): Promise<void> {
    const connectionConfig = this.parseDatabaseUrl(this.originalDatabaseUrl);

    try {
      // Connect to MySQL server without specifying database
      const { Client } = require('mysql2/promise');
      const connection = await Client.createConnection({
        host: connectionConfig.host,
        port: connectionConfig.port,
        user: connectionConfig.user,
        password: connectionConfig.password,
      });

      // Create database
      await connection.execute(`CREATE DATABASE \`${this.testDatabaseName}\``);
      await connection.end();

      console.log(`Created test database: ${this.testDatabaseName}`);
    } catch (error) {
      console.error('Failed to create test database:', error);
      throw error;
    }
  }

  /**
   * Drop test database
   */
  private async dropTestDatabase(): Promise<void> {
    const connectionConfig = this.parseDatabaseUrl(this.originalDatabaseUrl);

    try {
      const { Client } = require('mysql2/promise');
      const connection = await Client.createConnection({
        host: connectionConfig.host,
        port: connectionConfig.port,
        user: connectionConfig.user,
        password: connectionConfig.password,
      });

      await connection.execute(`DROP DATABASE IF EXISTS \`${this.testDatabaseName}\``);
      await connection.end();

      console.log(`Dropped test database: ${this.testDatabaseName}`);
    } catch (error) {
      console.error('Failed to drop test database:', error);
    }
  }

  /**
   * Run Prisma migrations
   */
  private async runMigrations(): Promise<void> {
    try {
      // Generate Prisma client
      execSync('npx prisma generate', { stdio: 'pipe' });

      // Push schema to test database
      execSync('npx prisma db push --skip-generate', {
        stdio: 'pipe',
        cwd: path.join(__dirname, '../..')
      });

      console.log('Database migrations completed');
    } catch (error) {
      console.error('Failed to run migrations:', error);
      throw error;
    }
  }

  /**
   * Delete all data respecting foreign key constraints
   */
  private async deleteAllData(): Promise<void> {
    const tableOrder = [
      'automation_logs',
      'book_checkouts',
      'equipment_sessions',
      'student_activities',
      'barcode_history',
      'notifications',
      'automation_jobs',
      'books',
      'equipment',
      'students',
      'system_config',
      'users',
      'audit_logs'
    ];

    // Use raw SQL to disable foreign key checks temporarily
    await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 0`;

    try {
      for (const table of tableOrder) {
        try {
          await prisma.$executeRawUnsafe(`DELETE FROM \`${table}\``);
          console.log(`Cleared table: ${table}`);
        } catch (error) {
          console.warn(`Failed to clear table ${table}:`, error);
        }
      }
    } finally {
      // Re-enable foreign key checks
      await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 1`;
    }
  }

  /**
   * Seed test data
   */
  private async seedTestData(): Promise<void> {
    try {
      // Create test users with different roles
      await this.createTestUsers();

      // Create test students
      await this.createTestStudents();

      // Create test books
      await this.createTestBooks();

      // Create test equipment
      await this.createTestEquipment();

      console.log('Test data seeded successfully');
    } catch (error) {
      console.error('Failed to seed test data:', error);
      throw error;
    }
  }

  /**
   * Create test users
   */
  private async createTestUsers(): Promise<void> {
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash('testpassword123', 12);

    const users = [
      {
        id: 'user-super-admin',
        username: 'superadmin',
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        isActive: true,
        email: 'superadmin@test.com',
        fullName: 'Super Admin'
      },
      {
        id: 'user-admin',
        username: 'admin',
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
        email: 'admin@test.com',
        fullName: 'Admin User'
      },
      {
        id: 'user-librarian',
        username: 'librarian',
        password: hashedPassword,
        role: 'LIBRARIAN',
        isActive: true,
        email: 'librarian@test.com',
        fullName: 'Librarian User'
      },
      {
        id: 'user-assistant',
        username: 'assistant',
        password: hashedPassword,
        role: 'ASSISTANT',
        isActive: true,
        email: 'assistant@test.com',
        fullName: 'Assistant User'
      },
      {
        id: 'user-viewer',
        username: 'viewer',
        password: hashedPassword,
        role: 'VIEWER',
        isActive: true,
        email: 'viewer@test.com',
        fullName: 'Viewer User'
      }
    ];

    for (const user of users) {
      await prisma.users.create({ data: user });
    }
  }

  /**
   * Create test students
   */
  private async createTestStudents(): Promise<void> {
    const students = [
      {
        id: 'student-001',
        studentId: '2024-001',
        firstName: 'John',
        lastName: 'Doe',
        gradeLevel: 'Grade 10',
        gradeCategory: 'JUNIOR_HIGH',
        section: 'A',
        isActive: true
      },
      {
        id: 'student-002',
        studentId: '2024-002',
        firstName: 'Jane',
        lastName: 'Smith',
        gradeLevel: 'Grade 12',
        gradeCategory: 'SENIOR_HIGH',
        section: 'B',
        isActive: true
      },
      {
        id: 'student-003',
        studentId: '2024-003',
        firstName: 'Mike',
        lastName: 'Johnson',
        gradeLevel: 'Grade 5',
        gradeCategory: 'GRADE_SCHOOL',
        section: 'C',
        isActive: true
      },
      {
        id: 'student-004',
        studentId: '2024-004',
        firstName: 'Sarah',
        lastName: 'Williams',
        gradeLevel: 'Grade 2',
        gradeCategory: 'PRIMARY',
        section: 'A',
        isActive: true
      }
    ];

    for (const student of students) {
      await prisma.students.create({ data: student });
    }
  }

  /**
   * Create test books
   */
  private async createTestBooks(): Promise<void> {
    const books = [
      {
        id: 'book-001',
        accessionNo: 'ACC-001',
        title: 'The Great Gatsby',
        author: 'F. Scott Fitzgerald',
        isbn: '9780743273565',
        publisher: 'Scribner',
        category: 'Fiction',
        subcategory: 'Classic Literature',
        location: 'A1-B2',
        totalCopies: 3,
        availableCopies: 3,
        isActive: true,
        year: 1925,
        pages: '180'
      },
      {
        id: 'book-002',
        accessionNo: 'ACC-002',
        title: 'To Kill a Mockingbird',
        author: 'Harper Lee',
        isbn: '9780061120084',
        publisher: 'J.B. Lippincott & Co.',
        category: 'Fiction',
        subcategory: 'Classic Literature',
        location: 'A1-B3',
        totalCopies: 2,
        availableCopies: 1,
        isActive: true,
        year: 1960,
        pages: '281'
      },
      {
        id: 'book-003',
        accessionNo: 'ACC-003',
        title: '1984',
        author: 'George Orwell',
        isbn: '9780451524935',
        publisher: 'Secker & Warburg',
        category: 'Fiction',
        subcategory: 'Dystopian Fiction',
        location: 'C1-D2',
        totalCopies: 4,
        availableCopies: 2,
        isActive: true,
        year: 1949,
        pages: '328'
      }
    ];

    for (const book of books) {
      await prisma.books.create({ data: book });
    }
  }

  /**
   * Create test equipment
   */
  private async createTestEquipment(): Promise<void> {
    const equipment = [
      {
        id: 'equipment-001',
        equipmentId: 'COMP-001',
        name: 'Computer Station 1',
        type: 'COMPUTER',
        location: 'Lab A',
        maxTimeMinutes: 60,
        requiresSupervision: false,
        description: 'Desktop computer with internet access',
        status: 'AVAILABLE'
      },
      {
        id: 'equipment-002',
        equipmentId: 'GAME-001',
        name: 'Gaming Console 1',
        type: 'GAMING',
        location: 'Game Room',
        maxTimeMinutes: 45,
        requiresSupervision: true,
        description: 'PlayStation 5 with educational games',
        status: 'AVAILABLE'
      },
      {
        id: 'equipment-003',
        equipmentId: 'AVR-001',
        name: 'AVR Equipment Set',
        type: 'AVR',
        location: 'Media Room',
        maxTimeMinutes: 120,
        requiresSupervision: true,
        description: 'Projector, speakers, and microphone set',
        status: 'MAINTENANCE'
      }
    ];

    for (const item of equipment) {
      await prisma.equipment.create({ data: item });
    }
  }

  /**
   * Parse database URL to extract connection parameters
   */
  private parseDatabaseUrl(url: string): any {
    const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (!match) {
      throw new Error('Invalid DATABASE_URL format');
    }

    return {
      user: match[1],
      password: match[2],
      host: match[3],
      port: parseInt(match[4]),
      database: match[5]
    };
  }

  /**
   * Get Prisma client instance
   */
  getPrismaClient(): PrismaClient {
    return prisma;
  }
}

export default TestDatabaseManager;