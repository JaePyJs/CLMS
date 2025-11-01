import { Router, Request, Response } from 'express'
import { ApiResponse } from '@/types'
import prisma from '@/utils/prisma'

const router = Router()

// Get all fines with optional filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, studentId } = req.query

    const where: any = {}

    // Filter by payment status
    if (status === 'outstanding') {
      where.finePaid = false
      where.fineAmount = { gt: 0 }
    } else if (status === 'paid') {
      where.finePaid = true
    }

    // Filter by student
    if (studentId) {
      where.studentId = studentId as string
    }

    const fines = await prisma.bookCheckout.findMany({
      where: {
        ...where,
        fineAmount: { gt: 0 }
      },
      include: {
        book: {
          select: {
            title: true,
            accessionNo: true
          }
        },
        student: {
          select: {
            studentId: true,
            firstName: true,
            lastName: true,
            gradeLevel: true
          }
        }
      },
      orderBy: {
        dueDate: 'asc'
      }
    })

    // Calculate summary statistics
    const totalOutstanding = fines
      .filter(f => !f.finePaid)
      .reduce((sum, f) => sum + Number(f.fineAmount), 0)

    const totalCollected = fines
      .filter(f => f.finePaid)
      .reduce((sum, f) => sum + Number(f.fineAmount), 0)

    const response: ApiResponse = {
      success: true,
      data: {
        fines,
        summary: {
          totalFines: fines.length,
          outstandingCount: fines.filter(f => !f.finePaid).length,
          paidCount: fines.filter(f => f.finePaid).length,
          totalOutstanding,
          totalCollected,
          totalAmount: totalOutstanding + totalCollected
        }
      },
      timestamp: new Date().toISOString()
    }

    res.json(response)
  } catch (error) {
    console.error('Get fines error:', error)
    const response: ApiResponse = {
      success: false,
      error: 'Failed to retrieve fines',
      timestamp: new Date().toISOString()
    }
    res.status(500).json(response)
  }
})

// Get fines for a specific student
router.get('/student/:studentId', async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params

    const fines = await prisma.bookCheckout.findMany({
      where: {
        studentId,
        fineAmount: { gt: 0 }
      },
      include: {
        book: {
          select: {
            title: true,
            accessionNo: true
          }
        },
        student: {
          select: {
            studentId: true,
            firstName: true,
            lastName: true,
            gradeLevel: true
          }
        }
      },
      orderBy: {
        dueDate: 'asc'
      }
    })

    const totalOutstanding = fines
      .filter(f => !f.finePaid)
      .reduce((sum, f) => sum + Number(f.fineAmount), 0)

    const response: ApiResponse = {
      success: true,
      data: {
        fines,
        totalOutstanding
      },
      timestamp: new Date().toISOString()
    }

    res.json(response)
  } catch (error) {
    console.error('Get student fines error:', error)
    const response: ApiResponse = {
      success: false,
      error: 'Failed to retrieve student fines',
      timestamp: new Date().toISOString()
    }
    res.status(500).json(response)
  }
})

// Record fine payment
router.post('/:id/payment', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { amountPaid, paymentMethod, notes } = req.body

    // Validate payment amount
    if (!amountPaid || amountPaid <= 0) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid payment amount',
        timestamp: new Date().toISOString()
      }
      res.status(400).json(response)
      return;
    }

    // Get the checkout record
    const checkout = await prisma.bookCheckout.findUnique({
      where: { id },
      include: {
        book: { select: { title: true } },
        student: { select: { firstName: true, lastName: true } }
      }
    })

    if (!checkout) {
      const response: ApiResponse = {
        success: false,
        error: 'Fine record not found',
        timestamp: new Date().toISOString()
      }
      res.status(404).json(response)
      return;
    }

    if (checkout.finePaid) {
      const response: ApiResponse = {
        success: false,
        error: 'Fine has already been paid',
        timestamp: new Date().toISOString()
      }
      res.status(400).json(response)
      return;
    }

    // Update the checkout record
    const updatedCheckout = await prisma.bookCheckout.update({
      where: { id },
      data: {
        finePaid: true,
        notes: notes 
          ? `${checkout.notes || ''}\nPayment: ₱${amountPaid} via ${paymentMethod || 'Cash'} on ${new Date().toLocaleDateString()}`
          : checkout.notes
      }
    })

    // Create audit log
    await prisma.audit_logs.create({
      data: {
        entity: 'BookCheckout',
        entityId: id as string,
        action: 'FINE_PAYMENT',
        oldValues: { finePaid: false },
        newValues: { 
          finePaid: true, 
          amountPaid,
          paymentMethod: paymentMethod || 'Cash'
        },
        performedBy: 'Sophia'
      }
    })

    const response: ApiResponse = {
      success: true,
      data: {
        message: 'Payment recorded successfully',
        checkout: updatedCheckout
      },
      timestamp: new Date().toISOString()
    }

    res.json(response)
  } catch (error) {
    console.error('Record payment error:', error)
    const response: ApiResponse = {
      success: false,
      error: 'Failed to record payment',
      timestamp: new Date().toISOString()
    }
    res.status(500).json(response)
  }
})

