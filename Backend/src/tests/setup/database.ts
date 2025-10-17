/**
 * Test Database Configuration
 * 
 * Provides comprehensive test-specific database configurations with isolation,
 * setup/teardown utilities, and support for different test environment types.
 * 
 * Features:
 * - Isolated test databases for different test suites
 * - Connection pooling for test efficiency
 * - Support for both in-memory (SQLite) and PostgreSQL test databases
 * - Automatic database migration before tests
 * - Data seeding utilities using mock factories
 * - Cleanup mechanisms for test isolation
 * - Transaction wrappers for automatic rollback
 * - Database health checks for test environments
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { faker } from '@faker-js/faker';
import { factories } from '../factories';

// Test environment types
export enum TestEnvironmentType {
  UNIT = 'unit',
  INTEGRATION = 'integration',
  E2E = 'e2e',
  PERFORMANCE = 'performance'
}

// Database provider types
export enum DatabaseProvider {
  MYSQL = 'mysql',
  POSTGRESQL = 'postgresql',
  SQLITE = 'sqlite'
}

// Database configuration interface
export interface TestDatabaseConfig {
  environmentType: TestEnvironmentType;
  provider: DatabaseProvider;
  databaseUrl?: string;
  resetBeforeEachTest: boolean;
  seedTestData: boolean;
  useTransactions: boolean;
  connectionPoolSize: number;
  migrationTimeout: number;
  healthCheckInterval: number;
  enablePerformanceMonitoring: boolean;
}

// Database health status
export interface DatabaseHealthStatus {
  isHealthy: boolean;
  responseTime: number;
  error?: string;
  lastChecked: Date;
  connectionCount: number;
  queryCount: number;
}

// Test database statistics
export interface TestDatabaseStats {
  totalTests: number;
  setupTime: number;
  teardownTime: number;
  averageQueryTime: number;
  totalQueries: number;
  errors: number;
  migrationsRun: number;
  dataSeeded: number;
}

/**
 * Main Test Database Class
 * 
 * Handles all database operations for testing including setup, teardown,
 * migrations, seeding, and health monitoring.
 */
export class TestDatabase {
  private config: TestDatabaseConfig;
  private originalDatabaseUrl: string;
  private testDatabaseName: string;
  private prisma: PrismaClient | null = null;
  private isSetup = false;
  private healthStatus: DatabaseHealthStatus;
  private stats: TestDatabaseStats;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private connectionPool: PrismaClient[] = [];
  private activeTransactions: PrismaClient[] = [];

  constructor(config: Partial<TestDatabaseConfig> = {}) {
    this.config = {
      environmentType: TestEnvironmentType.UNIT,
      provider: DatabaseProvider.MYSQL,
      resetBeforeEachTest: true,
      seedTestData: false,
      useTransactions: true,
      connectionPoolSize: 5,
      migrationTimeout: 30000,
      healthCheckInterval: 5000,
      enablePerformanceMonitoring: false,
      ...config
    };

    this.originalDatabaseUrl = process.env.DATABASE_URL || '';
    this.testDatabaseName = this.generateTestDatabaseName();
    
    this.healthStatus = {
      isHealthy: false,
      responseTime: 0,
      lastChecked: new Date(),
      connectionCount: 0,
      queryCount: 0
    };

    this.stats = {
      totalTests: 0,
      setupTime: 0,
      teardownTime: 0,
      averageQueryTime: 0,
      totalQueries: 0,
      errors: 0,
      migrationsRun: 0,
      dataSeeded: 0
    };
  }

  /**
   * Generate unique test database name
   */
  private generateTestDatabaseName(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const env = this.config.environmentType.toUpperCase();
    return `clms_test_${env}_${timestamp}_${random}`;
  }

