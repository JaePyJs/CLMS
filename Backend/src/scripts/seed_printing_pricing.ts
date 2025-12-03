import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedPrintingPricing() {
  console.log('Seeding printing pricing...\n');

  // Delete existing pricing to start fresh
  await prisma.printing_pricing.deleteMany({});

  /**
   * Pricing as per requirements:
   * Short Paper: BW ₱2, Half Color ₱5, Full Color ₱10
   * Long Paper: BW ₱3, Half Color ₱6, Full Color ₱11
   */
  const pricingData = [
    // Short Paper (Letter)
    {
      paper_size: 'SHORT',
      color_level: 'BW',
      price: 2,
      currency: 'PHP',
      is_active: true,
    },
    {
      paper_size: 'SHORT',
      color_level: 'HALF_COLOR',
      price: 5,
      currency: 'PHP',
      is_active: true,
    },
    {
      paper_size: 'SHORT',
      color_level: 'FULL_COLOR',
      price: 10,
      currency: 'PHP',
      is_active: true,
    },
    // Long Paper (Legal)
    {
      paper_size: 'LONG',
      color_level: 'BW',
      price: 3,
      currency: 'PHP',
      is_active: true,
    },
    {
      paper_size: 'LONG',
      color_level: 'HALF_COLOR',
      price: 6,
      currency: 'PHP',
      is_active: true,
    },
    {
      paper_size: 'LONG',
      color_level: 'FULL_COLOR',
      price: 11,
      currency: 'PHP',
      is_active: true,
    },
  ];

  for (const pricing of pricingData) {
    await prisma.printing_pricing.create({
      data: pricing,
    });
    console.log(
      `  ✅ ${pricing.paper_size} - ${pricing.color_level}: ₱${pricing.price}`,
    );
  }

  console.log('\n✨ Printing pricing seeded successfully!');
  console.log('\nPricing Summary:');
  console.log('  Short Paper: BW ₱2, Half Color ₱5, Full Color ₱10');
  console.log('  Long Paper: BW ₱3, Half Color ₱6, Full Color ₱11');
}

seedPrintingPricing()
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