// Waive fine
router.post('/:id/waive', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { reason } = req.body

    if (!reason) {
      const response: ApiResponse = {
        success: false,
        error: 'Reason for waiving fine is required',
        timestamp: new Date().toISOString()
      }
      res.status(400).json(response)
      return;
    }

    // Get the checkout record
    const checkout = await prisma.bookCheckout.findUnique({
      where: { id }
    })

    if (!checkout) {
      const response: ApiResponse = {
        success: false,
        error: 'Fine record not found',
        timestamp: new Date().toISOString()
      }
      res.status(404).json(response)
      return;
    }

    if (checkout.finePaid) {
      const response: ApiResponse = {
        success: false,
        error: 'Cannot waive a fine that has already been paid',
        timestamp: new Date().toISOString()
      }
      res.status(400).json(response)
      return;
    }

    const originalFine = checkout.fineAmount

    // Update the checkout record - set fine to 0 and mark as paid (waived)
    const updatedCheckout = await prisma.bookCheckout.update({
      where: { id },
      data: {
        fineAmount: 0,
        finePaid: true,
        notes: `${checkout.notes || ''}\nFine waived: ₱${originalFine} - Reason: ${reason} on ${new Date().toLocaleDateString()}`
      }
    })

    // Create audit log
    await prisma.audit_logs.create({
      data: {
        entity: 'BookCheckout',
        entityId: id as string,
        action: 'FINE_WAIVED',
        oldValues: { 
          fineAmount: Number(originalFine),
          finePaid: false 
        },
        newValues: { 
          fineAmount: 0,
          finePaid: true,
          reason
        },
        performedBy: 'Sophia'
      }
    })

    const response: ApiResponse = {
      success: true,
      data: {
        message: 'Fine waived successfully',
        checkout: updatedCheckout
      },
      timestamp: new Date().toISOString()
    }

    res.json(response)
  } catch (error) {
    console.error('Waive fine error:', error)
    const response: ApiResponse = {
      success: false,
      error: 'Failed to waive fine',
      timestamp: new Date().toISOString()
    }
    res.status(500).json(response)
  }
})

// Update fine amount (admin function)
router.patch('/:id/amount', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { amount } = req.body

    if (amount === undefined || amount < 0) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid amount',
        timestamp: new Date().toISOString()
      }
      res.status(400).json(response)
      return;
    }

    const checkout = await prisma.bookCheckout.findUnique({
      where: { id }
    })

    if (!checkout) {
      const response: ApiResponse = {
        success: false,
        error: 'Fine record not found',
        timestamp: new Date().toISOString()
      }
      res.status(404).json(response)
      return;
    }

    const oldAmount = checkout.fineAmount

    const updatedCheckout = await prisma.bookCheckout.update({
      where: { id },
      data: {
        fineAmount: amount
      }
    })

    // Create audit log
    await prisma.audit_logs.create({
      data: {
        entity: 'BookCheckout',
        entityId: id as string,
        action: 'FINE_AMOUNT_UPDATED',
        oldValues: { fineAmount: Number(oldAmount) },
        newValues: { fineAmount: Number(amount) },
        performedBy: 'Sophia'
      }
    })

    const response: ApiResponse = {
      success: true,
      data: {
        message: 'Fine amount updated successfully',
        checkout: updatedCheckout
      },
      timestamp: new Date().toISOString()
    }

    res.json(response)
  } catch (error) {
    console.error('Update fine amount error:', error)
    const response: ApiResponse = {
      success: false,
      error: 'Failed to update fine amount',
      timestamp: new Date().toISOString()
    }
    res.status(500).json(response)
  }
})

export default router
