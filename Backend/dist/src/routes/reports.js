"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("@/utils/prisma"));
const router = (0, express_1.Router)();
router.get('/', (req, res) => {
    const response = {
        success: true,
        data: { message: 'Reports endpoint' },
        timestamp: new Date().toISOString()
    };
    res.json(response);
});
router.get('/daily', async (req, res) => {
    try {
        const { date } = req.query;
        const targetDate = date ? new Date(date) : new Date();
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);
        const activities = await prisma_1.default.activity.findMany({
            where: {
                startTime: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            },
            include: {
                student: true
            }
        });
        const checkouts = await prisma_1.default.bookCheckout.findMany({
            where: {
                checkoutDate: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            }
        });
        const returns = await prisma_1.default.bookCheckout.findMany({
            where: {
                returnDate: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            }
        });
        const checkIns = activities.filter(a => a.activityType === 'GENERAL_VISIT' ||
            a.activityType === 'STUDY' ||
            a.activityType === 'RECREATION').length;
        const uniqueStudents = new Set(activities.map(a => a.studentId)).size;
        const completedActivities = activities.filter(a => a.status === 'COMPLETED' && a.durationMinutes);
        const avgDuration = completedActivities.length > 0
            ? Math.round(completedActivities.reduce((sum, a) => sum + (a.durationMinutes || 0), 0) / completedActivities.length)
            : 0;
        const hourCounts = {};
        activities.forEach(a => {
            const hour = new Date(a.startTime).getHours();
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });
        const peakHour = Object.keys(hourCounts).length > 0
            ? Object.entries(hourCounts).reduce((a, b) => (hourCounts[parseInt(a[0])] || 0) > (hourCounts[parseInt(b[0])] || 0) ? a : b)[0]
            : '0';
        const gradeLevelBreakdown = {};
        activities.forEach(a => {
            if (a.studentGradeCategory) {
                gradeLevelBreakdown[a.studentGradeCategory] = (gradeLevelBreakdown[a.studentGradeCategory] || 0) + 1;
            }
        });
        const response = {
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
                    computerUse: activities.filter(a => a.activityType === 'COMPUTER_USE').length,
                    gamingSessions: activities.filter(a => a.activityType === 'GAMING_SESSION').length,
                    avrSessions: activities.filter(a => a.activityType === 'AVR_SESSION').length
                },
                gradeLevelBreakdown
            },
            timestamp: new Date().toISOString()
        };
        res.json(response);
    }
    catch (error) {
        console.error('Daily report error:', error);
        const response = {
            success: false,
            error: 'Failed to generate daily report',
            timestamp: new Date().toISOString()
        };
        res.status(500).json(response);
    }
});
router.get('/weekly', async (req, res) => {
    try {
        const { date } = req.query;
        const targetDate = date ? new Date(date) : new Date();
        const startOfWeek = new Date(targetDate);
        startOfWeek.setDate(targetDate.getDate() - targetDate.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        const activities = await prisma_1.default.activity.findMany({
            where: {
                startTime: {
                    gte: startOfWeek,
                    lte: endOfWeek
                }
            },
            include: {
                student: true
            }
        });
        const checkouts = await prisma_1.default.bookCheckout.findMany({
            where: {
                checkoutDate: {
                    gte: startOfWeek,
                    lte: endOfWeek
                }
            },
            include: {
                book: true
            }
        });
        const totalVisits = activities.length;
        const uniqueStudents = new Set(activities.map(a => a.studentId)).size;
        const totalCheckouts = checkouts.length;
        const bookCheckoutCounts = {};
        checkouts.forEach(c => {
            const bookId = c.book.id;
            if (!bookCheckoutCounts[bookId]) {
                bookCheckoutCounts[bookId] = { title: c.book.title, count: 0 };
            }
            bookCheckoutCounts[bookId].count++;
        });
        const popularBooks = Object.values(bookCheckoutCounts)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        const categoryCounts = {};
        checkouts.forEach(c => {
            const category = c.book.category;
            categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        });
        const popularCategories = Object.entries(categoryCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        const dailyBreakdown = [];
        for (let i = 0; i < 7; i++) {
            const dayStart = new Date(startOfWeek);
            dayStart.setDate(startOfWeek.getDate() + i);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(dayStart);
            dayEnd.setHours(23, 59, 59, 999);
            const dayActivities = activities.filter(a => {
                const actDate = new Date(a.startTime);
                return actDate >= dayStart && actDate <= dayEnd;
            });
            const dayCheckouts = checkouts.filter(c => {
                const checkoutDate = new Date(c.checkoutDate);
                return checkoutDate >= dayStart && checkoutDate <= dayEnd;
            });
            dailyBreakdown.push({
                date: dayStart.toISOString().split('T')[0],
                dayOfWeek: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
                visits: dayActivities.length,
                checkouts: dayCheckouts.length,
                uniqueStudents: new Set(dayActivities.map(a => a.studentId)).size
            });
        }
        const response = {
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
        };
        res.json(response);
    }
    catch (error) {
        console.error('Weekly report error:', error);
        const response = {
            success: false,
            error: 'Failed to generate weekly report',
            timestamp: new Date().toISOString()
        };
        res.status(500).json(response);
    }
});
router.get('/monthly', async (req, res) => {
    try {
        const { month, year } = req.query;
        const targetMonth = month ? parseInt(month) - 1 : new Date().getMonth();
        const targetYear = year ? parseInt(year) : new Date().getFullYear();
        const startOfMonth = new Date(targetYear, targetMonth, 1);
        startOfMonth.setHours(0, 0, 0, 0);
        const endOfMonth = new Date(targetYear, targetMonth + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);
        const activities = await prisma_1.default.activity.findMany({
            where: {
                startTime: {
                    gte: startOfMonth,
                    lte: endOfMonth
                }
            },
            include: {
                student: true
            }
        });
        const checkouts = await prisma_1.default.bookCheckout.findMany({
            where: {
                checkoutDate: {
                    gte: startOfMonth,
                    lte: endOfMonth
                }
            },
            include: {
                book: true
            }
        });
        const returns = await prisma_1.default.bookCheckout.findMany({
            where: {
                returnDate: {
                    gte: startOfMonth,
                    lte: endOfMonth
                }
            }
        });
        const totalVisits = activities.length;
        const uniqueStudents = new Set(activities.map(a => a.studentId)).size;
        const booksBorrowed = checkouts.length;
        const booksReturned = returns.length;
        const activityBreakdown = {};
        activities.forEach(a => {
            activityBreakdown[a.activityType] = (activityBreakdown[a.activityType] || 0) + 1;
        });
        const gradeLevelBreakdown = {};
        activities.forEach(a => {
            if (a.studentGradeCategory) {
                gradeLevelBreakdown[a.studentGradeCategory] = (gradeLevelBreakdown[a.studentGradeCategory] || 0) + 1;
            }
        });
        const categoryBreakdown = {};
        checkouts.forEach(c => {
            const category = c.book.category;
            categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;
        });
        const weeklyTrends = [];
        let currentWeekStart = new Date(startOfMonth);
        while (currentWeekStart <= endOfMonth) {
            const weekEnd = new Date(currentWeekStart);
            weekEnd.setDate(currentWeekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);
            const finalWeekEnd = weekEnd > endOfMonth ? endOfMonth : weekEnd;
            const weekActivities = activities.filter(a => {
                const actDate = new Date(a.startTime);
                return actDate >= currentWeekStart && actDate <= finalWeekEnd;
            });
            weeklyTrends.push({
                weekStart: currentWeekStart.toISOString().split('T')[0],
                weekEnd: finalWeekEnd.toISOString().split('T')[0],
                visits: weekActivities.length,
                uniqueStudents: new Set(weekActivities.map(a => a.studentId)).size
            });
            currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        }
        const response = {
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
        };
        res.json(response);
    }
    catch (error) {
        console.error('Monthly report error:', error);
        const response = {
            success: false,
            error: 'Failed to generate monthly report',
            timestamp: new Date().toISOString()
        };
        res.status(500).json(response);
    }
});
router.get('/custom', async (req, res) => {
    try {
        const { start, end } = req.query;
        if (!start || !end) {
            const response = {
                success: false,
                error: 'Both start and end dates are required',
                timestamp: new Date().toISOString()
            };
            return res.status(400).json(response);
        }
        const startDate = new Date(start);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(end);
        endDate.setHours(23, 59, 59, 999);
        if (startDate > endDate) {
            const response = {
                success: false,
                error: 'Start date must be before end date',
                timestamp: new Date().toISOString()
            };
            return res.status(400).json(response);
        }
        const activities = await prisma_1.default.activity.findMany({
            where: {
                startTime: {
                    gte: startDate,
                    lte: endDate
                }
            },
            include: {
                student: true
            }
        });
        const checkouts = await prisma_1.default.bookCheckout.findMany({
            where: {
                checkoutDate: {
                    gte: startDate,
                    lte: endDate
                }
            },
            include: {
                book: true
            }
        });
        const returns = await prisma_1.default.bookCheckout.findMany({
            where: {
                returnDate: {
                    gte: startDate,
                    lte: endDate
                }
            }
        });
        const totalCheckIns = activities.filter(a => a.activityType === 'GENERAL_VISIT' ||
            a.activityType === 'STUDY' ||
            a.activityType === 'RECREATION').length;
        const uniqueStudents = new Set(activities.map(a => a.studentId)).size;
        const booksBorrowed = checkouts.length;
        const booksReturned = returns.length;
        const activityBreakdown = {};
        activities.forEach(a => {
            activityBreakdown[a.activityType] = (activityBreakdown[a.activityType] || 0) + 1;
        });
        const gradeLevelBreakdown = {};
        activities.forEach(a => {
            if (a.studentGradeCategory) {
                gradeLevelBreakdown[a.studentGradeCategory] = (gradeLevelBreakdown[a.studentGradeCategory] || 0) + 1;
            }
        });
        const studentActivityCounts = {};
        activities.forEach(a => {
            const studentId = a.studentId;
            if (!studentActivityCounts[studentId]) {
                const fullName = a.student ? `${a.student.firstName} ${a.student.lastName}` : 'Unknown';
                studentActivityCounts[studentId] = { name: fullName, count: 0 };
            }
            studentActivityCounts[studentId].count++;
        });
        const mostActiveStudents = Object.values(studentActivityCounts)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        const bookCheckoutCounts = {};
        checkouts.forEach(c => {
            const bookId = c.book.id;
            if (!bookCheckoutCounts[bookId]) {
                bookCheckoutCounts[bookId] = { title: c.book.title, count: 0 };
            }
            bookCheckoutCounts[bookId].count++;
        });
        const popularBooks = Object.values(bookCheckoutCounts)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        const categoryBreakdown = {};
        checkouts.forEach(c => {
            const category = c.book.category;
            categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;
        });
        const response = {
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
        };
        res.json(response);
    }
    catch (error) {
        console.error('Custom report error:', error);
        const response = {
            success: false,
            error: 'Failed to generate custom report',
            timestamp: new Date().toISOString()
        };
        res.status(500).json(response);
    }
});
exports.default = router;
