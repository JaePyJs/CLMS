import * as dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

type EnvConfig = {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  HOST: string;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRES_IN: string;
  FRONTEND_URL?: string;
  ALLOWED_ORIGINS?: string;
  MAX_FILE_SIZE: number;
  UPLOAD_PATH: string;
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  REDIS_URL?: string;
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';
  LOG_FILE: string;
  BCRYPT_ROUNDS: number;
  RATE_LIMIT_WINDOW: number;
  RATE_LIMIT_MAX: number;
  ENABLE_SWAGGER: boolean;
  ENABLE_METRICS: boolean;
  ENABLE_CACHE: boolean;
  WS_DEV_BYPASS: boolean;
  DEFAULT_LIBRARIAN_PASSWORD?: string;
};

let cachedEnv: EnvConfig | null = null;

export function loadEnv(): EnvConfig {
  if (cachedEnv) {
    return cachedEnv;
  }

  const NODE_ENV =
    (process.env.NODE_ENV as EnvConfig['NODE_ENV']) || 'development';
  const PORT = Number(process.env.PORT || 3001);
  const HOST = process.env.HOST || 'localhost';
  const DATABASE_URL = process.env.DATABASE_URL || '';
  const JWT_SECRET = process.env.JWT_SECRET || '';
  const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET;
  const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
  const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
  const FRONTEND_URL = process.env.FRONTEND_URL;
  const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS;
  const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE || 10485760);
  const UPLOAD_PATH = process.env.UPLOAD_PATH || './uploads';
  const SMTP_HOST = process.env.SMTP_HOST;
  const SMTP_PORT = process.env.SMTP_PORT
    ? Number(process.env.SMTP_PORT)
    : undefined;
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS;
  const REDIS_URL = process.env.REDIS_URL;
  const LOG_LEVEL = (process.env.LOG_LEVEL as EnvConfig['LOG_LEVEL']) || 'info';
  const LOG_FILE = process.env.LOG_FILE || './logs/app.log';
  const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);
  const RATE_LIMIT_WINDOW = Number(process.env.RATE_LIMIT_WINDOW || 900000);
  const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 1000);
  const ENABLE_SWAGGER =
    String(process.env.ENABLE_SWAGGER || 'false') === 'true';
  const ENABLE_METRICS =
    String(process.env.ENABLE_METRICS || 'false') === 'true';
  const ENABLE_CACHE = String(process.env.ENABLE_CACHE || 'false') === 'true';
  const WS_DEV_BYPASS = String(process.env.WS_DEV_BYPASS || 'true') === 'true';
  const DEFAULT_LIBRARIAN_PASSWORD = process.env.DEFAULT_LIBRARIAN_PASSWORD;

  const config: EnvConfig = {
    NODE_ENV,
    PORT,
    HOST,
    DATABASE_URL,
    JWT_SECRET,
    JWT_EXPIRES_IN,
    JWT_REFRESH_SECRET,
    JWT_REFRESH_EXPIRES_IN,
    FRONTEND_URL,
    ALLOWED_ORIGINS,
    MAX_FILE_SIZE,
    UPLOAD_PATH,
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    REDIS_URL,
    LOG_LEVEL,
    LOG_FILE,
    BCRYPT_ROUNDS,
    RATE_LIMIT_WINDOW,
    RATE_LIMIT_MAX,
    ENABLE_SWAGGER,
    ENABLE_METRICS,
    ENABLE_CACHE,
    WS_DEV_BYPASS,
    DEFAULT_LIBRARIAN_PASSWORD,
  };

  if (!DATABASE_URL || !JWT_SECRET) {
    const missing = [];
    if (!DATABASE_URL) {
      missing.push('DATABASE_URL');
    }
    if (!JWT_SECRET) {
      missing.push('JWT_SECRET');
    }

    if (NODE_ENV === 'production') {
      throw new Error(
        `Missing critical environment variables in production: ${missing.join(', ')}`,
      );
    } else {
      logger.warn(
        `Missing critical environment variables: ${missing.join(', ')}`,
      );
    }
  }

  logger.info('Environment configuration loaded', {
    NODE_ENV: config.NODE_ENV,
    PORT: config.PORT,
    HOST: config.HOST,
    LOG_LEVEL: config.LOG_LEVEL,
    ENABLE_SWAGGER: config.ENABLE_SWAGGER,
    ENABLE_METRICS: config.ENABLE_METRICS,
    ENABLE_CACHE: config.ENABLE_CACHE,
    WS_DEV_BYPASS: config.WS_DEV_BYPASS,
    DEFAULT_LIBRARIAN_PASSWORD: config.DEFAULT_LIBRARIAN_PASSWORD
      ? '[configured]'
      : '[default lib123]',
  });

  cachedEnv = config;
  return config;
}

export const env = loadEnv();

export const isDevelopment = (): boolean => env.NODE_ENV === 'development';
export const isProduction = (): boolean => env.NODE_ENV === 'production';
export const isTest = (): boolean => env.NODE_ENV === 'test';

export const getDatabaseUrl = (): string => {
  if (isTest() && env.DATABASE_URL) {
    return env.DATABASE_URL.replace(/\/[^/]+$/, '/test_clms');
  }
  return env.DATABASE_URL;
};

export const getAllowedOrigins = (): string[] => {
  if (env.ALLOWED_ORIGINS) {
    return env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
  }
  if (isDevelopment()) {
    return ['http://localhost:3000', 'http://localhost:5173'];
  }
  return env.FRONTEND_URL ? [env.FRONTEND_URL] : [];
};
