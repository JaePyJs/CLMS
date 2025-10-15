"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
router.get('/', (req, res) => {
    const response = {
        success: true,
        data: { message: 'Admin endpoint - coming soon' },
        timestamp: new Date().toISOString()
    };
    res.json(response);
});
exports.default = router;
