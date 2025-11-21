import { prisma } from '../utils/prisma';
type PaperSize = 'SHORT' | 'LONG';
type ColorLevel = 'BW' | 'HALF_COLOR' | 'FULL_COLOR';
import bcrypt from 'bcryptjs';
import { LibrarySectionsService } from '../services/librarySectionsService';
import { BorrowingPolicyService } from '../services/borrowingPolicyService';
import { PrintingService } from '../services/printingService';
import { AnnouncementService } from '../services/announcementService';
import { EnhancedSelfService } from '../services/enhancedSelfService';

// const prisma = new PrismaClient()
type PrismaModels = {
  fine_policies: {
    findFirst(args: unknown): Promise<unknown | null>;
    create(args: unknown): Promise<unknown>;
  };
  printing_pricing: {
    findFirst(args: unknown): Promise<unknown | null>;
  };
  announcements: {
    findFirst(args: unknown): Promise<unknown | null>;
  };
  books: {
    findUnique(args: unknown): Promise<{ id: string } | null>;
  };
  borrowing_policies: {
    findUnique(args: unknown): Promise<{ id: string } | null>;
  };
  students: {
    findUnique(args: unknown): Promise<{ barcode?: string } | null>;
  };
};
const prismaModels = prisma as unknown as PrismaModels;
const rounds = Number(process.env.BCRYPT_ROUNDS || 12);

async function seedLibrarian() {
  const username = 'librarian';
  const password = 'lib123';

  const existing = await prisma.users.findUnique({ where: { username } });
  if (!existing) {
    const hash = await bcrypt.hash(password, rounds);
    await prisma.users.create({
      data: {
        username,
        password: hash,
        role: 'LIBRARIAN',
        is_active: true,
        full_name: 'Librarian User',
      },
    });
  }
}

async function seedStudents() {
  const base = [
    {
      student_id: 'S-0001',
      first_name: 'Alice',
      last_name: 'Nguyen',
      grade_level: 5,
      section: 'A',
      barcode: 'BAR-0001',
    },
    {
      student_id: 'S-0002',
      first_name: 'Bob',
      last_name: 'Martinez',
      grade_level: 6,
      section: 'B',
      barcode: 'BAR-0002',
    },
    {
      student_id: 'S-0003',
      first_name: 'Charlie',
      last_name: 'Khan',
      grade_level: 11,
      section: 'C',
      barcode: 'BAR-0003',
    },
    {
      student_id: 'S-0004',
      first_name: 'Dana',
      last_name: 'Reyes',
      grade_level: 2,
      section: 'A',
      barcode: 'BAR-0004',
    },
    {
      student_id: 'S-0005',
      first_name: 'Evan',
      last_name: 'Garcia',
      grade_level: 9,
      section: 'B',
      barcode: 'BAR-0005',
    },
  ];
  for (const s of base) {
    await prisma.students.upsert({
      where: { student_id: s.student_id },
      update: {},
      create: {
        ...s,
        is_active: true,
      },
    });
  }
}

async function seedBooks() {
  const base = [
    {
      accession_no: 'ACC-0001',
      title: 'Intro to Algorithms',
      author: 'Cormen',
      total_copies: 5,
      available_copies: 5,
    },
    {
      accession_no: 'ACC-0002',
      title: 'Clean Code',
      author: 'Robert C. Martin',
      total_copies: 3,
      available_copies: 3,
    },
    {
      accession_no: 'ACC-0003',
      title: 'Design Patterns',
      author: 'Gamma et al.',
      total_copies: 4,
      available_copies: 4,
    },
    {
      accession_no: 'ACC-0004',
      title: 'Filipino Heritage',
      author: 'Various',
      total_copies: 6,
      available_copies: 6,
    },
    {
      accession_no: 'ACC-0005',
      title: 'ABC for Kids',
      author: 'Marie Cruz',
      total_copies: 10,
      available_copies: 10,
    },
  ];
  for (const b of base) {
    await prisma.books.upsert({
      where: { accession_no: b.accession_no },
      update: {},
      create: {
        ...b,
        is_active: true,
      },
    });
  }
}

async function seedSections() {
  await LibrarySectionsService.ensureDefaultSections();
}

async function seedPolicies() {
  const filipiniana =
    await BorrowingPolicyService.getPolicyByCategory('FILIPINIANA');
  if (!filipiniana) {
    await BorrowingPolicyService.createPolicy({
      name: 'Filipiniana/General',
      category: 'FILIPINIANA',
      loan_days: 3,
    });
  }
  const fiction = await BorrowingPolicyService.getPolicyByCategory('FICTION');
  if (!fiction) {
    await BorrowingPolicyService.createPolicy({
      name: 'Fiction',
      category: 'FICTION',
      loan_days: 7,
    });
  }
  const easy = await BorrowingPolicyService.getPolicyByCategory('EASY_BOOKS');
  if (!easy) {
    await BorrowingPolicyService.createPolicy({
      name: 'Easy Books',
      category: 'EASY_BOOKS',
      loan_days: 0,
      overnight: true,
    });
  }
}

async function seedFinePolicies() {
  const p1 = await prismaModels.fine_policies.findFirst({
    where: { grade_min: 1, grade_max: 3 },
  });
  if (!p1) {
    await prismaModels.fine_policies.create({
      data: {
        grade_min: 1,
        grade_max: 3,
        rate_per_day: 2,
        currency: 'PHP',
        is_active: true,
      },
    });
  }
  const p2 = await prismaModels.fine_policies.findFirst({
    where: { grade_min: 4, grade_max: 12 },
  });
  if (!p2) {
    await prismaModels.fine_policies.create({
      data: {
        grade_min: 4,
        grade_max: 12,
        rate_per_day: 5,
        currency: 'PHP',
        is_active: true,
      },
    });
  }
}

