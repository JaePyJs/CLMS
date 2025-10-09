const mysql = require('mysql2/promise')
const winston = require('winston')

// Logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
})

// Database connections
let clmsConnection = null
let kohaConnection = null

// CLMS Database configuration
const clmsConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'clms_user',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'clms_database',
  charset: 'utf8mb4',
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  connectionLimit: 10
}

// Koha Database configuration (Read-only)
const kohaConfig = {
  host: process.env.KOHA_DB_HOST || 'localhost',
  port: process.env.KOHA_DB_PORT || 3306,
  user: process.env.KOHA_DB_USER || 'koha_user',
  password: process.env.KOHA_DB_PASSWORD || '',
  database: process.env.KOHA_DB_NAME || 'koha_database',
  charset: 'utf8mb4',
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  connectionLimit: 5
}

// Create database connection pool
async function createConnectionPool(config, databaseName) {
  try {
    const pool = mysql.createPool(config)

    // Test connection
    const connection = await pool.getConnection()
    await connection.ping()
    connection.release()

    logger.info(`✅ ${databaseName} database connection pool created successfully`)
    return pool
  } catch (error) {
    logger.error(`❌ Failed to connect to ${databaseName} database:`, error)
    throw error
  }
}

// Initialize database connections
async function connectDatabases() {
  try {
    // Connect to CLMS database
    clmsConnection = await createConnectionPool(clmsConfig, 'CLMS')

    // Connect to Koha database (optional, for integration)
    if (process.env.KOHA_DB_USER && process.env.KOHA_DB_PASSWORD) {
      kohaConnection = await createConnectionPool(kohaConfig, 'Koha')
    } else {
      logger.warn('⚠️ Koha database credentials not provided, integration disabled')
    }

    return { clmsConnection, kohaConnection }
  } catch (error) {
    logger.error('❌ Database connection failed:', error)
    throw error
  }
}

// Get CLMS database connection
function getCLMSConnection() {
  if (!clmsConnection) {
    throw new Error('CLMS database not connected. Call connectDatabases() first.')
  }
  return clmsConnection
}

// Get Koha database connection
function getKohaConnection() {
  if (!kohaConnection) {
    throw new Error('Koha database not connected. Call connectDatabases() first.')
  }
  return kohaConnection
}

// Execute query with error handling
async function executeQuery(pool, query, params = []) {
  try {
    const [rows] = await pool.execute(query, params)
    return rows
  } catch (error) {
    logger.error('Database query error:', {
      query: query.substring(0, 100) + '...',
      error: error.message,
      params: params
    })
    throw error
  }
}

// Test database health
async function testDatabaseHealth() {
  const health = {
    clms: false,
    koha: false,
    timestamp: new Date().toISOString()
  }

  try {
    if (clmsConnection) {
      await executeQuery(clmsConnection, 'SELECT 1')
      health.clms = true
    }
  } catch (error) {
    logger.error('CLMS database health check failed:', error)
  }

  try {
    if (kohaConnection) {
      await executeQuery(kohaConnection, 'SELECT 1')
      health.koha = true
    }
  } catch (error) {
    logger.error('Koha database health check failed:', error)
  }

  return health
}

module.exports = {
  connectDatabases,
  getCLMSConnection,
  getKohaConnection,
  executeQuery,
  testDatabaseHealth,
  clmsConfig,
  kohaConfig
}