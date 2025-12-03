/**
 * Script to clean up duplicate printing pricing entries
 * Keeps only the newest price for each paper_size + color_level combination
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupPricing() {
  console.log('Starting pricing cleanup...');

  // Get all active pricing
  const allPricing = await prisma.printing_pricing.findMany({
    where: { is_active: true },
    orderBy: { effective_from: 'desc' },
  });

  console.log('Current active pricing entries:', allPricing.length);

  // Group by paper_size + color_level, keep only newest
  const seen = new Map<string, (typeof allPricing)[0]>();
  const toDeactivate: string[] = [];

  for (const p of allPricing) {
    const key = `${p.paper_size}_${p.color_level}`;
    if (seen.has(key)) {
      toDeactivate.push(p.id);
      console.log(`  Will deactivate: ${key} (id: ${p.id}, price: ${p.price})`);
    } else {
      seen.set(key, p);
      console.log(`  Keeping: ${key} (id: ${p.id}, price: ${p.price})`);
    }
  }

  if (toDeactivate.length > 0) {
    console.log(`\nDeactivating ${toDeactivate.length} duplicate entries...`);
    await prisma.printing_pricing.updateMany({
      where: { id: { in: toDeactivate } },
      data: { is_active: false },
    });
    console.log('Done!');
  } else {
    console.log('\nNo duplicates found');
  }

  await prisma.$disconnect();
}

cleanupPricing().catch(console.error);
