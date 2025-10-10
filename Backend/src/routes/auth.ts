import { Router, Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { authService } from '@/services/authService'
import { logger } from '@/utils/logger'

const router = Router()

// Login endpoint
router.post('/login', [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req: Request, res: Response) => {
  try {
    // Check for validation errors
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      })
    }

    const { username, password } = req.body

    // Authenticate user
    const result = await authService.login(username, password)

    if (result.success) {
      res.json({
        success: true,
        message: 'Login successful',
        data: {
          token: result.token,
          user: result.user
        }
      })
    } else {
      res.status(401).json({
        success: false,
        message: result.error || 'Login failed'
      })
    }
  } catch (error) {
    logger.error('Login error', { error: (error as Error).message })
    res.status(500).json({
      success: false,
      message: 'An error occurred during login'
    })
  }
})

// Create user endpoint (admin only)
router.post('/users', [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').notEmpty().withMessage('Role is required')
], async (req: Request, res: Response) => {
  try {
    // Check for validation errors
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      })
    }

    const { username, password, role, isActive } = req.body

    // Create user
    const result = await authService.createUser({
      username,
      password,
      role,
      isActive
    })

    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: {
          user: result.user
        }
      })
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Failed to create user'
      })
    }
  } catch (error) {
    logger.error('Create user error', { error: (error as Error).message })
    res.status(500).json({
      success: false,
      message: 'An error occurred while creating the user'
    })
  }
})

// Update password endpoint
router.put('/password', [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req: Request, res: Response) => {
  try {
    // Check for validation errors
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      })
    }

    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      })
    }

    const { currentPassword, newPassword } = req.body

    // Update password
    const result = await authService.updatePassword(req.user.userId, currentPassword, newPassword)

    if (result.success) {
      res.json({
        success: true,
        message: 'Password updated successfully'
      })
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Failed to update password'
      })
    }
  } catch (error) {
    logger.error('Update password error', { error: (error as Error).message })
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating the password'
    })
  }
})

// Reset password endpoint (admin only)
router.put('/reset-password', [
  body('userId').notEmpty().withMessage('User ID is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req: Request, res: Response) => {
  try {
    // Check for validation errors
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      })
    }

    const { userId, newPassword } = req.body

    // Reset password
    const result = await authService.resetPassword(userId, newPassword)

    if (result.success) {
      res.json({
        success: true,
        message: 'Password reset successfully'
      })
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Failed to reset password'
      })
    }
  } catch (error) {
    logger.error('Reset password error', { error: (error as Error).message })
    res.status(500).json({
      success: false,
      message: 'An error occurred while resetting the password'
    })
  }
})

// Get users endpoint (admin only)
router.get('/users', async (req: Request, res: Response) => {
  try {
    const users = await authService.getUsers()

    res.json({
      success: true,
      data: {
        users
      }
    })
  } catch (error) {
    logger.error('Get users error', { error: (error as Error).message })
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching users'
    })
  }
})

// Get user by ID endpoint (admin only)
router.get('/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      })
    }

    const user = await authService.getUserById(id)

    if (user) {
      res.json({
        success: true,
        data: {
          user
        }
      })
    } else {
      res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }
  } catch (error) {
    logger.error('Get user by ID error', { error: (error as Error).message })
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching the user'
    })
  }
})

// Update user endpoint (admin only)
router.put('/users/:id', [
  body('username').optional().notEmpty().withMessage('Username cannot be empty'),
  body('role').optional().notEmpty().withMessage('Role cannot be empty'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
], async (req: Request, res: Response) => {
  try {
    // Check for validation errors
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      })
    }

    const { id } = req.params
    const { username, role, isActive } = req.body

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      })
    }

    // Update user
    const result = await authService.updateUser(id, {
      username,
      role,
      isActive
    })

    if (result.success) {
      res.json({
        success: true,
        message: 'User updated successfully',
        data: {
          user: result.user
        }
      })
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Failed to update user'
      })
    }
  } catch (error) {
    logger.error('Update user error', { error: (error as Error).message })
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating the user'
    })
  }
})

// Delete user endpoint (admin only)
router.delete('/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      })
    }

    // Delete user
    const result = await authService.deleteUser(id)

    if (result.success) {
      res.json({
        success: true,
        message: 'User deleted successfully'
      })
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Failed to delete user'
      })
    }
  } catch (error) {
    logger.error('Delete user error', { error: (error as Error).message })
    res.status(500).json({
      success: false,
      message: 'An error occurred while deleting the user'
    })
  }
})

export default router