async function seedPrintingPricing() {
  const matrix: Array<{ size: PaperSize; color: ColorLevel; price: number }> = [
    { size: 'SHORT', color: 'BW', price: 2 },
    { size: 'SHORT', color: 'HALF_COLOR', price: 5 },
    { size: 'SHORT', color: 'FULL_COLOR', price: 10 },
    { size: 'LONG', color: 'BW', price: 3 },
    { size: 'LONG', color: 'HALF_COLOR', price: 6 },
    { size: 'LONG', color: 'FULL_COLOR', price: 11 },
  ];
  for (const item of matrix) {
    const exists = await prismaModels.printing_pricing.findFirst({
      where: {
        paper_size: item.size,
        color_level: item.color,
        is_active: true,
      },
    });
    if (!exists) {
      await PrintingService.createPricing({
        paper_size: item.size,
        color_level: item.color,
        price: item.price,
        currency: 'PHP',
        is_active: true,
      });
    }
  }
}

async function seedAnnouncements() {
  const exists = await prismaModels.announcements.findFirst({
    where: { title: 'Welcome to the Library' },
  });
  if (!exists) {
    await AnnouncementService.create({
      title: 'Welcome to the Library',
      content: 'Please observe silence and care for materials. Happy reading!',
      start_time: new Date(),
      is_active: true,
      priority: 'NORMAL',
    });
  }
}

async function assignPoliciesToBooks() {
  const alg = await prismaModels.books.findUnique({
    where: { accession_no: 'ACC-0001' },
  });
  const clean = await prismaModels.books.findUnique({
    where: { accession_no: 'ACC-0002' },
  });
  const patterns = await prismaModels.books.findUnique({
    where: { accession_no: 'ACC-0003' },
  });
  const filipiniana = await prismaModels.borrowing_policies.findUnique({
    where: { category: 'FILIPINIANA' },
  });
  const fiction = await prismaModels.borrowing_policies.findUnique({
    where: { category: 'FICTION' },
  });
  const easy = await prismaModels.borrowing_policies.findUnique({
    where: { category: 'EASY_BOOKS' },
  });
  if (alg && filipiniana) {
    await BorrowingPolicyService.assignDefaultPolicyToBook(
      alg.id,
      filipiniana.id,
    );
  }
  if (clean && fiction) {
    await BorrowingPolicyService.assignDefaultPolicyToBook(
      clean.id,
      fiction.id,
    );
  }
  if (patterns && easy) {
    await BorrowingPolicyService.assignDefaultPolicyToBook(
      patterns.id,
      easy.id,
    );
  }
}

async function seedSampleActivities() {
  const alice = await prismaModels.students.findUnique({
    where: { student_id: 'S-0001' },
  });
  const bob = await prismaModels.students.findUnique({
    where: { student_id: 'S-0002' },
  });
  const charlie = await prismaModels.students.findUnique({
    where: { student_id: 'S-0003' },
  });
  const dana = await prismaModels.students.findUnique({
    where: { student_id: 'S-0004' },
  });
  const evan = await prismaModels.students.findUnique({
    where: { student_id: 'S-0005' },
  });
  if (alice?.barcode) {
    await EnhancedSelfService.processScanWithSelection(alice.barcode, [
      'LIBRARY_SPACE',
    ]);
  }
  if (bob?.barcode) {
    await EnhancedSelfService.processScanWithSelection(bob.barcode, [
      'COMPUTER',
    ]);
  }
  if (charlie?.barcode) {
    await EnhancedSelfService.processScanWithSelection(charlie.barcode, [
      'AVR',
      'BORROWING',
    ]);
  }
  if (dana?.barcode) {
    await EnhancedSelfService.processScanWithSelection(dana.barcode, ['VR']);
  }
  if (evan?.barcode) {
    await EnhancedSelfService.processScanWithSelection(evan.barcode, [
      'LIBRARY_SPACE',
      'COMPUTER',
    ]);
  }
}

async function seedOverdueScenarios() {
  const student = await prisma.students.findUnique({
    where: { student_id: 'S-0001' },
  });
  const book = await prisma.books.findUnique({
    where: { accession_no: 'ACC-0002' },
  });
  if (student && book) {
    const checkoutDate = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
    const dueDate = new Date(checkoutDate.getTime() + 14 * 24 * 60 * 60 * 1000);
    const existing = await prisma.book_checkouts.findFirst({
      where: { student_id: student.id, book_id: book.id, status: 'ACTIVE' },
    });
    if (!existing) {
      await prisma.book_checkouts.create({
        data: {
          student_id: student.id,
          book_id: book.id,
          checkout_date: checkoutDate,
          due_date: dueDate,
          status: 'ACTIVE',
        },
      });
    }
  }
}

async function seedLibrarianStudent() {
  const existing = await prisma.students.findUnique({
    where: { student_id: 'LIBRARIAN' },
  });
  if (!existing) {
    await prisma.students.create({
      data: {
        student_id: 'LIBRARIAN',
        first_name: 'Claudia Sophia',
        last_name: 'Agana',
        grade_level: 0,
        grade_category: 'PERSONNEL',
        section: 'PERSONNEL',
        barcode: 'PN00018',
        is_active: true,
      },
    });
  } else if (!existing.barcode) {
    await prisma.students.update({
      where: { id: existing.id },
      data: { barcode: 'PN00018' },
    });
  }
}

async function main() {
  await seedLibrarian();
  await seedStudents();
  await seedBooks();
  await seedSections();
  await seedPolicies();
  await seedFinePolicies();
  await seedPrintingPricing();
  await assignPoliciesToBooks();
  await seedAnnouncements();
  await seedSampleActivities();
  await seedOverdueScenarios();
  await seedLibrarianStudent();
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
