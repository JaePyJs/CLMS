#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearAllData = clearAllData;
const client_1 = require("@prisma/client");
const path_1 = __importDefault(require("path"));
const url_1 = require("url");
const __filename = (0, url_1.fileURLToPath)(import.meta.url);
const __dirname = path_1.default.dirname(__filename);
const prisma = new client_1.PrismaClient();
async function clearAllData() {
    console.log('🗑️  Clearing all CLMS data...\n');
    try {
        console.log('Clearing activities...');
        await prisma.activity.deleteMany();
        console.log('Clearing automation jobs...');
        await prisma.automationJob.deleteMany();
        console.log('Clearing system configuration...');
        await prisma.systemConfig.deleteMany();
        console.log('Clearing books...');
        await prisma.book.deleteMany();
        console.log('Clearing equipment...');
        await prisma.equipment.deleteMany();
        console.log('Clearing students...');
        await prisma.student.deleteMany();
        console.log('Clearing users (except admin)...');
        await prisma.user.deleteMany({
            where: {
                username: {
                    not: 'admin'
                }
            }
        });
        console.log('✅ All data cleared successfully!\n');
        const counts = await Promise.all([
            prisma.activity.count(),
            prisma.automationJob.count(),
            prisma.systemConfig.count(),
            prisma.book.count(),
            prisma.equipment.count(),
            prisma.student.count(),
            prisma.user.count(),
        ]);
        console.log('📊 Current table counts:');
        console.log(`  Activities: ${counts[0]}`);
        console.log(`  Automation Jobs: ${counts[1]}`);
        console.log(`  System Config: ${counts[2]}`);
        console.log(`  Books: ${counts[3]}`);
        console.log(`  Equipment: ${counts[4]}`);
        console.log(`  Students: ${counts[5]}`);
        console.log(`  Users: ${counts[6]}`);
    }
    catch (error) {
        console.error('❌ Error clearing data:', error);
        throw error;
    }
    finally {
        await prisma.$disconnect();
    }
}
if (import.meta.url === `file://${process.argv[1]}`) {
    clearAllData();
}
//# sourceMappingURL=clear-all-data.js.map