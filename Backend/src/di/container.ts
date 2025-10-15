import 'reflect-metadata';
import { Container } from 'inversify';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { logger } from '@/utils/logger';
import {
  AuthService,
  BookService,
  StudentService,
  EquipmentService,
  NotificationService,
  AnalyticsService,
  AutomationService,
  FERPAService
} from '@/services';

// Dependency injection symbols
export const TYPES = {
  // Infrastructure
  DatabaseClient: Symbol.for('DatabaseClient'),
  RedisClient: Symbol.for('RedisClient'),
  Logger: Symbol.for('Logger'),

  // Services
  AuthService: Symbol.for('AuthService'),
  BookService: Symbol.for('BookService'),
  StudentService: Symbol.for('StudentService'),
  EquipmentService: Symbol.for('EquipmentService'),
  NotificationService: Symbol.for('NotificationService'),
  AnalyticsService: Symbol.for('AnalyticsService'),
  AutomationService: Symbol.for('AutomationService'),
  FERPAService: Symbol.for('FERPAService'),

  // Repositories (if implementing repository pattern)
  BookRepository: Symbol.for('BookRepository'),
  StudentRepository: Symbol.for('StudentRepository'),
  EquipmentRepository: Symbol.for('EquipmentRepository'),
  UserRepository: Symbol.for('UserRepository'),
};

// Create and configure the DI container
export const diContainer = new Container();

// Database client factory
function createDatabaseClient(): PrismaClient {
  const client = new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'event' },
      { level: 'info', emit: 'event' },
      { level: 'warn', emit: 'event' },
    ],
  });

  // Log database events
  client.$on('query', (e) => {
    logger.debug('Database Query', {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
    });
  });

  client.$on('error', (e) => {
    logger.error('Database Error', e);
  });

  return client;
}

// Redis client factory
function createRedisClient(): Redis {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
  });

  redis.on('connect', () => {
    logger.info('Redis client connected');
  });

  redis.on('error', (err) => {
    logger.error('Redis connection error', err);
  });

  return redis;
}

// Bind dependencies
diContainer.bind<PrismaClient>(TYPES.DatabaseClient).toDynamicValue(createDatabaseClient).inSingletonScope();
diContainer.bind<Redis>(TYPES.RedisClient).toDynamicValue(createRedisClient).inSingletonScope();
diContainer.bind<typeof logger>(TYPES.Logger).toConstantValue(logger);

// Service bindings
diContainer.bind<AuthService>(TYPES.AuthService).to(AuthService).inSingletonScope();
diContainer.bind<BookService>(TYPES.BookService).to(BookService).inSingletonScope();
diContainer.bind<StudentService>(TYPES.StudentService).to(StudentService).inSingletonScope();
diContainer.bind<EquipmentService>(TYPES.EquipmentService).to(EquipmentService).inSingletonScope();
diContainer.bind<NotificationService>(TYPES.NotificationService).to(NotificationService).inSingletonScope();
diContainer.bind<AnalyticsService>(TYPES.AnalyticsService).to(AnalyticsService).inSingletonScope();
diContainer.bind<AutomationService>(TYPES.AutomationService).to(AutomationService).inSingletonScope();
diContainer.bind<FERPAService>(TYPES.FERPAService).to(FERPAService).inSingletonScope();

// Health check for DI container
export function initializeDIContainer(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Test database connection
      const db = diContainer.get<PrismaClient>(TYPES.DatabaseClient);
      db.$connect()
        .then(() => {
          logger.info('Dependency injection container initialized successfully');
          resolve();
        })
        .catch((error) => {
          logger.error('Failed to connect to database during DI initialization', error);
          reject(error);
        });
    } catch (error) {
      logger.error('Failed to initialize DI container', error);
      reject(error);
    }
  });
}

// Graceful shutdown
export async function shutdownDIContainer(): Promise<void> {
  try {
    const db = diContainer.get<PrismaClient>(TYPES.DatabaseClient);
    const redis = diContainer.get<Redis>(TYPES.RedisClient);

    await Promise.all([
      db.$disconnect(),
      redis.quit(),
    ]);

    logger.info('Dependency injection container shutdown successfully');
  } catch (error) {
    logger.error('Error during DI container shutdown', error);
  }
}

// Get service helper function for use in routes
export function getService<T>(serviceIdentifier: symbol): T {
  return diContainer.get<T>(serviceIdentifier);
}