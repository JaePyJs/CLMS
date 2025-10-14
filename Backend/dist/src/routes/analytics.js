"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const logger_1 = require("@/utils/logger");
const analyticsService_1 = require("@/services/analyticsService");
const authorization_middleware_1 = require("@/middleware/authorization.middleware");
const permissions_1 = require("@/config/permissions");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
router.get('/metrics', (0, authorization_middleware_1.requirePermission)(permissions_1.Permission.ANALYTICS_VIEW), async (req, res) => {
    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const [totalStudents, activeStudents, newStudentsThisMonth] = await Promise.all([
            prisma.student.count(),
            prisma.student.count({ where: { isActive: true } }),
            prisma.student.count({
                where: {
                    createdAt: { gte: monthStart }
                }
            })
        ]);
        const [totalActivities, todayActivities, weekActivities, activeSessions] = await Promise.all([
            prisma.activity.count(),
            prisma.activity.count({
                where: {
                    startTime: { gte: todayStart }
                }
            }),
            prisma.activity.count({
                where: {
                    startTime: { gte: weekStart }
                }
            }),
            prisma.activity.count({
                where: {
                    status: client_1.ActivityStatus.ACTIVE,
                    startTime: { gte: todayStart }
                }
            })
        ]);
        const [totalEquipment, availableEquipment, inUseEquipment] = await Promise.all([
            prisma.equipment.count(),
            prisma.equipment.count({ where: { status: client_1.EquipmentStatus.AVAILABLE } }),
            prisma.equipment.count({ where: { status: client_1.EquipmentStatus.IN_USE } })
        ]);
        const [totalBooks, availableBooks, borrowedBooks] = await Promise.all([
            prisma.book.count(),
            prisma.book.count({ where: { isActive: true } }),
            prisma.book.count({ where: { availableCopies: { lt: 1 } } })
        ]);
        const metrics = {
            overview: {
                totalStudents,
                activeStudents,
                newStudentsThisMonth,
                totalActivities,
                todayActivities,
                weekActivities,
                activeSessions
            },
            equipment: {
                total: totalEquipment,
                available: availableEquipment,
                inUse: inUseEquipment,
                utilizationRate: totalEquipment > 0 ? (inUseEquipment / totalEquipment) * 100 : 0
            },
            books: {
                total: totalBooks,
                available: availableBooks,
                borrowed: borrowedBooks,
                circulationRate: totalBooks > 0 ? (borrowedBooks / totalBooks) * 100 : 0
            },
            usage: {
                totalVisitors: todayActivities,
                averageSessionDuration: 0,
                peakHour: 14,
                equipmentUtilization: totalEquipment > 0 ? (inUseEquipment / totalEquipment) * 100 : 0
            },
            system: {
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                lastUpdated: new Date().toISOString()
            }
        };
        res.json({
            success: true,
            data: metrics,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get analytics metrics', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve analytics metrics',
            timestamp: new Date().toISOString()
        });
    }
});
router.get('/timeline', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const activities = await prisma.activity.findMany({
            take: limit,
            include: {
                student: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        gradeLevel: true
                    }
                },
                equipment: {
                    select: {
                        id: true,
                        name: true,
                        type: true
                    }
                }
            },
            orderBy: { startTime: 'desc' }
        });
        const timeline = activities.map(activity => ({
            id: activity.id,
            timestamp: activity.startTime.toISOString(),
            studentName: `${activity.student?.firstName || 'Unknown'} ${activity.student?.lastName || 'Student'}`,
            studentGrade: activity.student?.gradeLevel || 'Unknown',
            activityType: activity.activityType,
            status: activity.status,
            equipmentId: activity.equipment?.name || 'No equipment',
            equipmentType: activity.equipment?.type || null,
            duration: activity.endTime
                ? Math.round((activity.endTime.getTime() - activity.startTime.getTime()) / 60000)
                : null,
            notes: activity.notes
        }));
        res.json({
            success: true,
            data: { timeline },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get activity timeline', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve activity timeline',
            timestamp: new Date().toISOString()
        });
    }
});
router.get('/notifications', async (req, res) => {
    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const [overdueSessions, recentActivities] = await Promise.all([
            prisma.activity.count({
                where: {
                    status: client_1.ActivityStatus.ACTIVE,
                    startTime: { lt: new Date(now.getTime() - 2 * 60 * 60 * 1000) }
                }
            }),
            prisma.activity.count({
                where: {
                    startTime: { gte: todayStart }
                }
            })
        ]);
        const notifications = [];
        if (overdueSessions > 0) {
            notifications.push({
                id: 'overdue-sessions',
                type: 'warning',
                title: 'Overdue Sessions',
                message: `${overdueSessions} session(s) have been active for over 2 hours`,
                timestamp: new Date().toISOString(),
                actionable: true,
                action: '/activities'
            });
        }
        if (recentActivities > 0) {
            notifications.push({
                id: 'daily-summary',
                type: 'info',
                title: 'Daily Activity',
                message: `${recentActivities} activities recorded today`,
                timestamp: new Date().toISOString(),
                actionable: false
            });
        }
        const memoryUsage = process.memoryUsage();
        const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
        if (memoryUsagePercent > 80) {
            notifications.push({
                id: 'high-memory',
                type: 'error',
                title: 'High Memory Usage',
                message: `Memory usage is at ${Math.round(memoryUsagePercent)}%`,
                timestamp: new Date().toISOString(),
                actionable: true,
                action: '/admin/system'
            });
        }
        notifications.push({
            id: 'welcome',
            type: 'success',
            title: 'System Status',
            message: 'All systems operational',
            timestamp: new Date().toISOString(),
            actionable: false
        });
        res.json({
            success: true,
            data: {
                notifications: notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
                unreadCount: notifications.filter(n => n.type === 'warning' || n.type === 'error').length
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get notifications', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve notifications',
            timestamp: new Date().toISOString()
        });
    }
});
router.get('/insights', async (req, res) => {
    try {
        const timeframe = req.query.timeframe || 'week';
        const insights = await analyticsService_1.analyticsService.generatePredictiveInsights(timeframe);
        res.json({
            success: true,
            data: { insights },
            timeframe,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get predictive insights', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve predictive insights',
            timestamp: new Date().toISOString()
        });
    }
});
router.get('/heatmap', async (req, res) => {
    try {
        const timeframe = req.query.timeframe || 'week';
        const heatMapData = await analyticsService_1.analyticsService.generateUsageHeatMap(timeframe);
        res.json({
            success: true,
            data: { heatMapData },
            timeframe,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get heat map data', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve heat map data',
            timestamp: new Date().toISOString()
        });
    }
});
router.get('/forecast', async (req, res) => {
    try {
        const metric = req.query.metric || 'student_visits';
        const timeframe = req.query.timeframe || 'week';
        const periods = parseInt(req.query.periods) || 7;
        const forecastData = await analyticsService_1.analyticsService.generateTimeSeriesForecast(metric, timeframe, periods);
        res.json({
            success: true,
            data: { forecastData },
            metric,
            timeframe,
            periods,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get time series forecast', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve time series forecast',
            timestamp: new Date().toISOString()
        });
    }
});
router.get('/seasonal', async (req, res) => {
    try {
        const seasonalPatterns = await analyticsService_1.analyticsService.analyzeSeasonalPatterns();
        res.json({
            success: true,
            data: { seasonalPatterns },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get seasonal patterns', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve seasonal patterns',
            timestamp: new Date().toISOString()
        });
    }
});
router.get('/resource-forecast', async (req, res) => {
    try {
        const timeframe = req.query.timeframe || 'week';
        const forecasts = await analyticsService_1.analyticsService.generateResourceForecasts(timeframe);
        res.json({
            success: true,
            data: { forecasts },
            timeframe,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get resource forecasts', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve resource forecasts',
            timestamp: new Date().toISOString()
        });
    }
});
router.get('/report', async (req, res) => {
    try {
        const timeframe = req.query.timeframe || 'week';
        const report = await analyticsService_1.analyticsService.generateInsightsReport(timeframe);
        res.json({
            success: true,
            data: report,
            timeframe,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to generate insights report', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to generate insights report',
            timestamp: new Date().toISOString()
        });
    }
});
router.get('/summary', async (req, res) => {
    try {
        const timeframe = req.query.timeframe || 'week';
        const [insights, heatMapData, seasonalPatterns, resourceForecasts, baseMetrics] = await Promise.all([
            analyticsService_1.analyticsService.generatePredictiveInsights(timeframe),
            analyticsService_1.analyticsService.generateUsageHeatMap(timeframe),
            analyticsService_1.analyticsService.analyzeSeasonalPatterns(),
            analyticsService_1.analyticsService.generateResourceForecasts(timeframe),
            getBaseMetrics()
        ]);
        const summary = {
            timeframe,
            insights,
            heatMapData,
            seasonalPatterns,
            resourceForecasts,
            baseMetrics,
            generatedAt: new Date().toISOString()
        };
        res.json({
            success: true,
            data: summary,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get analytics summary', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve analytics summary',
            timestamp: new Date().toISOString()
        });
    }
});
async function getBaseMetrics() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [totalStudents, activeStudents, totalActivities, todayActivities] = await Promise.all([
        prisma.student.count(),
        prisma.student.count({ where: { isActive: true } }),
        prisma.activity.count(),
        prisma.activity.count({
            where: {
                startTime: { gte: todayStart }
            }
        })
    ]);
    return {
        students: { total: totalStudents, active: activeStudents },
        activities: { total: totalActivities, today: todayActivities }
    };
}
exports.default = router;
//# sourceMappingURL=analytics.js.map