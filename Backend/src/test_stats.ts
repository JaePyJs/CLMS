import { SelfService } from './services/selfService';
import { prisma } from './utils/prisma';

async function test() {
  console.log('--- Testing Statistics ---');
  try {
    const stats = await SelfService.getStatistics();
    console.log('Statistics Result:', JSON.stringify(stats, null, 2));
  } catch (error) {
    console.error('Statistics Failed:', error);
  }

  console.log('\n--- Checking Barcode Anomalies ---');
  const noBarcode = await prisma.students.count({ where: { barcode: null } });

  console.log(`Students without barcode: ${noBarcode}`);
  // Note: Prisma doesn't support field comparison in where clause easily like this in all versions,
  // so let's just fetch some and check manually if needed, or rely on the count of nulls.
  // Actually, let's just check for nulls for now as that's the most likely "scan failure" cause (lookup fails).
}

test()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
