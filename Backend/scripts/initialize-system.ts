import { prisma } from '@/utils/prisma';
import { logger } from '@/utils/logger';
import { EquipmentType, EquipmentStatus } from '@prisma/client';

async function clearAllData() {
  logger.info('Starting database cleanup...');

  try {
    // Delete in order to respect foreign key constraints
    await prisma.automationLog.deleteMany({});
    await prisma.barcodeHistory.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.bookCheckout.deleteMany({});
    await prisma.equipmentSession.deleteMany({});
    await prisma.activity.deleteMany({});
    await prisma.equipment.deleteMany({});
    await prisma.book.deleteMany({});
    await prisma.student.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.automationJob.deleteMany({});
    await prisma.systemConfig.deleteMany({});

    logger.info('All existing data cleared successfully');
  } catch (error) {
    logger.error('Error clearing data', { error: (error as Error).message });
    throw error;
  }
}

async function createStations() {
  logger.info('Creating system stations...');

  try {
    // Create books station (general access)
    await prisma.equipment.create({
      data: {
        equipmentId: 'BOOKS-01',
        name: 'General Books Access',
        type: EquipmentType.OTHER,
        location: 'Main Library Area',
        maxTimeMinutes: 120, // 2 hours for book browsing
        requiresSupervision: false,
        description: 'General access to book collection for browsing and reading',
        status: EquipmentStatus.AVAILABLE,
      },
    });

    // Create 3 student computers
    for (let i = 1; i <= 3; i++) {
      await prisma.equipment.create({
        data: {
          equipmentId: `COMP-${i.toString().padStart(2, '0')}`,
          name: `Student Computer ${i}`,
          type: EquipmentType.COMPUTER,
          location: 'Computer Lab',
          maxTimeMinutes: 60, // 1 hour time limit
          requiresSupervision: false,
          description: `Student computer workstation ${i} for research and study`,
          status: EquipmentStatus.AVAILABLE,
        },
      });
    }

    // Create AVR (Audio-Visual Room)
    await prisma.equipment.create({
      data: {
        equipmentId: 'AVR-01',
        name: 'Audio-Visual Room',
        type: EquipmentType.AVR,
        location: 'AVR Room',
        maxTimeMinutes: 90, // 1.5 hours for AVR sessions
        requiresSupervision: true,
        description: 'Audio-Visual Room for presentations and media viewing',
        status: EquipmentStatus.AVAILABLE,
      },
    });

    // Create Recreational Room with PlayStation
    await prisma.equipment.create({
      data: {
        equipmentId: 'GAME-01',
        name: 'Recreational Room (PlayStation)',
        type: EquipmentType.GAMING,
        location: 'Recreational Area',
        maxTimeMinutes: 45, // 45 minutes for gaming sessions
        requiresSupervision: false,
        description: 'Recreational room equipped with PlayStation for student entertainment',
        status: EquipmentStatus.AVAILABLE,
      },
    });

    // Create 2 librarian computers (don't track usage)
    await prisma.equipment.create({
      data: {
        equipmentId: 'LIB-COMP-01',
        name: 'Librarian Workstation',
        type: EquipmentType.COMPUTER,
        location: 'Librarian Desk',
        maxTimeMinutes: 480, // 8 hours for librarian use
        requiresSupervision: false,
        description: 'Librarian workstation for administrative tasks',
        status: EquipmentStatus.AVAILABLE,
      },
    });

    await prisma.equipment.create({
      data: {
        equipmentId: 'SERVER-01',
        name: 'Server Computer',
        type: EquipmentType.COMPUTER,
        location: 'Server Room',
        maxTimeMinutes: 480, // 8 hours for server operations
        requiresSupervision: true,
        description: 'Server computer for system administration and maintenance',
        status: EquipmentStatus.AVAILABLE,
      },
    });

    // Create student printers
    for (let i = 1; i <= 2; i++) {
      await prisma.equipment.create({
        data: {
          equipmentId: `PRINTER-${i.toString().padStart(2, '0')}`,
          name: `Student Printer ${i}`,
          type: EquipmentType.PRINTER,
          location: 'Printing Station',
          maxTimeMinutes: 30, // 30 minutes for printing tasks
          requiresSupervision: false,
          description: `Student printer ${i} for academic printing needs`,
          status: EquipmentStatus.AVAILABLE,
        },
      });
    }

    logger.info('All stations created successfully');
  } catch (error) {
    logger.error('Error creating stations', { error: (error as Error).message });
    throw error;
  }
}

async function initializeSystem() {
  try {
    logger.info('Initializing CLMS system...');

    // Clear all existing data
    await clearAllData();

    // Create the specified stations
    await createStations();

    logger.info('CLMS system initialization completed successfully');
  } catch (error) {
    logger.error('Error initializing system', { error: (error as Error).message });
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the initialization if this script is executed directly
if (require.main === module) {
  initializeSystem()
    .then(() => {
      logger.info('System initialization script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('System initialization script failed', { error: (error as Error).message });
      process.exit(1);
    });
}

export { initializeSystem, clearAllData, createStations };