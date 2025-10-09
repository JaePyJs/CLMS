const express = require('express')
const router = express.Router()
const { executeQuery, getCLMSConnection } = require('../config/database')
const logger = require('../utils/logger')

// Get all equipment
router.get('/', async (req, res) => {
  try {
    const { type, status } = req.query

    let query = `
      SELECT e.*, sa.student_name, sa.start_time as session_start,
        sa.time_limit_minutes, TIMESTAMPDIFF(MINUTE, sa.start_time, NOW()) as elapsed_minutes
      FROM equipment e
      LEFT JOIN student_activities sa ON e.equipment_id = sa.equipment_id AND sa.status = 'active'
      WHERE 1=1
    `
    const params = []

    if (type) {
      query += ` AND e.type = ?`
      params.push(type)
    }

    if (status) {
      query += ` AND e.status = ?`
      params.push(status)
    }

    query += ` ORDER BY e.type, e.equipment_id`

    const equipment = await executeQuery(getCLMSConnection(), query, params)

    res.json({
      success: true,
      data: equipment,
      count: equipment.length
    })
  } catch (error) {
    logger.error('Error fetching equipment:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    })
  }
})

// Get equipment statistics
router.get('/stats', async (req, res) => {
  try {
    const queries = {
      totalByType: `
        SELECT type, COUNT(*) as total
        FROM equipment
        GROUP BY type
      `,
      statusByType: `
        SELECT type, status, COUNT(*) as count
        FROM equipment
        GROUP BY type, status
      `,
      utilization: `
        SELECT
          e.type,
          COUNT(*) as total_equipment,
          COUNT(sa.equipment_id) as currently_in_use,
          ROUND((COUNT(sa.equipment_id) / COUNT(*)) * 100, 1) as utilization_rate
        FROM equipment e
        LEFT JOIN student_activities sa ON e.equipment_id = sa.equipment_id AND sa.status = 'active'
        GROUP BY e.type
      `
    }

    const [totalByType, statusByType, utilization] = await Promise.all([
      executeQuery(getCLMSConnection(), queries.totalByType),
      executeQuery(getCLMSConnection(), queries.statusByType),
      executeQuery(getCLMSConnection(), queries.utilization)
    ])

    res.json({
      success: true,
      data: {
        totalByType,
        statusByType,
        utilization
      }
    })
  } catch (error) {
    logger.error('Error fetching equipment statistics:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    })
  }
})

module.exports = router