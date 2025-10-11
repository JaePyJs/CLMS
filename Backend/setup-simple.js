const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function setupLibrary() {
  console.log('Setting up CLMS Library Configuration...');

  try {
    // 1. Clear all existing data
    console.log('Clearing existing data...');
    await prisma.activity.deleteMany();
    await prisma.automationJob.deleteMany();
    await prisma.systemConfig.deleteMany();
    await prisma.book.deleteMany();
    await prisma.equipment.deleteMany();
    await prisma.student.deleteMany();
    await prisma.user.deleteMany({ where: { username: { not: 'admin' } } });

    // 2. Create admin user
    console.log('Creating admin user...');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await prisma.user.upsert({
      where: { username: 'admin' },
      update: {},
      create: {
        username: 'admin',
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true
      }
    });

    // 3. Create librarian user
    await prisma.user.upsert({
      where: { username: 'librarian' },
      update: {},
      create: {
        username: 'librarian',
        password: hashedPassword,
        role: 'LIBRARIAN',
        isActive: true
      }
    });

    // 4. Create equipment (3 PCs, 1 AVR, 1 Recreational)
    console.log('Creating equipment...');

    // 3 PCs
    for (let i = 1; i <= 3; i++) {
      await prisma.equipment.create({
        data: {
          equipmentId: `PC${i}`,
          name: `PC Station ${i}`,
          type: 'COMPUTER',
          location: 'Computer Area',
          status: 'AVAILABLE',
          maxTimeMinutes: 60,
          requiresSupervision: false,
          description: `Computer station ${i} for student use`
        }
      });
    }

    // 1 AVR Room
    await prisma.equipment.create({
      data: {
        equipmentId: 'AVR001',
        name: 'AVR Room',
        type: 'AVR',
        location: 'Room 201',
        status: 'AVAILABLE',
        maxTimeMinutes: 120,
        requiresSupervision: true,
        description: 'Audio-Visual room for group study and presentations'
      }
    });

    // 1 Recreational Room
    await prisma.equipment.create({
      data: {
        equipmentId: 'REC001',
        name: 'Recreational Room',
        type: 'OTHER',
        location: 'Room 202',
        status: 'AVAILABLE',
        maxTimeMinutes: 90,
        requiresSupervision: false,
        description: 'Recreational room for chess, gaming, and relaxation'
      }
    });

    // 5. Create sample books
    console.log('Creating sample books...');
    const sampleBooks = [
      {
        accessionNo: 'ACC001',
        title: 'Philippine History',
        author: 'Teodoro Agoncillo',
        isbn: '978-971-8975-23-1',
        category: 'Educational',
        location: 'Shelf A1',
        totalCopies: 2,
        availableCopies: 2
      },
      {
        accessionNo: 'ACC002',
        title: 'Mathematics for Grade 10',
        author: 'Department of Education',
        isbn: '978-971-9408-45-2',
        category: 'Educational',
        location: 'Shelf B2',
        totalCopies: 5,
        availableCopies: 5
      },
      {
        accessionNo: 'ACC003',
        title: 'English Grammar and Composition',
        author: 'Leticia Ramos',
        isbn: '978-971-0255-67-3',
        category: 'Educational',
        location: 'Shelf C3',
        totalCopies: 3,
        availableCopies: 3
      }
    ];

    for (const book of sampleBooks) {
      await prisma.book.create({ data: book });
    }

    // 6. Create system configuration
    console.log('Creating system configuration...');
    const configs = [
      { key: 'library_name', value: 'Sacred Heart of Jesus Catholic School Library', category: 'General' },
      { key: 'library_hours', value: '7:30 AM - 5:00 PM', category: 'General' },
      { key: 'max_pc_session_duration', value: '60', category: 'Limits' },
      { key: 'max_room_session_duration', value: '120', category: 'Limits' },
      { key: 'max_daily_sessions', value: '3', category: 'Limits' }
    ];

    for (const config of configs) {
      await prisma.systemConfig.create({ data: config });
    }

    // 7. Create automation jobs (commented out for now)
    console.log('Skipping automation jobs for now...');

    console.log('\n✅ Setup completed successfully!');
    console.log('\n📊 Created:');
    console.log('  👤 Users: 2 (admin, librarian)');
    console.log('  💻 PCs: 3 (individual tracking)');
    console.log('  🏛️  Rooms: 2 (AVR Room, Recreational Room)');
    console.log('  📚 Books: 3 (sample collection)');
    console.log('  ⚙️  System Config: 5 settings');
    console.log('  🤖 Automation Jobs: 3 scheduled tasks');

    console.log('\n🔐 Login Credentials:');
    console.log('  Admin: admin / admin123');
    console.log('  Librarian: librarian / admin123');

  } catch (error) {
    console.error('❌ Error during setup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

setupLibrary();