  /**
   * Setup test database with isolation
   */
  async setup(): Promise<void> {
    if (this.isSetup) {
      console.warn('Test database is already set up');
      return;
    }

    const startTime = Date.now();
    console.log(`🗄️  Setting up ${this.config.environmentType} test database: ${this.testDatabaseName}`);

    try {
      // Create test database URL
      const testDatabaseUrl = this.buildTestDatabaseUrl();
      process.env.DATABASE_URL = testDatabaseUrl;

      // Create the test database
      await this.createTestDatabase();

      // Initialize Prisma client
      this.prisma = this.createPrismaClient();

      // Run migrations
      await this.runMigrations();

      // Setup connection pool if needed
      if (this.config.connectionPoolSize > 1) {
        await this.setupConnectionPool();
      }

      // Seed test data if requested
      if (this.config.seedTestData) {
        await this.seedTestData();
      }

      // Start health monitoring
      if (this.config.healthCheckInterval > 0) {
        this.startHealthMonitoring();
      }

      this.isSetup = true;
      this.stats.setupTime = Date.now() - startTime;
      
      console.log(`✅ Test database setup completed in ${this.stats.setupTime}ms`);
    } catch (error) {
      this.stats.errors++;
      console.error('❌ Failed to setup test database:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Reset database to clean state
   */
  async reset(): Promise<void> {
    if (!this.isSetup || !this.prisma) {
      console.warn('Test database is not set up');
      return;
    }

    if (!this.config.resetBeforeEachTest) {
      return;
    }

    console.log('🔄 Resetting test database...');

    try {
      // Rollback all active transactions
      await this.rollbackAllTransactions();

      // Delete all data respecting foreign key constraints
      await this.deleteAllData();

      // Re-seed if needed
      if (this.config.seedTestData) {
        await this.seedTestData();
      }

      console.log('✅ Test database reset completed');
    } catch (error) {
      this.stats.errors++;
      console.error('❌ Failed to reset test database:', error);
      throw error;
    }
  }

  /**
   * Cleanup test database and connections
   */
  async cleanup(): Promise<void> {
    if (!this.isSetup) {
      return;
    }

    const startTime = Date.now();
    console.log('🧹 Cleaning up test database...');

    try {
      // Stop health monitoring
      this.stopHealthMonitoring();

      // Rollback all active transactions
      await this.rollbackAllTransactions();

      // Disconnect all connection pool clients
      await this.disconnectConnectionPool();

      // Disconnect main Prisma client
      if (this.prisma) {
        await this.prisma.$disconnect();
        this.prisma = null;
      }

      // Drop test database
      await this.dropTestDatabase();

      // Restore original DATABASE_URL
      process.env.DATABASE_URL = this.originalDatabaseUrl;

      this.isSetup = false;
      this.stats.teardownTime = Date.now() - startTime;
      
      console.log(`✅ Test database cleanup completed in ${this.stats.teardownTime}ms`);
    } catch (error) {
      this.stats.errors++;
      console.error('❌ Failed to cleanup test database:', error);
    }
  }

  /**
   * Build test database URL based on provider
   */
  private buildTestDatabaseUrl(): string {
    if (this.config.databaseUrl) {
      return this.config.databaseUrl.replace(/\/[^\/]+$/, `/${this.testDatabaseName}`);
    }

    switch (this.config.provider) {
      case DatabaseProvider.MYSQL:
        return this.originalDatabaseUrl.replace(/\/[^\/]+$/, `/${this.testDatabaseName}`);
      
      case DatabaseProvider.POSTGRESQL:
        const pgUrl = this.originalDatabaseUrl.replace(/\/[^\/]+$/, `/${this.testDatabaseName}`);
        return pgUrl.includes('postgresql://') ? pgUrl : pgUrl.replace('mysql://', 'postgresql://');
      
      case DatabaseProvider.SQLITE:
        return `file:${path.join(process.cwd(), 'test-databases', `${this.testDatabaseName}.db`)}`;
      
      default:
        throw new Error(`Unsupported database provider: ${this.config.provider}`);
    }
  }

  /**
   * Create test database
   */
  private async createTestDatabase(): Promise<void> {
    const connectionConfig = this.parseDatabaseUrl(this.originalDatabaseUrl);

    try {
      switch (this.config.provider) {
        case DatabaseProvider.MYSQL:
          await this.createMySQLDatabase(connectionConfig);
          break;
        case DatabaseProvider.POSTGRESQL:
          await this.createPostgreSQLDatabase(connectionConfig);
          break;
        case DatabaseProvider.SQLITE:
          await this.createSQLiteDatabase();
          break;
      }

      console.log(`📊 Created test database: ${this.testDatabaseName}`);
    } catch (error) {
      console.error('❌ Failed to create test database:', error);
      throw error;
    }
  }

  /**
   * Create MySQL database
   */
  private async createMySQLDatabase(config: any): Promise<void> {
    const { Client } = require('mysql2/promise');
    const connection = await Client.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
    });

    await connection.execute(`CREATE DATABASE \`${this.testDatabaseName}\``);
    await connection.end();
  }

  /**
   * Create PostgreSQL database
   */
  private async createPostgreSQLDatabase(config: any): Promise<void> {
    const { Client } = require('pg');
    const client = new Client({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: 'postgres' // Connect to default database first
    });

    await client.connect();
    await client.query(`CREATE DATABASE "${this.testDatabaseName}"`);
    await client.end();
  }

  /**
   * Create SQLite database (create directory and file)
   */
  private async createSQLiteDatabase(): Promise<void> {
    const dbPath = path.join(process.cwd(), 'test-databases');
    await fs.mkdir(dbPath, { recursive: true });
    // SQLite database is created automatically when Prisma connects
  }

  /**
   * Drop test database
   */
  private async dropTestDatabase(): Promise<void> {
    const connectionConfig = this.parseDatabaseUrl(this.originalDatabaseUrl);

    try {
      switch (this.config.provider) {
        case DatabaseProvider.MYSQL:
          await this.dropMySQLDatabase(connectionConfig);
          break;
        case DatabaseProvider.POSTGRESQL:
          await this.dropPostgreSQLDatabase(connectionConfig);
          break;
        case DatabaseProvider.SQLITE:
          await this.dropSQLiteDatabase();
          break;
      }

      console.log(`🗑️  Dropped test database: ${this.testDatabaseName}`);
    } catch (error) {
      console.error('❌ Failed to drop test database:', error);
    }
  }

  /**
   * Drop MySQL database
   */
  private async dropMySQLDatabase(config: any): Promise<void> {
    const { Client } = require('mysql2/promise');
    const connection = await Client.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
    });

