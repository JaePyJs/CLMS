import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function main() {
  console.log('Seeding specific rooms/activities...');

  // Clear existing equipment to ensure a clean slate with the new list
  await prisma.equipment.deleteMany({});

  const roomData = [
    {
      name: 'Use of AVR',
      category: 'avr', // Maps to 'avr' filter
      serial_number: 'RM-AVR-001',
      status: 'AVAILABLE',
      notes: 'Audio Visual Room',
    },
    {
      name: 'Computer Station 1',
      category: 'computer', // Maps to 'computers' filter
      serial_number: 'COMP-001',
      status: 'AVAILABLE',
      notes: 'Public Access Computer',
    },
    {
      name: 'Computer Station 2',
      category: 'computer', // Maps to 'computers' filter
      serial_number: 'COMP-002',
      status: 'AVAILABLE',
      notes: 'Public Access Computer',
    },
    {
      name: 'Library Space',
      category: 'room', // General room
      serial_number: 'RM-MAIN-001',
      status: 'AVAILABLE',
      notes: 'Default Library Area',
    },
    {
      name: 'Borrow Materials',
      category: 'service', // Special category
      serial_number: 'SVC-BORROW-001',
      status: 'AVAILABLE',
      notes: 'Circulation Desk',
    },
    {
      name: 'Recreational Materials',
      category: 'gaming', // Maps to 'gaming' filter (closest fit for recreational)
      serial_number: 'MAT-REC-001',
      status: 'AVAILABLE',
      notes: 'Board games, etc.',
    },
  ];

  for (const item of roomData) {
    await prisma.equipment.create({
      data: item,
    });
  }

  console.log('Room/Activity seeding completed.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
