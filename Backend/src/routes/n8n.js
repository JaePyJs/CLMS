const express = require('express')
const router = express.Router()
const logger = require('../utils/logger')

// Get n8n workflows status
router.get('/workflows', async (req, res) => {
  try {
    // Mock data for n8n workflows
    const workflows = [
      {
        id: 'daily-backup',
        name: 'Daily Backup',
        description: 'Automated daily backup of CLMS data',
        status: 'success',
        lastExecution: new Date(Date.now() - 2 * 3600000),
        successRate: 98.5,
        category: 'backup'
      },
      {
        id: 'teacher-notifications',
        name: 'Teacher Notifications',
        description: 'Generate daily teacher notifications',
        status: 'success',
        lastExecution: new Date(Date.now() - 4 * 3600000),
        successRate: 99.1,
        category: 'notification'
      },
      {
        id: 'real-time-sync',
        name: 'Real-time Sync',
        description: 'Sync data to Google Sheets',
        status: 'running',
        lastExecution: new Date(Date.now() - 5 * 60000),
        successRate: 97.2,
        category: 'sync'
      }
    ]

    res.json({
      success: true,
      data: workflows
    })
  } catch (error) {
    logger.error('Error fetching n8n workflows:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    })
  }
})

module.exports = router