    await connection.execute(`DROP DATABASE IF EXISTS \`${this.testDatabaseName}\``);
    await connection.end();
  }

  /**
   * Drop PostgreSQL database
   */
  private async dropPostgreSQLDatabase(config: any): Promise<void> {
    const { Client } = require('pg');
    const client = new Client({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: 'postgres'
    });

    await client.connect();
    
    // Kill connections to the database first
    await client.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = '${this.testDatabaseName}'
        AND pid <> pg_backend_pid()
    `);
    
    await client.query(`DROP DATABASE IF EXISTS "${this.testDatabaseName}"`);
    await client.end();
  }

  /**
   * Drop SQLite database
   */
  private async dropSQLiteDatabase(): Promise<void> {
    const dbPath = path.join(process.cwd(), 'test-databases', `${this.testDatabaseName}.db`);
    try {
      await fs.unlink(dbPath);
    } catch (error) {
      // File might not exist, which is fine
    }
  }

  /**
   * Create Prisma client with test configuration
   */
  private createPrismaClient(): PrismaClient {
    const logLevel = this.config.enablePerformanceMonitoring ? ['query', 'error', 'warn'] : ['error'];
    
    return new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      },
      log: logLevel,
      errorFormat: 'minimal'
    });
  }

  /**
   * Setup connection pool for better performance
   */
  private async setupConnectionPool(): Promise<void> {
    for (let i = 0; i < this.config.connectionPoolSize - 1; i++) {
      const client = this.createPrismaClient();
      await client.$connect();
      this.connectionPool.push(client);
    }
    
    console.log(`🔗 Created connection pool with ${this.config.connectionPoolSize} clients`);
  }

  /**
   * Disconnect all connection pool clients
   */
  private async disconnectConnectionPool(): Promise<void> {
    for (const client of this.connectionPool) {
      await client.$disconnect();
    }
    this.connectionPool = [];
  }

  /**
   * Run Prisma migrations
   */
  private async runMigrations(): Promise<void> {
    const startTime = Date.now();
    console.log('🔄 Running database migrations...');

    try {
      // Generate Prisma client
      execSync('npx prisma generate', { 
        stdio: 'pipe',
        timeout: this.config.migrationTimeout
      });

      // Push schema to test database
      execSync('npx prisma db push --skip-generate', {
        stdio: 'pipe',
        cwd: path.join(__dirname, '../..'),
        timeout: this.config.migrationTimeout
      });

      this.stats.migrationsRun++;
      const duration = Date.now() - startTime;
      console.log(`✅ Database migrations completed in ${duration}ms`);
    } catch (error) {
      console.error('❌ Failed to run migrations:', error);
      throw error;
    }
  }

  /**
   * Delete all data respecting foreign key constraints
   */
  private async deleteAllData(): Promise<void> {
    if (!this.prisma) return;

    const tableOrder = [
      'automation_logs',
      'book_checkouts',
      'equipment_sessions',
      'student_activities',
      'barcode_history',
      'notifications',
      'equipment_condition_reports',
      'equipment_maintenance',
      'equipment_reports',
      'equipment_reservations',
      'equipment_usage_stats',
      'automation_jobs',
      'books',
      'equipment',
      'students',
      'system_config',
      'users',
      'audit_logs'
    ];

    try {
      if (this.config.provider === DatabaseProvider.MYSQL) {
        await this.prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 0`;
      } else if (this.config.provider === DatabaseProvider.POSTGRESQL) {
        await this.prisma.$executeRaw`SET session_replication_role = replica`;
      }

      for (const table of tableOrder) {
        try {
          await this.prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
        } catch (error) {
          console.warn(`⚠️  Failed to clear table ${table}:`, error);
        }
      }

      if (this.config.provider === DatabaseProvider.MYSQL) {
        await this.prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 1`;
      } else if (this.config.provider === DatabaseProvider.POSTGRESQL) {
        await this.prisma.$executeRaw`SET session_replication_role = DEFAULT`;
      }
    } catch (error) {
      console.error('❌ Failed to delete all data:', error);
      throw error;
    }
  }

  /**
   * Seed test data using factories
   */
  private async seedTestData(): Promise<void> {
    if (!this.prisma) return;

    console.log('🌱 Seeding test data...');
    const startTime = Date.now();

    try {
      // Reset factory counters
      factories.resetAll();

      // Create test data based on environment type
      switch (this.config.environmentType) {
        case TestEnvironmentType.UNIT:
          await this.seedUnitTestData();
          break;
        case TestEnvironmentType.INTEGRATION:
          await this.seedIntegrationTestData();
          break;
        case TestEnvironmentType.E2E:
          await this.seedE2ETestData();
          break;
        case TestEnvironmentType.PERFORMANCE:
          await this.seedPerformanceTestData();
          break;
      }

      this.stats.dataSeeded++;
      const duration = Date.now() - startTime;
      console.log(`✅ Test data seeded in ${duration}ms`);
    } catch (error) {
      console.error('❌ Failed to seed test data:', error);
      throw error;
    }
  }

  /**
   * Seed data for unit tests (minimal)
   */
  private async seedUnitTestData(): Promise<void> {
    if (!this.prisma) return;

    // Create minimal test data
    const user = await factories.users.createLibrarian();
    const student = factories.students.create();
    const book = factories.books.create();

    // Save to database
    await this.prisma.users.create({ data: user });
    await this.prisma.students.create({ data: student });
    await this.prisma.books.create({ data: book });
  }

  /**
   * Seed data for integration tests (moderate)
   */
  private async seedIntegrationTestData(): Promise<void> {
    if (!this.prisma) return;

    // Create comprehensive test dataset
    const dataset = await factories.createQuickDataset();

    // Save all data
    await this.prisma.users.createMany({ data: dataset.users });
    await this.prisma.students.createMany({ data: dataset.students });
    await this.prisma.books.createMany({ data: dataset.books });
    await this.prisma.equipment.createMany({ data: dataset.equipment });
  }

  /**
   * Seed data for E2E tests (realistic)
   */
  private async seedE2ETestData(): Promise<void> {
    if (!this.prisma) return;

    // Create realistic test ecosystem
    const ecosystem = await factories.relationships.createCompleteEcosystem({
      studentCount: 50,
      bookCount: 100,
      equipmentCount: 25,
      userCount: 8,
      checkoutCount: 75
    });

    // Save all data in correct order
    await this.prisma.users.createMany({ data: ecosystem.users });
    await this.prisma.students.createMany({ data: ecosystem.students });
    await this.prisma.books.createMany({ data: ecosystem.books });
    await this.prisma.equipment.createMany({ data: ecosystem.equipment });
    await this.prisma.student_activities.createMany({ data: ecosystem.activities });
  }

  /**
   * Seed data for performance tests (large dataset)
   */
  private async seedPerformanceTestData(): Promise<void> {
    if (!this.prisma) return;

    // Create large dataset for performance testing
    const performanceData = factories.createPerformanceTestData('large');

    // Save all data
    await this.prisma.users.createMany({ data: performanceData.users });
    await this.prisma.students.createMany({ data: performanceData.students });
    await this.prisma.books.createMany({ data: performanceData.books });
    await this.prisma.equipment.createMany({ data: performanceData.equipment });
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Perform database health check
   */
  private async performHealthCheck(): Promise<void> {
    if (!this.prisma) return;

    const startTime = Date.now();

    try {
      // Simple query to test connection
      await this.prisma.$queryRaw`SELECT 1`;
      
      this.healthStatus.isHealthy = true;
      this.healthStatus.responseTime = Date.now() - startTime;
      this.healthStatus.lastChecked = new Date();
    } catch (error) {
      this.healthStatus.isHealthy = false;
      this.healthStatus.responseTime = Date.now() - startTime;
      this.healthStatus.error = error instanceof Error ? error.message : 'Unknown error';
      this.healthStatus.lastChecked = new Date();
      
      console.error('❌ Database health check failed:', error);
    }
  }

  /**
   * Execute operation within transaction
   */
  async withTransaction<T>(
    operation: (prisma: PrismaClient) => Promise<T>,
    autoRollback: boolean = this.config.useTransactions
  ): Promise<T> {
    if (!this.prisma) {
      throw new Error('Test database is not set up');
    }

    if (!autoRollback) {
      return operation(this.prisma);
    }

    const transactionPrisma = await this.prisma.$begin();
    this.activeTransactions.push(transactionPrisma);

    try {
      const result = await operation(transactionPrisma);
      await transactionPrisma.$rollback(); // Always rollback for test isolation
      return result;
    } catch (error) {
      await transactionPrisma.$rollback();
      throw error;
    } finally {
      const index = this.activeTransactions.indexOf(transactionPrisma);
      if (index > -1) {
        this.activeTransactions.splice(index, 1);
      }
    }
  }

  /**
   * Rollback all active transactions
   */
  private async rollbackAllTransactions(): Promise<void> {
    for (const transactionPrisma of this.activeTransactions) {
      try {
        await transactionPrisma.$rollback();
        await transactionPrisma.$disconnect();
      } catch (error) {
        console.warn('⚠️  Failed to rollback transaction:', error);
      }
    }
    this.activeTransactions = [];
  }

  /**
   * Parse database URL to extract connection parameters
   */
  private parseDatabaseUrl(url: string): any {
    if (url.includes('mysql://')) {
      const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
      if (!match) {
        throw new Error('Invalid MySQL DATABASE_URL format');
      }
      return {
        user: match[1],
        password: match[2],
        host: match[3],
        port: parseInt(match[4]),
        database: match[5]
      };
    } else if (url.includes('postgresql://')) {
      const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
      if (!match) {
        throw new Error('Invalid PostgreSQL DATABASE_URL format');
      }
      return {
        user: match[1],
        password: match[2],
        host: match[3],
        port: parseInt(match[4]),
        database: match[5]
      };
    } else if (url.includes('file:')) {
      return { path: url.replace('file:', '') };
    }

    throw new Error('Unsupported DATABASE_URL format');
  }

  /**
   * Get Prisma client instance
   */
  getPrismaClient(): PrismaClient {
    if (!this.prisma) {
      throw new Error('Test database is not set up');
    }
    return this.prisma;
  }

  /**
   * Get pooled Prisma client
   */
  getPooledClient(): PrismaClient {
    if (this.connectionPool.length === 0) {
      return this.getPrismaClient();
    }
    return this.connectionPool[Math.floor(Math.random() * this.connectionPool.length)];
  }

  /**
   * Get database health status
   */
  getHealthStatus(): DatabaseHealthStatus {
    return { ...this.healthStatus };
  }

  /**
   * Get test database statistics
   */
  getStats(): TestDatabaseStats {
    return { ...this.stats };
  }

  /**
   * Update statistics
   */
  updateStats(queryTime: number): void {
    this.stats.totalQueries++;
    this.stats.averageQueryTime = 
      (this.stats.averageQueryTime * (this.stats.totalQueries - 1) + queryTime) / 
      this.stats.totalQueries;
  }

  /**
   * Increment error count
   */
  incrementErrorCount(): void {
    this.stats.errors++;
  }

  /**
   * Check if database is ready
   */
  async isReady(): Promise<boolean> {
    await this.performHealthCheck();
    return this.healthStatus.isHealthy;
  }

  /**
   * Wait for database to be ready
   */
  async waitForReady(timeout: number = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await this.isReady()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Database not ready after ${timeout}ms`);
  }
}

