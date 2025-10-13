import { prisma } from '@/utils/prisma';
import { logger } from '@/utils/logger';
import { equipment_type, equipment_status } from '@prisma/client';

async function clearAllData() {
  logger.info('Starting database cleanup...');

  try {
    // Delete in order to respect foreign key constraints
    await prisma.automation_logs.deleteMany({});
    await prisma.barcode_history.deleteMany({});
    await prisma.audit_logs.deleteMany({});
    await prisma.book_checkouts.deleteMany({});
    await prisma.equipment_sessions.deleteMany({});
    await prisma.student_activities.deleteMany({});
    await prisma.equipment.deleteMany({});
    await prisma.books.deleteMany({});
    await prisma.students.deleteMany({});
    await prisma.users.deleteMany({});
    await prisma.automation_jobs.deleteMany({});
    await prisma.system_config.deleteMany({});

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
      data: { id: crypto.randomUUID(), updated_at: new Date(), 
        equipment_id: 'BOOKS-01',
        name: 'General Books Access',
        type: equipment_type.OTHER,
        location: 'Main Library Area',
        max_time_minutes: 120, // 2 hours for book browsing
        requires_supervision: false,
        description: 'General access to book collection for browsing and reading',
        status: equipment_status.AVAILABLE,
      },
    });

    // Create 3 student computers
    for (let i = 1; i <= 3; i++) {
      await prisma.equipment.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          equipment_id: `COMP-${i.toString().padStart(2, '0')}`,
          name: `Student Computer ${i}`,
          type: equipment_type.COMPUTER,
          location: 'Computer Lab',
          max_time_minutes: 60, // 1 hour time limit
          requires_supervision: false,
          description: `Student computer workstation ${i} for research and study`,
          status: equipment_status.AVAILABLE,
        },
      });
    }

    // Create AVR (Audio-Visual Room)
    await prisma.equipment.create({
      data: { id: crypto.randomUUID(), updated_at: new Date(), 
        equipment_id: 'AVR-01',
        name: 'Audio-Visual Room',
        type: equipment_type.AVR,
        location: 'AVR Room',
        max_time_minutes: 90, // 1.5 hours for AVR sessions
        requires_supervision: true,
        description: 'Audio-Visual Room for presentations and media viewing',
        status: equipment_status.AVAILABLE,
      },
    });

    // Create Recreational Room with PlayStation
    await prisma.equipment.create({
      data: { id: crypto.randomUUID(), updated_at: new Date(), 
        equipment_id: 'GAME-01',
        name: 'Recreational Room (PlayStation)',
        type: equipment_type.GAMING,
        location: 'Recreational Area',
        max_time_minutes: 45, // 45 minutes for gaming sessions
        requires_supervision: false,
        description: 'Recreational room equipped with PlayStation for student entertainment',
        status: equipment_status.AVAILABLE,
      },
    });

    // Create 2 librarian computers (don't track usage)
    await prisma.equipment.create({
      data: { id: crypto.randomUUID(), updated_at: new Date(), 
        equipment_id: 'LIB-COMP-01',
        name: 'Librarian Workstation',
        type: equipment_type.COMPUTER,
        location: 'Librarian Desk',
        max_time_minutes: 480, // 8 hours for librarian use
        requires_supervision: false,
        description: 'Librarian workstation for administrative tasks',
        status: equipment_status.AVAILABLE,
      },
    });

    await prisma.equipment.create({
      data: { id: crypto.randomUUID(), updated_at: new Date(), 
        equipment_id: 'SERVER-01',
        name: 'Server Computer',
        type: equipment_type.COMPUTER,
        location: 'Server Room',
        max_time_minutes: 480, // 8 hours for server operations
        requires_supervision: true,
        description: 'Server computer for system administration and maintenance',
        status: equipment_status.AVAILABLE,
      },
    });

    // Create student printers
    for (let i = 1; i <= 2; i++) {
      await prisma.equipment.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          equipment_id: `PRINTER-${i.toString().padStart(2, '0')}`,
          name: `Student Printer ${i}`,
          type: equipment_type.PRINTER,
          location: 'Printing Station',
          max_time_minutes: 30, // 30 minutes for printing tasks
          requires_supervision: false,
          description: `Student printer ${i} for academic printing needs`,
          status: equipment_status.AVAILABLE,
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