const express = require('express')
const router = express.Router()
const Joi = require('joi')
const { executeQuery, getCLMSConnection } = require('../config/database')
const logger = require('../utils/logger')

// Get all student activities
router.get('/activities', async (req, res) => {
  try {
    const { startDate, endDate, gradeCategory, activityType, status } = req.query

    let query = `
      SELECT * FROM student_activities
      WHERE 1=1
    `
    const params = []

    if (startDate) {
      query += ` AND start_time >= ?`
      params.push(startDate)
    }

    if (endDate) {
      query += ` AND start_time <= ?`
      params.push(endDate)
    }

    if (gradeCategory) {
      query += ` AND grade_category = ?`
      params.push(gradeCategory)
    }

    if (activityType) {
      query += ` AND activity_type = ?`
      params.push(activityType)
    }

    if (status) {
      query += ` AND status = ?`
      params.push(status)
    }

    query += ` ORDER BY start_time DESC LIMIT 100`

    const activities = await executeQuery(getCLMSConnection(), query, params)

    res.json({
      success: true,
      data: activities,
      count: activities.length
    })
  } catch (error) {
    logger.error('Error fetching student activities:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    })
  }
})

// Get active sessions
router.get('/activities/active', async (req, res) => {
  try {
    const query = `
      SELECT * FROM student_activities
      WHERE status = 'active'
      ORDER BY start_time DESC
    `

    const activeSessions = await executeQuery(getCLMSConnection(), query)

    res.json({
      success: true,
      data: activeSessions,
      count: activeSessions.length
    })
  } catch (error) {
    logger.error('Error fetching active sessions:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    })
  }
})

// Create new student activity
router.post('/activities', async (req, res) => {
  try {
    const studentActivitySchema = Joi.object({
      studentId: Joi.string().required(),
      studentName: Joi.string().required(),
      gradeLevel: Joi.string().required(),
      gradeCategory: Joi.string().valid('primary', 'gradeSchool', 'juniorHigh', 'seniorHigh').required(),
      activityType: Joi.string().valid('borrowing', 'returning', 'computer', 'gaming', 'avr', 'recreation', 'study', 'general').required(),
      equipmentId: Joi.string().optional(),
      timeLimitMinutes: Joi.number().integer().min(1).max(240).required()
    })

    const { error, value } = studentActivitySchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: error.details[0].message
      })
    }

    const {
      studentId,
      studentName,
      gradeLevel,
      gradeCategory,
      activityType,
      equipmentId,
      timeLimitMinutes
    } = value

    // Calculate end time
    const startTime = new Date()
    const endTime = new Date(startTime.getTime() + timeLimitMinutes * 60000)

    // Insert student activity
    const query = `
      INSERT INTO student_activities (
        student_id, student_name, grade_level, grade_category,
        activity_type, equipment_id, start_time, end_time,
        time_limit_minutes, status, processed_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 'Sophia')
    `

    const params = [
      studentId,
      studentName,
      gradeLevel,
      gradeCategory,
      activityType,
      equipmentId || null,
      startTime,
      endTime,
      timeLimitMinutes
    ]

    const result = await executeQuery(getCLMSConnection(), query, params)

    res.status(201).json({
      success: true,
      message: 'Student activity created successfully',
      data: {
        id: result.insertId,
        studentId,
        studentName,
        activityType,
        startTime,
        endTime,
        timeLimitMinutes,
        status: 'active'
      }
    })
  } catch (error) {
    logger.error('Error creating student activity:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    })
  }
})

// Scan student barcode
router.post('/scan', async (req, res) => {
  try {
    const barcodeScanSchema = Joi.object({
      barcode: Joi.string().required().length(13).pattern(/^\d+$/)
    })

    const { error, value } = barcodeScanSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: error.details[0].message
      })
    }

    const { barcode } = value

    // Mock student lookup (replace with actual Koha integration)
    const mockStudent = {
      student_id: `STU${barcode.slice(-4)}`,
      name: `Student ${barcode.slice(-4)}`,
      grade_level: 'Grade 5',
      grade_category: 'gradeSchool',
      barcode: barcode,
      is_active: true
    }

    // Get default time limit based on grade category
    const timeLimits = {
      primary: parseInt(process.env.PRIMARY_TIME_LIMIT) || 30,
      gradeSchool: parseInt(process.env.GRADE_SCHOOL_TIME_LIMIT) || 60,
      juniorHigh: parseInt(process.env.JUNIOR_HIGH_TIME_LIMIT) || 90,
      seniorHigh: parseInt(process.env.SENIOR_HIGH_TIME_LIMIT) || 120
    }

    const defaultTimeLimit = timeLimits[mockStudent.grade_category] || 60

    res.json({
      success: true,
      message: 'Student found successfully',
      data: {
        ...mockStudent,
        defaultTimeLimit,
        gradeCategory: mockStudent.grade_category
      }
    })
  } catch (error) {
    logger.error('Error scanning student barcode:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    })
  }
})

module.exports = router