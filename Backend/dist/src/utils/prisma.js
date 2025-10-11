"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const prisma = globalThis.__prisma ??
    new client_1.PrismaClient({
        log: process.env.NODE_ENV === 'development'
            ? ['query', 'error', 'info', 'warn']
            : ['error'],
    });
exports.prisma = prisma;
if (process.env.NODE_ENV === 'development') {
    globalThis.__prisma = prisma;
}
process.on('beforeExit', () => {
    void prisma.$disconnect();
});
exports.default = prisma;
//# sourceMappingURL=prisma.js.map