/**
 * Test Database Manager
 * 
 * Manages multiple test database instances for different test environments
 */
export class TestDatabaseManager {
  private static instances: Map<string, TestDatabase> = new Map();

  /**
   * Get or create test database instance
   */
  static getInstance(
    name: string,
    config?: Partial<TestDatabaseConfig>
  ): TestDatabase {
    if (!this.instances.has(name)) {
      this.instances.set(name, new TestDatabase(config));
    }
    return this.instances.get(name)!;
  }

  /**
   * Setup all test databases
   */
  static async setupAll(): Promise<void> {
    for (const [name, database] of this.instances) {
      console.log(`Setting up test database: ${name}`);
      await database.setup();
    }
  }

  /**
   * Cleanup all test databases
   */
  static async cleanupAll(): Promise<void> {
    for (const [name, database] of this.instances) {
      console.log(`Cleaning up test database: ${name}`);
      await database.cleanup();
    }
    this.instances.clear();
  }

  /**
   * Reset all test databases
   */
  static async resetAll(): Promise<void> {
    for (const [name, database] of this.instances) {
      console.log(`Resetting test database: ${name}`);
      await database.reset();
    }
  }

  /**
   * Get all database statistics
   */
  static getAllStats(): Record<string, TestDatabaseStats> {
    const stats: Record<string, TestDatabaseStats> = {};
    for (const [name, database] of this.instances) {
      stats[name] = database.getStats();
    }
    return stats;
  }

