import { prisma } from './src/utils/prisma';

async function disableCooldown() {
  const key = 'attendance.min_check_in_interval_minutes';

  console.log(`Updating ${key} to 0...`);

  const setting = await prisma.system_settings.upsert({
    where: { key },
    update: { value: '0' },
    create: {
      key,
      value: '0',
      description: 'Minimum interval between check-ins in minutes',
      is_public: true,
    },
  });

  console.log('✅ Setting updated:', setting);
}

disableCooldown()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
