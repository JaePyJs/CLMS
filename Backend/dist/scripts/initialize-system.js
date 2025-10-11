"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSystem = initializeSystem;
exports.clearAllData = clearAllData;
exports.createStations = createStations;
const prisma_1 = require("@/utils/prisma");
const logger_1 = require("@/utils/logger");
const client_1 = require("@prisma/client");
async function clearAllData() {
    logger_1.logger.info('Starting database cleanup...');
    try {
        await prisma_1.prisma.automationLog.deleteMany({});
        await prisma_1.prisma.barcodeHistory.deleteMany({});
        await prisma_1.prisma.auditLog.deleteMany({});
        await prisma_1.prisma.bookCheckout.deleteMany({});
        await prisma_1.prisma.equipmentSession.deleteMany({});
        await prisma_1.prisma.activity.deleteMany({});
        await prisma_1.prisma.equipment.deleteMany({});
        await prisma_1.prisma.book.deleteMany({});
        await prisma_1.prisma.student.deleteMany({});
        await prisma_1.prisma.user.deleteMany({});
        await prisma_1.prisma.automationJob.deleteMany({});
        await prisma_1.prisma.systemConfig.deleteMany({});
        logger_1.logger.info('All existing data cleared successfully');
    }
    catch (error) {
        logger_1.logger.error('Error clearing data', { error: error.message });
        throw error;
    }
}
async function createStations() {
    logger_1.logger.info('Creating system stations...');
    try {
        await prisma_1.prisma.equipment.create({
            data: {
                equipmentId: 'BOOKS-01',
                name: 'General Books Access',
                type: client_1.EquipmentType.OTHER,
                location: 'Main Library Area',
                maxTimeMinutes: 120,
                requiresSupervision: false,
                description: 'General access to book collection for browsing and reading',
                status: client_1.EquipmentStatus.AVAILABLE,
            },
        });
        for (let i = 1; i <= 3; i++) {
            await prisma_1.prisma.equipment.create({
                data: {
                    equipmentId: `COMP-${i.toString().padStart(2, '0')}`,
                    name: `Student Computer ${i}`,
                    type: client_1.EquipmentType.COMPUTER,
                    location: 'Computer Lab',
                    maxTimeMinutes: 60,
                    requiresSupervision: false,
                    description: `Student computer workstation ${i} for research and study`,
                    status: client_1.EquipmentStatus.AVAILABLE,
                },
            });
        }
        await prisma_1.prisma.equipment.create({
            data: {
                equipmentId: 'AVR-01',
                name: 'Audio-Visual Room',
                type: client_1.EquipmentType.AVR,
                location: 'AVR Room',
                maxTimeMinutes: 90,
                requiresSupervision: true,
                description: 'Audio-Visual Room for presentations and media viewing',
                status: client_1.EquipmentStatus.AVAILABLE,
            },
        });
        await prisma_1.prisma.equipment.create({
            data: {
                equipmentId: 'GAME-01',
                name: 'Recreational Room (PlayStation)',
                type: client_1.EquipmentType.GAMING,
                location: 'Recreational Area',
                maxTimeMinutes: 45,
                requiresSupervision: false,
                description: 'Recreational room equipped with PlayStation for student entertainment',
                status: client_1.EquipmentStatus.AVAILABLE,
            },
        });
        await prisma_1.prisma.equipment.create({
            data: {
                equipmentId: 'LIB-COMP-01',
                name: 'Librarian Workstation',
                type: client_1.EquipmentType.COMPUTER,
                location: 'Librarian Desk',
                maxTimeMinutes: 480,
                requiresSupervision: false,
                description: 'Librarian workstation for administrative tasks',
                status: client_1.EquipmentStatus.AVAILABLE,
            },
        });
        await prisma_1.prisma.equipment.create({
            data: {
                equipmentId: 'SERVER-01',
                name: 'Server Computer',
                type: client_1.EquipmentType.COMPUTER,
                location: 'Server Room',
                maxTimeMinutes: 480,
                requiresSupervision: true,
                description: 'Server computer for system administration and maintenance',
                status: client_1.EquipmentStatus.AVAILABLE,
            },
        });
        for (let i = 1; i <= 2; i++) {
            await prisma_1.prisma.equipment.create({
                data: {
                    equipmentId: `PRINTER-${i.toString().padStart(2, '0')}`,
                    name: `Student Printer ${i}`,
                    type: client_1.EquipmentType.PRINTER,
                    location: 'Printing Station',
                    maxTimeMinutes: 30,
                    requiresSupervision: false,
                    description: `Student printer ${i} for academic printing needs`,
                    status: client_1.EquipmentStatus.AVAILABLE,
                },
            });
        }
        logger_1.logger.info('All stations created successfully');
    }
    catch (error) {
        logger_1.logger.error('Error creating stations', { error: error.message });
        throw error;
    }
}
async function initializeSystem() {
    try {
        logger_1.logger.info('Initializing CLMS system...');
        await clearAllData();
        await createStations();
        logger_1.logger.info('CLMS system initialization completed successfully');
    }
    catch (error) {
        logger_1.logger.error('Error initializing system', { error: error.message });
        throw error;
    }
    finally {
        await prisma_1.prisma.$disconnect();
    }
}
if (require.main === module) {
    initializeSystem()
        .then(() => {
        logger_1.logger.info('System initialization script completed');
        process.exit(0);
    })
        .catch((error) => {
        logger_1.logger.error('System initialization script failed', { error: error.message });
        process.exit(1);
    });
}
//# sourceMappingURL=initialize-system.js.map