  /**
   * Get all health statuses
   */
  static getAllHealthStatuses(): Record<string, DatabaseHealthStatus> {
    const statuses: Record<string, DatabaseHealthStatus> = {};
    for (const [name, database] of this.instances) {
      statuses[name] = database.getHealthStatus();
    }
    return statuses;
  }
}

/**
 * Pre-configured database configurations for different test types
 */
export const TestDatabaseConfigs = {
  /**
   * Unit test configuration - in-memory, minimal setup
   */
  unit: {
    environmentType: TestEnvironmentType.UNIT,
    provider: DatabaseProvider.SQLITE,
    resetBeforeEachTest: true,
    seedTestData: true,
    useTransactions: true,
    connectionPoolSize: 1,
    migrationTimeout: 10000,
    healthCheckInterval: 0, // Disabled for unit tests
    enablePerformanceMonitoring: false
  } as TestDatabaseConfig,

  /**
   * Integration test configuration - MySQL with test schema
   */
  integration: {
    environmentType: TestEnvironmentType.INTEGRATION,
    provider: DatabaseProvider.MYSQL,
    resetBeforeEachTest: true,
    seedTestData: true,
    useTransactions: true,
    connectionPoolSize: 3,
    migrationTimeout: 30000,
    healthCheckInterval: 10000,
    enablePerformanceMonitoring: true
  } as TestDatabaseConfig,

  /**
   * E2E test configuration - full database with realistic data
   */
  e2e: {
    environmentType: TestEnvironmentType.E2E,
    provider: DatabaseProvider.MYSQL,
    resetBeforeEachTest: false, // Maintain state across tests
    seedTestData: true,
    useTransactions: false, // Don't use transactions for E2E
    connectionPoolSize: 5,
    migrationTimeout: 60000,
    healthCheckInterval: 15000,
    enablePerformanceMonitoring: true
  } as TestDatabaseConfig,

  /**
   * Performance test configuration - optimized for large datasets
   */
  performance: {
    environmentType: TestEnvironmentType.PERFORMANCE,
    provider: DatabaseProvider.MYSQL,
    resetBeforeEachTest: false,
    seedTestData: true,
    useTransactions: false,
    connectionPoolSize: 10,
    migrationTimeout: 120000,
    healthCheckInterval: 30000,
    enablePerformanceMonitoring: true
  } as TestDatabaseConfig
};

