const express = require('express')
const router = express.Router()
const { executeQuery, getCLMSConnection } = require('../config/database')
const logger = require('../utils/logger')

// Get dashboard statistics
router.get('/dashboard', async (req, res) => {
  try {
    const queries = {
      totalStudentsToday: `
        SELECT COUNT(DISTINCT student_id) as total
        FROM student_activities
        WHERE DATE(start_time) = CURDATE()
      `,
      activeSessions: `
        SELECT COUNT(*) as total
        FROM student_activities
        WHERE status = 'active'
      `,
      availableComputers: `
        SELECT COUNT(*) as total
        FROM equipment
        WHERE type = 'computer' AND status = 'available'
      `,
      averageSessionDuration: `
        SELECT AVG(duration_minutes) as average
        FROM student_activities
        WHERE duration_minutes IS NOT NULL AND DATE(start_time) = CURDATE()
      `,
      peakHour: `
        SELECT HOUR(start_time) as hour, COUNT(*) as count
        FROM student_activities
        WHERE DATE(start_time) = CURDATE()
        GROUP BY HOUR(start_time)
        ORDER BY count DESC
        LIMIT 1
      `
    }

    const [
      totalStudents,
      activeSessions,
      availableComputers,
      averageDuration,
      peakHour
    ] = await Promise.all([
      executeQuery(getCLMSConnection(), queries.totalStudentsToday),
      executeQuery(getCLMSConnection(), queries.activeSessions),
      executeQuery(getCLMSConnection(), queries.availableComputers),
      executeQuery(getCLMSConnection(), queries.averageSessionDuration),
      executeQuery(getCLMSConnection(), queries.peakHour)
    ])

    const stats = {
      totalStudentsToday: totalStudents[0].total || 0,
      activeSessions: activeSessions[0].total || 0,
      availableComputers: availableComputers[0].total || 0,
      averageSessionDuration: Math.round(averageDuration[0].average || 0),
      peakHour: peakHour[0]?.hour || 14,
      systemUptime: 99.5,
      totalActivities: totalStudents[0].total || 0,
      pendingNotifications: 8
    }

    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    logger.error('Error fetching dashboard analytics:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    })
  }
})

module.exports = router