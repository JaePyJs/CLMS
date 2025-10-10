const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
require('dotenv').config()

// Import routes
const studentRoutes = require('./routes/students')
const equipmentRoutes = require('./routes/equipment')
const analyticsRoutes = require('./routes/analytics')
const automationRoutes = require('./routes/automation')
const authRoutes = require('./routes/auth')

// Import middleware
const { errorHandler } = require('./middleware/errorHandler')
const { requestLogger } = require('./middleware/logger')

// Import database connection
const { connectDatabases } = require('./config/database')

// Import scheduler service
const scheduler = require('./utils/scheduler')

const app = express()
const PORT = process.env.PORT || 3001

// Security middleware
app.use(helmet())
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['http://localhost:3000']
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
})
app.use('/api/', limiter)

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Request logging
app.use(requestLogger)

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: '1.0.0'
  })
})

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/students', studentRoutes)
app.use('/api/equipment', equipmentRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/automation', automationRoutes)

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString()
  })
})

// Error handling middleware
app.use(errorHandler)

// Start server
async function startServer() {
  try {
    // Connect to databases
    await connectDatabases()
    console.log('✅ Database connections established')

    // Start scheduler for automated tasks
    scheduler.start()
    console.log('✅ Automated tasks scheduler started')

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 CLMS Backend Server running on port ${PORT}`)
      console.log(`📝 Environment: ${process.env.NODE_ENV}`)
      console.log(`🔗 Health check: http://localhost:${PORT}/health`)
      console.log(`📚 Library: ${process.env.LIBRARY_NAME}`)
      console.log(`⏰ Automated tasks enabled`)
    })
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully')
  scheduler.stop()
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully')
  scheduler.stop()
  process.exit(0)
})

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error)
  process.exit(1)
})

startServer()

module.exports = app