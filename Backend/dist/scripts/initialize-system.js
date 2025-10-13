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
        await prisma_1.prisma.automation_logs.deleteMany({});
        await prisma_1.prisma.barcode_history.deleteMany({});
        await prisma_1.prisma.audit_logs.deleteMany({});
        await prisma_1.prisma.book_checkouts.deleteMany({});
        await prisma_1.prisma.equipment_sessions.deleteMany({});
        await prisma_1.prisma.student_activities.deleteMany({});
        await prisma_1.prisma.equipment.deleteMany({});
        await prisma_1.prisma.books.deleteMany({});
        await prisma_1.prisma.students.deleteMany({});
        await prisma_1.prisma.users.deleteMany({});
        await prisma_1.prisma.automation_jobs.deleteMany({});
        await prisma_1.prisma.system_config.deleteMany({});
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
            data: { id: crypto.randomUUID(), updated_at: new Date(),
                equipment_id: 'BOOKS-01',
                name: 'General Books Access',
                type: client_1.equipment_type.OTHER,
                location: 'Main Library Area',
                max_time_minutes: 120,
                requires_supervision: false,
                description: 'General access to book collection for browsing and reading',
                status: client_1.equipment_status.AVAILABLE,
            },
        });
        for (let i = 1; i <= 3; i++) {
            await prisma_1.prisma.equipment.create({
                data: { id: crypto.randomUUID(), updated_at: new Date(),
                    equipment_id: `COMP-${i.toString().padStart(2, '0')}`,
                    name: `Student Computer ${i}`,
                    type: client_1.equipment_type.COMPUTER,
                    location: 'Computer Lab',
                    max_time_minutes: 60,
                    requires_supervision: false,
                    description: `Student computer workstation ${i} for research and study`,
                    status: client_1.equipment_status.AVAILABLE,
                },
            });
        }
        await prisma_1.prisma.equipment.create({
            data: { id: crypto.randomUUID(), updated_at: new Date(),
                equipment_id: 'AVR-01',
                name: 'Audio-Visual Room',
                type: client_1.equipment_type.AVR,
                location: 'AVR Room',
                max_time_minutes: 90,
                requires_supervision: true,
                description: 'Audio-Visual Room for presentations and media viewing',
                status: client_1.equipment_status.AVAILABLE,
            },
        });
        await prisma_1.prisma.equipment.create({
            data: { id: crypto.randomUUID(), updated_at: new Date(),
                equipment_id: 'GAME-01',
                name: 'Recreational Room (PlayStation)',
                type: client_1.equipment_type.GAMING,
                location: 'Recreational Area',
                max_time_minutes: 45,
                requires_supervision: false,
                description: 'Recreational room equipped with PlayStation for student entertainment',
                status: client_1.equipment_status.AVAILABLE,
            },
        });
        await prisma_1.prisma.equipment.create({
            data: { id: crypto.randomUUID(), updated_at: new Date(),
                equipment_id: 'LIB-COMP-01',
                name: 'Librarian Workstation',
                type: client_1.equipment_type.COMPUTER,
                location: 'Librarian Desk',
                max_time_minutes: 480,
                requires_supervision: false,
                description: 'Librarian workstation for administrative tasks',
                status: client_1.equipment_status.AVAILABLE,
            },
        });
        await prisma_1.prisma.equipment.create({
            data: { id: crypto.randomUUID(), updated_at: new Date(),
                equipment_id: 'SERVER-01',
                name: 'Server Computer',
                type: client_1.equipment_type.COMPUTER,
                location: 'Server Room',
                max_time_minutes: 480,
                requires_supervision: true,
                description: 'Server computer for system administration and maintenance',
                status: client_1.equipment_status.AVAILABLE,
            },
        });
        for (let i = 1; i <= 2; i++) {
            await prisma_1.prisma.equipment.create({
                data: { id: crypto.randomUUID(), updated_at: new Date(),
                    equipment_id: `PRINTER-${i.toString().padStart(2, '0')}`,
                    name: `Student Printer ${i}`,
                    type: client_1.equipment_type.PRINTER,
                    location: 'Printing Station',
                    max_time_minutes: 30,
                    requires_supervision: false,
                    description: `Student printer ${i} for academic printing needs`,
                    status: client_1.equipment_status.AVAILABLE,
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