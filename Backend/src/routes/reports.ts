import { Router, Request, Response } from 'express'
import { ApiResponse } from '@/types'
import prisma from '@/utils/prisma'

const router = Router()

router.get('/', (req: Request, res: Response) => {
  const response: ApiResponse = {
    success: true,
    data: { message: 'Reports endpoint' },
    timestamp: new Date().toISOString()
  }
  res.json(response)
})

// Daily Report Endpoint
router.get('/daily', async (req: Request, res: Response) => {
  try {
    const { date } = req.query
    const targetDate = date ? new Date(date as string) : new Date()
    
    // Set time boundaries for the day
    const startOfDay = new Date(targetDate)
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date(targetDate)
    endOfDay.setHours(23, 59, 59, 999)

    // Get all activities for the day
    const activities = await prisma.student_activities.findMany({
      where: {
        start_time: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      include: {
        student: true
      }
    })

    // Get book checkouts and returns for the day
    const checkouts = await prisma.bookCheckout.findMany({
      where: {
        checkoutDate: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    })

    const returns = await prisma.bookCheckout.findMany({
      where: {
        returnDate: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    })

    // Calculate statistics
    const checkIns = activities.filter(a => 
      a.activity_type === 'GENERAL_VISIT' || 
      a.activity_type === 'STUDY' || 
      a.activity_type === 'RECREATION'
    ).length

    const uniqueStudents = new Set(activities.map(a => a.student_id)).size

    // Calculate average duration for completed activities
    const completedActivities = activities.filter(a => a.status === 'COMPLETED' && a.durationMinutes)
    const avgDuration = completedActivities.length > 0
      ? Math.round(completedActivities.reduce((sum, a) => sum + (a.durationMinutes || 0), 0) / completedActivities.length)
      : 0

    // Find peak hour
    const hourCounts: { [key: number]: number } = {}
    activities.forEach(a => {
      const hour = new Date(a.startTime).getHours()
      hourCounts[hour] = (hourCounts[hour] || 0) + 1
    })
    const peakHour = Object.keys(hourCounts).length > 0
      ? Object.entries(hourCounts).reduce((a, b) => (hourCounts[parseInt(a[0])] || 0) > (hourCounts[parseInt(b[0])] || 0) ? a : b)[0]
      : '0'

    // Grade level breakdown
    const gradeLevelBreakdown: { [key: string]: number } = {}
    activities.forEach(a => {
      if (a.studentGradeCategory) {
        gradeLevelBreakdown[a.studentGradeCategory] = (gradeLevelBreakdown[a.studentGradeCategory] || 0) + 1
      }
    })

    const response: ApiResponse = {
      success: true,
      data: {
        date: targetDate.toISOString().split('T')[0],
        summary: {
          checkIns,
          checkOuts: activities.filter(a => a.status === 'COMPLETED').length,
          uniqueStudents,
          booksCirculated: checkouts.length + returns.length,
          avgDuration,
          peakHour: `${peakHour}:00`
        },
        details: {
          bookCheckouts: checkouts.length,
          bookReturns: returns.length,
          computerUse: activities.filter(a => a.activity_type === 'COMPUTER_USE').length,
          gamingSessions: activities.filter(a => a.activity_type === 'GAMING_SESSION').length,
          avrSessions: activities.filter(a => a.activity_type === 'AVR_SESSION').length
        },
        gradeLevelBreakdown
      },
      timestamp: new Date().toISOString()
    }

    res.json(response)
  } catch (error) {
    console.error('Daily report error:', error)
    const response: ApiResponse = {
      success: false,
      error: 'Failed to generate daily report',
      timestamp: new Date().toISOString()
    }
    res.status(500).json(response)
  }
})

// Weekly Report Endpoint
router.get('/weekly', async (req: Request, res: Response) => {
  try {
    const { date } = req.query
    const targetDate = date ? new Date(date as string) : new Date()
    
    // Get start of week (Sunday) and end of week (Saturday)
    const startOfWeek = new Date(targetDate)
    startOfWeek.setDate(targetDate.getDate() - targetDate.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)

    // Get all activities for the week
    const activities = await prisma.student_activities.findMany({
      where: {
        start_time: {
          gte: startOfWeek,
          lte: endOfWeek
        }
      },
      include: {
        students: true
      }
    })

    // Get book checkouts for the week
    const checkouts = await prisma.bookCheckout.findMany({
      where: {
        checkoutDate: {
          gte: startOfWeek,
          lte: endOfWeek
        }
      },
      include: {
        book: true
      }
    })

    // Calculate totals
    const totalVisits = activities.length
    const uniqueStudents = new Set(activities.map(a => a.student_id)).size
    const totalCheckouts = checkouts.length

    // Get popular books (most checked out)
    const bookCheckoutCounts: { [key: string]: { title: string; count: number } } = {}
    checkouts.forEach(c => {
      const bookId = c.book.id
      if (!bookCheckoutCounts[bookId]) {
        bookCheckoutCounts[bookId] = { title: c.book.title, count: 0 }
      }
      bookCheckoutCounts[bookId].count++
    })

    const popularBooks = Object.values(bookCheckoutCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Get popular categories
    const categoryCounts: { [key: string]: number } = {}
    checkouts.forEach(c => {
      const category = c.book.category
      categoryCounts[category] = (categoryCounts[category] || 0) + 1
    })

    const popularCategories = Object.entries(categoryCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Daily breakdown
    const dailyBreakdown = []
    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(startOfWeek)
      dayStart.setDate(startOfWeek.getDate() + i)
      dayStart.setHours(0, 0, 0, 0)
      
      const dayEnd = new Date(dayStart)
      dayEnd.setHours(23, 59, 59, 999)

      const dayActivities = activities.filter(a => {
        const actDate = new Date(a.startTime)
        return actDate >= dayStart && actDate <= dayEnd
      })

      const dayCheckouts = checkouts.filter(c => {
        const checkoutDate = new Date(c.checkoutDate)
        return checkoutDate >= dayStart && checkoutDate <= dayEnd
      })

      dailyBreakdown.push({
        date: dayStart.toISOString().split('T')[0],
        dayOfWeek: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
        visits: dayActivities.length,
        checkouts: dayCheckouts.length,
        uniqueStudents: new Set(dayActivities.map(a => a.student_id)).size
      })
    }

    const response: ApiResponse = {
      success: true,
      data: {
        weekStart: startOfWeek.toISOString().split('T')[0],
        weekEnd: endOfWeek.toISOString().split('T')[0],
        summary: {
          totalVisits,
          uniqueStudents,
          totalCheckouts
        },
        popularBooks,
        popularCategories,
        dailyBreakdown
      },
      timestamp: new Date().toISOString()
    }

    res.json(response)
  } catch (error) {
    console.error('Weekly report error:', error)
    const response: ApiResponse = {
      success: false,
      error: 'Failed to generate weekly report',
      timestamp: new Date().toISOString()
    }
    res.status(500).json(response)
  }
})

// Monthly Report Endpoint
router.get('/monthly', async (req: Request, res: Response) => {
  try {
    const { month, year } = req.query
    const targetMonth = month ? parseInt(month as string) - 1 : new Date().getMonth()
    const targetYear = year ? parseInt(year as string) : new Date().getFullYear()
    
    // Get start and end of month
    const startOfMonth = new Date(targetYear, targetMonth, 1)
    startOfMonth.setHours(0, 0, 0, 0)
    
    const endOfMonth = new Date(targetYear, targetMonth + 1, 0)
    endOfMonth.setHours(23, 59, 59, 999)

    // Get all activities for the month
    const activities = await prisma.student_activities.findMany({
      where: {
        start_time: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      },
      include: {
        students: true
      }
    })

    // Get book checkouts for the month
    const checkouts = await prisma.bookCheckout.findMany({
      where: {
        checkoutDate: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      },
      include: {
        book: true
      }
    })

    // Get returns for the month
    const returns = await prisma.bookCheckout.findMany({
      where: {
        returnDate: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      }
    })

    // Calculate statistics
    const totalVisits = activities.length
    const uniqueStudents = new Set(activities.map(a => a.student_id)).size
    const booksBorrowed = checkouts.length
    const booksReturned = returns.length

    // Activity type breakdown
    const activityBreakdown: { [key: string]: number } = {}
    activities.forEach(a => {
      activityBreakdown[a.activity_type] = (activityBreakdown[a.activity_type] || 0) + 1
    })

    // Grade level breakdown
    const gradeLevelBreakdown: { [key: string]: number } = {}
    activities.forEach(a => {
      if (a.studentGradeCategory) {
        gradeLevelBreakdown[a.studentGradeCategory] = (gradeLevelBreakdown[a.studentGradeCategory] || 0) + 1
      }
    })

    // Category breakdown for books
    const categoryBreakdown: { [key: string]: number } = {}
    checkouts.forEach(c => {
      const category = c.book.category
      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1
    })

    // Weekly trends
    const weeklyTrends = []
    let currentWeekStart = new Date(startOfMonth)
    
    while (currentWeekStart <= endOfMonth) {
      const weekEnd = new Date(currentWeekStart)
      weekEnd.setDate(currentWeekStart.getDate() + 6)
      weekEnd.setHours(23, 59, 59, 999)
      
      const finalWeekEnd = weekEnd > endOfMonth ? endOfMonth : weekEnd
      
      const weekActivities = activities.filter(a => {
        const actDate = new Date(a.startTime)
        return actDate >= currentWeekStart && actDate <= finalWeekEnd
      })

      weeklyTrends.push({
        weekStart: currentWeekStart.toISOString().split('T')[0],
        weekEnd: finalWeekEnd.toISOString().split('T')[0],
        visits: weekActivities.length,
        uniqueStudents: new Set(weekActivities.map(a => a.student_id)).size
      })
      
      currentWeekStart.setDate(currentWeekStart.getDate() + 7)
    }

    const response: ApiResponse = {
      success: true,
      data: {
        month: targetMonth + 1,
        year: targetYear,
        monthName: startOfMonth.toLocaleDateString('en-US', { month: 'long' }),
        summary: {
          totalVisits,
          uniqueStudents,
          booksBorrowed,
          booksReturned
        },
        activityBreakdown,
        gradeLevelBreakdown,
        categoryBreakdown,
        weeklyTrends
      },
      timestamp: new Date().toISOString()
    }

    res.json(response)
  } catch (error) {
    console.error('Monthly report error:', error)
    const response: ApiResponse = {
      success: false,
      error: 'Failed to generate monthly report',
      timestamp: new Date().toISOString()
    }
    res.status(500).json(response)
  }
})

// Custom Report Endpoint (flexible date range)
router.get('/custom', async (req: Request, res: Response) => {
  try {
    const { start, end } = req.query
    
    if (!start || !end) {
      const response: ApiResponse = {
        success: false,
        error: 'Both start and end dates are required',
        timestamp: new Date().toISOString()
      }
      res.status(400).json(response)
      return
    }

    const startDate = new Date(start as string)
    startDate.setHours(0, 0, 0, 0)
    
    const endDate = new Date(end as string)
    endDate.setHours(23, 59, 59, 999)

    // Validate date range
    if (startDate > endDate) {
      const response: ApiResponse = {
        success: false,
        error: 'Start date must be before end date',
        timestamp: new Date().toISOString()
      }
      res.status(400).json(response)
      return
    }

    // Get all activities for the date range
    const activities = await prisma.student_activities.findMany({
      where: {
        start_time: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        students: true
      }
    })

    // Get book checkouts for the date range
    const checkouts = await prisma.bookCheckout.findMany({
      where: {
        checkoutDate: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        book: true
      }
    })

    // Get returns for the date range
    const returns = await prisma.bookCheckout.findMany({
      where: {
        returnDate: {
          gte: startDate,
          lte: endDate
        }
      }
    })

    // Calculate basic statistics
    const totalCheckIns = activities.filter(a => 
      a.activity_type === 'GENERAL_VISIT' || 
      a.activity_type === 'STUDY' || 
      a.activity_type === 'RECREATION'
    ).length

    const uniqueStudents = new Set(activities.map(a => a.student_id)).size
    const booksBorrowed = checkouts.length
    const booksReturned = returns.length

    // Activity type breakdown
    const activityBreakdown: { [key: string]: number } = {}
    activities.forEach(a => {
      activityBreakdown[a.activity_type] = (activityBreakdown[a.activity_type] || 0) + 1
    })

    // Grade level breakdown
    const gradeLevelBreakdown: { [key: string]: number } = {}
    activities.forEach(a => {
      if (a.studentGradeCategory) {
        gradeLevelBreakdown[a.studentGradeCategory] = (gradeLevelBreakdown[a.studentGradeCategory] || 0) + 1
      }
    })

    // Most active students
    const studentActivityCounts: { [key: string]: { name: string; count: number } } = {}
    activities.forEach(a => {
      const studentId = a.student_id
      if (!studentActivityCounts[studentId]) {
        const fullName = a.students ? `${a.students.first_name} ${a.students.last_name}` : 'Unknown'
        studentActivityCounts[studentId] = { name: fullName, count: 0 }
      }
      studentActivityCounts[studentId].count++
    })

    const mostActiveStudents = Object.values(studentActivityCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Popular books
    const bookCheckoutCounts: { [key: string]: { title: string; count: number } } = {}
    checkouts.forEach(c => {
      const bookId = c.book.id
      if (!bookCheckoutCounts[bookId]) {
        bookCheckoutCounts[bookId] = { title: c.book.title, count: 0 }
      }
      bookCheckoutCounts[bookId].count++
    })

    const popularBooks = Object.values(bookCheckoutCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Category breakdown for books
    const categoryBreakdown: { [key: string]: number } = {}
    checkouts.forEach(c => {
      const category = c.book.category
      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1
    })

    const response: ApiResponse = {
      success: true,
      data: {
        dateRange: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
          days: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
        },
        summary: {
          totalCheckIns,
          uniqueStudents,
          booksBorrowed,
          booksReturned
        },
        activityBreakdown,
        gradeLevelBreakdown,
        mostActiveStudents,
        popularBooks,
        categoryBreakdown
      },
      timestamp: new Date().toISOString()
    }

    res.json(response)
  } catch (error) {
    console.error('Custom report error:', error)
    const response: ApiResponse = {
      success: false,
      error: 'Failed to generate custom report',
      timestamp: new Date().toISOString()
    }
    res.status(500).json(response)
  }
})

export default router
