const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')

// Simple auth route for local development
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body

    // For local development, accept simple credentials
    if (username === 'sophia' && password === 'library2024') {
      const token = jwt.sign(
        {
          userId: 1,
          username: 'sophia',
          role: 'librarian',
          name: 'Sophia'
        },
        process.env.JWT_SECRET || 'default-secret',
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      )

      res.json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: 1,
          username: 'sophia',
          name: 'Sophia',
          role: 'librarian'
        }
      })
    } else {
      res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      })
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

module.exports = router