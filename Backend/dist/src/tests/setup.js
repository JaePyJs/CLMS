"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const vitest_1 = require("vitest");
const client_1 = require("@prisma/client");
const child_process_1 = require("child_process");
const prisma = new client_1.PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL || 'file:./test.db'
        }
    }
});
exports.prisma = prisma;
(0, vitest_1.beforeAll)(async () => {
    (0, child_process_1.execSync)('npx prisma migrate reset --force --skip-seed', {
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || 'file:./test.db' }
    });
    (0, child_process_1.execSync)('npx prisma migrate deploy', {
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || 'file:./test.db' }
    });
    await prisma.$connect();
});
(0, vitest_1.afterAll)(async () => {
    await prisma.$disconnect();
});
(0, vitest_1.beforeEach)(async () => {
    const tablenames = await prisma.$queryRaw `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_migrations';`;
    for (const { name } of tablenames) {
        if (name !== '_prisma_migrations') {
            await prisma.$executeRawUnsafe(`DELETE FROM "${name}";`);
        }
    }
});
//# sourceMappingURL=setup.js.map