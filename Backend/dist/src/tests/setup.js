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
    }
}));
const originalConsoleError = console.error;
(0, vitest_1.beforeAll)(() => {
    console.error = (...args) => {
        const message = args.join(' ');
        const expectedErrors = [
            'Unique constraint failed',
            'Record to update not found',
            'Record to delete does not exist',
            'Invalid `prisma.student.create()`',
            'Invalid `prisma.student.update()`',
            'Invalid `prisma.student.delete()`'
        ];
        const isExpectedPrismaError = expectedErrors.some(error => message.includes(error));
        if (!isExpectedPrismaError) {
            originalConsoleError(...args);
        }
    };
});
(0, vitest_1.afterAll)(() => {
    console.error = originalConsoleError;
});
const prisma = new client_1.PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL || 'mysql://clms_user:clms_password@localhost:3308/clms_test_database'
        }
    },
    log: ['error'],
    errorFormat: 'minimal'
});
exports.prisma = prisma;
(0, vitest_1.beforeAll)(async () => {
    try {
        await prisma.$connect();
        await prisma.user.upsert({
            where: { username: 'test-user' },
            update: {},
            create: {
                username: 'test-user',
                password: 'test-password',
                role: 'ADMIN',
                isActive: true
            }
        });
        console.log('Test database setup completed');
    }
    catch (error) {
        console.error('Test database setup failed:', error);
        throw error;
    }
});
(0, vitest_1.afterAll)(async () => {
    await prisma.$disconnect();
});
(0, vitest_1.beforeEach)(async () => {
    try {
        await prisma.automationLog.deleteMany();
        await prisma.barcodeHistory.deleteMany();
        await prisma.activity.deleteMany();
        await prisma.equipmentSession.deleteMany();
        await prisma.bookCheckout.deleteMany();
        await prisma.automationJob.deleteMany();
        await prisma.auditLog.deleteMany();
        await prisma.systemConfig.deleteMany();
        await prisma.equipment.deleteMany();
        await prisma.book.deleteMany();
        await prisma.student.deleteMany();
        console.log('Database cleanup completed');
    }
    catch (error) {
        console.error('Database cleanup failed:', error);
    }
});
(0, vitest_1.afterEach)(async () => {
    try {
        await prisma.automationLog.deleteMany();
        await prisma.barcodeHistory.deleteMany();
        await prisma.activity.deleteMany();
        await prisma.equipmentSession.deleteMany();
        await prisma.bookCheckout.deleteMany();
        await prisma.automationJob.deleteMany();
        await prisma.auditLog.deleteMany();
        await prisma.systemConfig.deleteMany();
        await prisma.equipment.deleteMany();
        await prisma.book.deleteMany();
        await prisma.student.deleteMany();
        console.log('Database after-test cleanup completed');
    }
    catch (error) {
        console.error('Database after-test cleanup failed:', error);
    }
});
function generateTestStudentId(testName) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 5);
    return `TEST-${testName}-${timestamp}-${random}`;
}
//# sourceMappingURL=setup.js.map