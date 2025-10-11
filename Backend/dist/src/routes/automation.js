"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const automation_1 = require("@/services/automation");
const googleSheets_1 = require("@/services/googleSheets");
const router = (0, express_1.Router)();
router.get('/jobs', async (req, res) => {
    try {
        const jobs = await automation_1.automationService.getAllJobs();
        const response = {
            success: true,
            data: jobs,
            timestamp: new Date().toISOString(),
        };
        res.json(response);
    }
    catch (_error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch automation jobs',
            timestamp: new Date().toISOString(),
        });
    }
});
router.get('/jobs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const job = await automation_1.automationService.getJobStatus(id || '');
        if (!job) {
            return res.status(404).json({
                success: false,
                error: 'Job not found',
                timestamp: new Date().toISOString(),
            });
        }
        const response = {
            success: true,
            data: job,
            timestamp: new Date().toISOString(),
        };
        return res.json(response);
    }
    catch (_error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch job status',
            timestamp: new Date().toISOString(),
        });
    }
});
router.post('/jobs/:id/trigger', async (req, res) => {
    try {
        const { id } = req.params;
        await automation_1.automationService.triggerJob(id || '');
        const response = {
            success: true,
            message: 'Job triggered successfully',
            timestamp: new Date().toISOString(),
        };
        return res.json(response);
    }
    catch (_error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to trigger job',
            timestamp: new Date().toISOString(),
        });
    }
});
router.get('/queues/status', async (req, res) => {
    try {
        const queueStatus = await automation_1.automationService.getQueueStatus();
        const response = {
            success: true,
            data: queueStatus,
            timestamp: new Date().toISOString(),
        };
        res.json(response);
    }
    catch (_error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch queue status',
            timestamp: new Date().toISOString(),
        });
    }
});
router.get('/google-sheets/test', async (req, res) => {
    try {
        const isConnected = await googleSheets_1.googleSheetsService.testConnection();
        const response = {
            success: isConnected,
            data: {
                connected: isConnected,
                spreadsheetInfo: googleSheets_1.googleSheetsService.getSpreadsheetInfo(),
            },
            timestamp: new Date().toISOString(),
        };
        res.json(response);
    }
    catch (_error) {
        res.status(500).json({
            success: false,
            error: 'Google Sheets connection test failed',
            timestamp: new Date().toISOString(),
        });
    }
});
router.get('/reports/daily', async (req, res) => {
    try {
        const date = req.query.date
            ? new Date(req.query.date)
            : new Date();
        const report = await googleSheets_1.googleSheetsService.generateDailyReport(date);
        const response = {
            success: true,
            data: report,
            timestamp: new Date().toISOString(),
        };
        res.json(response);
    }
    catch (_error) {
        res.status(500).json({
            success: false,
            error: 'Failed to generate daily report',
            timestamp: new Date().toISOString(),
        });
    }
});
exports.default = router;
//# sourceMappingURL=automation.js.map