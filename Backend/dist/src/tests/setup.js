"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.generateTestStudentId = generateTestStudentId;
const vitest_1 = require("vitest");
const client_1 = require("@prisma/client");
process.env.NODE_ENV = 'test';
vitest_1.vi.mock('@/utils/logger', () => ({
    logger: {
        info: vitest_1.vi.fn(),
        error: vitest_1.vi.fn(),
        warn: vitest_1.vi.fn(),
        debug: vitest_1.vi.fn(),
    },
}));
const prisma = new client_1.PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL ||
                'mysql://clms_user:clms_password@localhost:3308/clms_test_database',
        },
    },
    log: ['error'],
    errorFormat: 'minimal',
});
exports.prisma = prisma;
function generateTestStudentId(testName) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 5);
    return `TEST-${testName}-${timestamp}-${random}`;
}
//# sourceMappingURL=setup.js.map