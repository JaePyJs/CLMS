import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
      category: 'attendance',
    },
  });

  console.log('✅ Setting updated:', setting);
}

disableCooldown()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
