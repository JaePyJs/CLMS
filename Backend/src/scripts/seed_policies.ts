import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedPolicies() {
  console.log('Seeding borrowing and fine policies...\n');

  // ============ BORROWING POLICIES ============
  console.log('📚 Borrowing Policies:');

  /**
   * Due dates by category (from requirements):
   * - Filipiniana/General Collection: 3 days
   * - Fiction: 7 days
   * - Easy Books: Overnight (1 day)
   */
  const borrowingPolicies = [
    {
      category: 'Filipiniana',
      name: 'Filipiniana Collection',
      loan_days: 3,
      overnight: false,
      is_active: true,
    },
    {
      category: 'General Collection',
      name: 'General Collection',
      loan_days: 3,
      overnight: false,
      is_active: true,
    },
    {
      category: 'Fiction',
      name: 'Fiction Collection',
      loan_days: 7,
      overnight: false,
      is_active: true,
    },
    {
      category: 'Easy Books',
      name: 'Easy Books (Overnight)',
      loan_days: 1,
      overnight: true,
      is_active: true,
    },
    {
      category: 'Reference',
      name: 'Reference (Library Use Only)',
      loan_days: 0,
      overnight: false,
      is_active: true,
    },
    {
      category: 'Textbook',
      name: 'Textbook Collection',
      loan_days: 7,
      overnight: false,
      is_active: true,
    },
  ];

  for (const policy of borrowingPolicies) {
    await prisma.borrowing_policies.upsert({
      where: { category: policy.category },
      update: {
        name: policy.name,
        loan_days: policy.loan_days,
        overnight: policy.overnight,
        is_active: policy.is_active,
      },
      create: policy,
    });
    const period = policy.overnight ? 'Overnight' : `${policy.loan_days} days`;
    console.log(`  ✅ ${policy.category}: ${period}`);
  }

  // ============ FINE POLICIES ============
  console.log('\n💰 Fine Policies (Per Day Overdue):');

  /**
   * Fine calculation by grade (from requirements):
   * - Primary to Grade 3: ₱2 per day
   * - Grade 4 to Senior High: ₱5 per day
   */

  // Delete existing fine policies to avoid duplicates
  await prisma.fine_policies.deleteMany({});

  const finePolicies = [
    {
      grade_min: 0, // Kinder
      grade_max: 3, // Grade 3
      rate_per_day: 2,
      currency: 'PHP',
      is_active: true,
    },
    {
      grade_min: 4, // Grade 4
      grade_max: 12, // Grade 12 (Senior High)
      rate_per_day: 5,
      currency: 'PHP',
      is_active: true,
    },
  ];

  for (const policy of finePolicies) {
    await prisma.fine_policies.create({
      data: policy,
    });
    const gradeRange =
      policy.grade_min === 0
        ? `Primary-Grade ${policy.grade_max}`
        : `Grade ${policy.grade_min}-Grade ${policy.grade_max}`;
    console.log(`  ✅ ${gradeRange}: ₱${policy.rate_per_day}/day`);
  }

  console.log('\n✨ All policies seeded successfully!');
  console.log('\nSummary:');
  console.log(
    '  Borrowing: Filipiniana/General 3 days, Fiction 7 days, Easy Books Overnight',
  );
  console.log('  Fines: Primary-Grade 3 = ₱2/day, Grade 4-12 = ₱5/day');
}

seedPolicies()
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
