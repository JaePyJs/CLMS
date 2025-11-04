import { z } from 'zod';
import * as dotenv from 'dotenv';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config();

// Environment schema with strict validation
const envSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().min(1000).max(65535).default(3001),
  HOST: z.string().default('localhost'),
  
  // Database Configuration
  DATABASE_URL: z.string().url('Invalid database URL'),
  
  // JWT Configuration
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT refresh secret must be at least 32 characters'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  
  // CORS Configuration
  FRONTEND_URL: z.string().url().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  
  // File Upload Configuration
  MAX_FILE_SIZE: z.coerce.number().default(10485760), // 10MB
  UPLOAD_PATH: z.string().default('./uploads'),
  
  // Email Configuration (Optional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  
  // Redis Configuration (Optional)
  REDIS_URL: z.string().optional(),
  
  // Logging Configuration
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE: z.string().default('./logs/app.log'),
  
  // Security Configuration
  BCRYPT_ROUNDS: z.coerce.number().min(10).max(15).default(12),
  RATE_LIMIT_WINDOW: z.coerce.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  
  // Feature Flags
  ENABLE_SWAGGER: z.coerce.boolean().default(false),
  ENABLE_METRICS: z.coerce.boolean().default(false),
  ENABLE_CACHE: z.coerce.boolean().default(false),
});

export type EnvConfig = z.infer<typeof envSchema>;

let cachedEnv: EnvConfig | null = null;

export function validateEnv(): EnvConfig {
  if (cachedEnv) {
    return cachedEnv;
  }

  try {
    const parsed = envSchema.parse(process.env);
    cachedEnv = parsed;
    
    // Log configuration (without sensitive data)
    logger.info('Environment configuration loaded:', {
      NODE_ENV: parsed.NODE_ENV,
      PORT: parsed.PORT,
      HOST: parsed.HOST,
      LOG_LEVEL: parsed.LOG_LEVEL,
      ENABLE_SWAGGER: parsed.ENABLE_SWAGGER,
      ENABLE_METRICS: parsed.ENABLE_METRICS,
      ENABLE_CACHE: parsed.ENABLE_CACHE,
    });
    
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map(
        (err) => `${err.path.join('.')}: ${err.message}`
      );
      
      logger.error('Environment validation failed:', {
        errors: errorMessages,
      });
      
      throw new Error(`Environment validation failed:\n${errorMessages.join('\n')}`);
    }
    
    logger.error('Unexpected error during environment validation:', error);
    throw error;
  }
}

// Validate environment on module load
export const env = validateEnv();

// Helper functions for common environment checks
export const isDevelopment = (): boolean => env.NODE_ENV === 'development';
export const isProduction = (): boolean => env.NODE_ENV === 'production';
export const isTest = (): boolean => env.NODE_ENV === 'test';

// Database URL helpers
export const getDatabaseUrl = (): string => {
  if (isTest()) {
    return env.DATABASE_URL.replace(/\/[^/]+$/, '/test_clms');
  }
  return env.DATABASE_URL;
};

// CORS origins helper
export const getAllowedOrigins = (): string[] => {
  if (env.ALLOWED_ORIGINS) {
    return env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
  }
  
  if (isDevelopment()) {
    return ['http://localhost:3000', 'http://localhost:5173'];
  }
  
  return env.FRONTEND_URL ? [env.FRONTEND_URL] : [];
};