/**
 * Initial Database Setup Script
 *
 * This script sets up the essential configuration for a fresh CLMS installation:
 * - Default admin and librarian accounts
 * - Equipment/rooms configuration
 * - Borrowing policies
 * - Fine rates
 * - Printing prices
 *
 * NOTE: Students and books should be imported via the application's import feature.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 10;

// ============================================
// DEFAULT USERS
// ============================================
async function seedUsers(): Promise<void> {
  console.log('👤 Setting up default librarian account...');

  const users = [
    {
      username: 'librarian',
      password: 'librarian123',
      role: 'LIBRARIAN',
      email: 'librarian@library.local',
      full_name: 'Head Librarian',
    },
  ];

  for (const user of users) {
    const existing = await prisma.users.findUnique({
      where: { username: user.username },
    });

    if (existing) {
      console.log(`   ⏭️  User "${user.username}" already exists, skipping.`);
      continue;
    }

    const hashedPassword = await bcrypt.hash(user.password, BCRYPT_ROUNDS);
    await prisma.users.create({
      data: {
        username: user.username,
        password: hashedPassword,
        role: user.role,
        email: user.email,
        full_name: user.full_name,
        is_active: true,
      },
    });
    console.log(`   ✅ Created ${user.role}: ${user.username}`);
  }
}

// ============================================
// LIBRARY SECTIONS
// ============================================
async function seedLibrarySections(): Promise<void> {
  console.log('📍 Setting up library sections...');

  const sections = [
    {
      code: 'LIBRARY',
      name: 'Library Space',
      description: 'General library area - default check-in location',
      is_active: true,
    },
    {
      code: 'READING',
      name: 'Reading Area',
      description: 'Quiet reading section',
      is_active: true,
    },
    {
      code: 'COMPUTER',
      name: 'Computer Section',
      description: 'Computer workstations for research',
      is_active: true,
    },
    {
      code: 'REFERENCE',
      name: 'Reference Section',
      description: 'Reference materials and encyclopedias',
      is_active: true,
    },
  ];

  for (const section of sections) {
    const existing = await prisma.library_sections.findFirst({
      where: { code: section.code },
    });

    if (existing) {
      console.log(`   ⏭️  Section "${section.name}" already exists, skipping.`);
      continue;
    }

    await prisma.library_sections.create({ data: section });
    console.log(`   ✅ Created: ${section.name}`);
  }
}

// ============================================
// EQUIPMENT / ROOMS
// ============================================
async function seedEquipment(): Promise<void> {
  console.log('🏢 Setting up equipment and rooms...');

  const equipment = [
    {
      name: 'Computer Station 1',
      category: 'COMPUTER',
      status: 'AVAILABLE',
      notes: 'Desktop computer for student use - research and assignments',
    },
    {
      name: 'Computer Station 2',
      category: 'COMPUTER',
      status: 'AVAILABLE',
      notes: 'Desktop computer for student use - research and assignments',
    },
    {
      name: 'AVR Room',
      category: 'ROOM',
      status: 'AVAILABLE',
      notes: 'Audio Visual Room for presentations and video viewing',
    },
    {
      name: 'Borrow Materials',
      category: 'SERVICE',
      status: 'AVAILABLE',
      notes: 'Book borrowing and return service',
    },
    {
      name: 'Recreational Reading',
      category: 'ROOM',
      status: 'AVAILABLE',
      notes: 'Leisure reading area with magazines and newspapers',
    },
  ];

  for (const item of equipment) {
    const existing = await prisma.equipment.findFirst({
      where: { name: item.name },
    });

    if (existing) {
      console.log(`   ⏭️  Equipment "${item.name}" already exists, skipping.`);
      continue;
    }

    await prisma.equipment.create({ data: item });
    console.log(`   ✅ Created: ${item.name}`);
  }
}

// ============================================
// BORROWING POLICIES
// ============================================
async function seedBorrowingPolicies(): Promise<void> {
  console.log('📋 Setting up borrowing policies...');

  const policies = [
    {
      name: 'Filipiniana Collection',
      category: 'Filipiniana',
      loan_days: 3,
      overnight: false,
    },
    {
      name: 'General Reference',
      category: 'General',
      loan_days: 3,
      overnight: false,
    },
    {
      name: 'Fiction Collection',
      category: 'Fiction',
      loan_days: 7,
      overnight: false,
    },
    {
      name: 'Easy Books (Picture Books)',
      category: 'Easy Books',
      loan_days: 1, // Overnight only
      overnight: true,
    },
  ];

  for (const policy of policies) {
    const existing = await prisma.borrowing_policies.findFirst({
      where: { category: policy.category },
    });

    if (existing) {
      console.log(
        `   ⏭️  Policy for "${policy.category}" already exists, skipping.`,
      );
      continue;
    }

    await prisma.borrowing_policies.create({ data: policy });
    console.log(
      `   ✅ Created policy: ${policy.name} (${policy.loan_days} days)`,
    );
  }
}

// ============================================
// FINE POLICIES
// ============================================
async function seedFinePolicies(): Promise<void> {
  console.log('💰 Setting up fine policies...');

  const finePolicies = [
    {
      grade_min: 0, // Primary/Kinder
      grade_max: 3,
      rate_per_day: 2.0, // ₱2 per day
    },
    {
      grade_min: 4,
      grade_max: 12,
      rate_per_day: 5.0, // ₱5 per day
    },
  ];

  for (const policy of finePolicies) {
    const existing = await prisma.fine_policies.findFirst({
      where: {
        grade_min: policy.grade_min,
        grade_max: policy.grade_max,
      },
    });

    if (existing) {
      console.log(
        `   ⏭️  Fine policy for grades ${policy.grade_min}-${policy.grade_max} already exists, skipping.`,
      );
      continue;
    }

    await prisma.fine_policies.create({ data: policy });
    console.log(
      `   ✅ Created fine policy: Grades ${policy.grade_min}-${policy.grade_max} = ₱${policy.rate_per_day}/day`,
    );
  }
}

// ============================================
// PRINTING PRICING
// ============================================
async function seedPrintingPricing(): Promise<void> {
  console.log('🖨️  Setting up printing prices...');

  const prices = [
    // SHORT bond paper
    { paper_size: 'SHORT', color_level: 'BW', price: 2.0 },
    { paper_size: 'SHORT', color_level: 'HALF_COLOR', price: 5.0 },
    { paper_size: 'SHORT', color_level: 'FULL_COLOR', price: 10.0 },
    // LONG bond paper
    { paper_size: 'LONG', color_level: 'BW', price: 3.0 },
    { paper_size: 'LONG', color_level: 'HALF_COLOR', price: 6.0 },
    { paper_size: 'LONG', color_level: 'FULL_COLOR', price: 11.0 },
  ];

  for (const priceItem of prices) {
    const existing = await prisma.printing_pricing.findFirst({
      where: {
        paper_size: priceItem.paper_size,
        color_level: priceItem.color_level,
      },
    });

    if (existing) {
      console.log(
        `   ⏭️  Price for ${priceItem.paper_size} ${priceItem.color_level} already exists, skipping.`,
      );
      continue;
    }

    await prisma.printing_pricing.create({
      data: {
        ...priceItem,
        is_active: true,
      },
    });
    console.log(
      `   ✅ Set price: ${priceItem.paper_size} ${priceItem.color_level} = ₱${priceItem.price}`,
    );
  }
}

// ============================================
// MAIN FUNCTION
// ============================================
async function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║        CLMS Initial Database Setup                     ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    await seedUsers();
    console.log('');

    await seedLibrarySections();
    console.log('');

    await seedEquipment();
    console.log('');

    await seedBorrowingPolicies();
    console.log('');

    await seedFinePolicies();
    console.log('');

    await seedPrintingPricing();
    console.log('');

    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║                    SETUP COMPLETE!                     ║');
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log('║  Default Login Credentials:                            ║');
    console.log('║    Username: librarian                                 ║');
    console.log('║    Password: librarian123                              ║');
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log('║  Next Steps:                                           ║');
    console.log('║    1. Start the system with START_CLMS.bat             ║');
    console.log('║    2. Login as librarian                               ║');
    console.log('║    3. Import students via Users > Import               ║');
    console.log('║    4. Import books via Books > Import                  ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
