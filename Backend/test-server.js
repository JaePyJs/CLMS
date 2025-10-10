require('dotenv').config()
const express = require('express')
const cors = require('cors')
const automationRoutes = require('./src/routes/automation')

const app = express()
const PORT = 3001

// Middleware
app.use(cors())
app.use(express.json())

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    message: 'CLMS Test Server - Google Sheets Integration Ready'
  })
})

// Automation routes (no database required)
app.use('/api/automation', automationRoutes)

// Start server
app.listen(PORT, () => {
  console.log(`🚀 CLMS Test Server running on port ${PORT}`)
  console.log(`📝 Test endpoints:`)
  console.log(`   GET  http://localhost:${PORT}/health`)
  console.log(`   GET  http://localhost:${PORT}/api/automation/tasks`)
  console.log(`   GET  http://localhost:${PORT}/api/automation/google-sheets/test`)
  console.log(`   POST http://localhost:${PORT}/api/automation/sync/trigger`)
  console.log(`   GET  http://localhost:${PORT}/api/automation/reports/daily`)
})

module.exports = app