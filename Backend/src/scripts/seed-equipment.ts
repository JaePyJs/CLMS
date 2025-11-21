import { prisma } from '../utils/prisma';

async function seedEquipment() {
  console.log('Seeding equipment...');

  const equipmentData = [
    {
      name: 'PC-01',
      category: 'Computer',
      serial_number: 'PC-001',
      status: 'AVAILABLE',
    },
    {
      name: 'PC-02',
      category: 'Computer',
      serial_number: 'PC-002',
      status: 'AVAILABLE',
    },
    {
      name: 'PC-03',
      category: 'Computer',
      serial_number: 'PC-003',
      status: 'AVAILABLE',
    },
    {
      name: 'PS5-01',
      category: 'Gaming',
      serial_number: 'PS5-001',
      status: 'AVAILABLE',
    },
    {
      name: 'PS5-02',
      category: 'Gaming',
      serial_number: 'PS5-002',
      status: 'AVAILABLE',
    },
    {
      name: 'AVR-01',
      category: 'AVR',
      serial_number: 'AVR-001',
      status: 'AVAILABLE',
    },
  ];

  for (const item of equipmentData) {
    await prisma.equipment.upsert({
      where: { serial_number: item.serial_number },
      update: {},
      create: item,
    });
  }

  console.log('Equipment seeded successfully.');
}

seedEquipment()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