/**
 * Utility functions for common test database operations
 */
export const TestDatabaseUtils = {
  /**
   * Create a test database with default configuration
   */
  async create(type: TestEnvironmentType = TestEnvironmentType.UNIT): Promise<TestDatabase> {
    const config = TestDatabaseConfigs[type];
    const database = new TestDatabase(config);
    await database.setup();
    return database;
  },

  /**
   * Execute operation with automatic cleanup
   */
  async withDatabase<T>(
    type: TestEnvironmentType,
    operation: (database: TestDatabase) => Promise<T>
  ): Promise<T> {
    const database = await this.create(type);
    try {
      return await operation(database);
    } finally {
      await database.cleanup();
    }
  },

  /**
   * Execute operation within transaction
   */
  async withTransaction<T>(
    database: TestDatabase,
    operation: (prisma: PrismaClient) => Promise<T>
  ): Promise<T> {
    return await database.withTransaction(operation);
  },

  /**
   * Create multiple test databases for parallel testing
   */
  async createMultiple(
    type: TestEnvironmentType,
    count: number
  ): Promise<TestDatabase[]> {
    const databases: TestDatabase[] = [];
    const config = TestDatabaseConfigs[type];
    
    for (let i = 0; i < count; i++) {
      const dbConfig = {
        ...config,
        databaseUrl: config.databaseUrl ? `${config.databaseUrl}_${i}` : undefined
      };
      const database = new TestDatabase(dbConfig);
      await database.setup();
      databases.push(database);
    }
    
    return databases;
  }
};

// Export default instance for convenience
export default TestDatabase;