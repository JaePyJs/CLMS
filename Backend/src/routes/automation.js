const express = require('express')
const router = express.Router()
const logger = require('../utils/logger')
const scheduler = require('../utils/scheduler')
const googleSheets = require('../utils/googleSheets')

// Get automation tasks status
router.get('/tasks', async (req, res) => {
  try {
    // Mock data for automation tasks
    const tasks = [
      {
        id: 'daily-backup',
        name: 'Daily Backup',
        description: 'Automated daily backup of CLMS data to Google Sheets',
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
      data: tasks
    })
  } catch (error) {
    logger.error('Error fetching automation tasks:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    })
  }
})

// Trigger manual backup
router.post('/backup/trigger', async (req, res) => {
  try {
    logger.info('Manual backup triggered by admin')
    await scheduler.performDailyBackup()
    res.json({
      success: true,
      message: 'Backup task initiated successfully'
    })
  } catch (error) {
    logger.error('Error triggering backup:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    })
  }
})

// Trigger teacher notifications
router.post('/notifications/trigger', async (req, res) => {
  try {
    logger.info('Manual teacher notifications triggered by admin')
    await scheduler.generateTeacherNotifications()
    res.json({
      success: true,
      message: 'Teacher notifications task initiated successfully'
    })
  } catch (error) {
    logger.error('Error triggering teacher notifications:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    })
  }
})

// Test Google Sheets connection
router.get('/google-sheets/test', async (req, res) => {
  try {
    await googleSheets.initialize()
    res.json({
      success: true,
      message: 'Google Sheets connection successful',
      data: {
        spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
        title: 'CLMS Data Backup'
      }
    })
  } catch (error) {
    logger.error('Google Sheets connection test failed:', error)
    res.status(500).json({
      success: false,
      error: 'Google Sheets connection failed',
      message: error.message
    })
  }
})

// Get daily report
router.get('/reports/daily', async (req, res) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date()
    const report = await googleSheets.generateDailyReport(date)
    res.json({
      success: true,
      data: report
    })
  } catch (error) {
    logger.error('Error generating daily report:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    })
  }
})

// Trigger manual sync
router.post('/sync/trigger', async (req, res) => {
  try {
    logger.info('Manual sync triggered by admin')

    // Test Google Sheets sync with sample data
    await googleSheets.appendStudentActivity({
      student_id: 'TEST-001',
      student_name: 'Test Student',
      grade_level: 'Grade 5',
      grade_category: 'gradeSchool',
      activity_type: 'computer',
      equipment_id: 'COMP-01',
      start_time: new Date().toISOString(),
      status: 'completed',
      processed_by: 'Sophia'
    })

    res.json({
      success: true,
      message: 'Sync task completed successfully'
    })
  } catch (error) {
    logger.error('Error triggering sync:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    })
  }
})

module.exports = router