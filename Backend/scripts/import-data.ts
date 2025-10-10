import {
  PrismaClient,
  GradeCategory,
  EquipmentType,
  EquipmentStatus,
} from '@prisma/client';
import ExcelJS from 'exceljs';
import { readFileSync } from 'fs';
import { join } from 'path';
import bcrypt from 'bcryptjs';
// import { logger } from '@/utils/logger';

const prisma = new PrismaClient();

// Grade category mapping
function mapGradeCategory(gradeLevel: string): GradeCategory {
  const level = gradeLevel.toLowerCase();
  if (
    level.includes('k-') ||
    level.includes('kindergarten') ||
    level.includes('grade 1') ||
    level.includes('grade 2') ||
    level.includes('grade 3')
  ) {
    return GradeCategory.PRIMARY;
  } else if (
    level.includes('grade 4') ||
    level.includes('grade 5') ||
    level.includes('grade 6')
  ) {
    return GradeCategory.GRADE_SCHOOL;
  } else if (
    level.includes('grade 7') ||
    level.includes('grade 8') ||
    level.includes('grade 9') ||
    level.includes('grade 10')
  ) {
    return GradeCategory.JUNIOR_HIGH;
  } else if (level.includes('grade 11') || level.includes('grade 12')) {
    return GradeCategory.SENIOR_HIGH;
  }
  return GradeCategory.GRADE_SCHOOL; // default
}

async function importStudentsFromJSON() {
  try {
    console.log('📚 Importing students from Current_Students.json...');

    const jsonPath = join(process.cwd(), '..', 'Current_Students.json');
    const jsonData = JSON.parse(readFileSync(jsonPath, 'utf-8'));

    let imported = 0;
    let skipped = 0;

    for (const student of jsonData) {
      try {
        // Use the actual JSON structure
        if (!student['User id']) {
          skipped++;
          continue;
        }

        const studentId = String(student['User id']);
        const fullName = student.Full_Name || 'Unknown Unknown';

        // Parse name (format: "LastName, FirstName MiddleInitial.")
        const nameParts = fullName.split(',').map((s: string) => s.trim());
        const lastName = nameParts[0] || 'Unknown';
        const firstNameParts = (nameParts[1] || 'Unknown').split(' ');
        const firstName = firstNameParts[0] || 'Unknown';

        const gradeLevel = student.Grade_Level || 'Unknown';
        const schoolLevel = student.School_Level || 'Unknown';

        // Map school level to grade category
        let gradeCategory: GradeCategory = GradeCategory.GRADE_SCHOOL;
        if (schoolLevel.includes('Senior High')) {
          gradeCategory = GradeCategory.SENIOR_HIGH;
        } else if (
          schoolLevel.includes('Junior') ||
          schoolLevel.includes('High School (Junior)')
        ) {
          gradeCategory = GradeCategory.JUNIOR_HIGH;
        } else if (
          gradeLevel.includes('Grade 4') ||
          gradeLevel.includes('Grade 5') ||
          gradeLevel.includes('Grade 6')
        ) {
          gradeCategory = GradeCategory.GRADE_SCHOOL;
        } else if (
          gradeLevel.includes('Grade 1') ||
          gradeLevel.includes('Grade 2') ||
          gradeLevel.includes('Grade 3') ||
          gradeLevel.includes('K-')
        ) {
          gradeCategory = GradeCategory.PRIMARY;
        }

        await prisma.student.upsert({
          where: { studentId },
          update: {
            firstName,
            lastName,
            gradeLevel,
            gradeCategory,
            isActive: true,
          },
          create: {
            studentId,
            firstName,
            lastName,
            gradeLevel,
            gradeCategory,
            isActive: true,
          },
        });

        imported++;
        if (imported % 50 === 0) {
          console.log(`  ✓ Imported ${imported} students...`);
        }
      } catch (error) {
        console.error('Failed to import student:', {
          error: (error as Error).message,
          student,
        });
        skipped++;
      }
    }

    console.log(`✅ Students imported: ${imported}, skipped: ${skipped}`);
    return { imported, skipped };
  } catch (error) {
    console.error('❌ Failed to import students from JSON:', error);
    throw error;
  }
}

async function importBooksFromExcel() {
  try {
    console.log('📖 Importing books from Excel...');

    const excelPath = join(
      process.cwd(),
      '..',
      'SHJCS_Complete_Library_Database_Organized.xlsx',
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);

    let imported = 0;
    let skipped = 0;

    // Try to find the books worksheet
    const worksheet =
      workbook.getWorksheet('Books') ||
      workbook.getWorksheet('Library') ||
      workbook.getWorksheet(1); // First sheet as fallback

    if (!worksheet) {
      throw new Error('No worksheet found in Excel file');
    }

    console.log(`  Found worksheet: ${worksheet.name}`);
    console.log(`  Total rows: ${worksheet.rowCount}`);

    // Skip header row (assumes first row is headers)
    worksheet.eachRow({ includeEmpty: false }, async (row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      try {
        // Adjust these column indices based on your Excel structure
        const accessionNo =
          row.getCell(1).value?.toString() || `BK-${Date.now()}-${rowNumber}`;
        const isbn = row.getCell(2).value?.toString() || null;
        const title = row.getCell(3).value?.toString() || 'Untitled';
        const author = row.getCell(4).value?.toString() || 'Unknown Author';
        const publisher = row.getCell(5).value?.toString() || null;
        const category = row.getCell(6).value?.toString() || 'General';
        const subcategory = row.getCell(7).value?.toString() || null;
        const location = row.getCell(8).value?.toString() || null;
        const totalCopies = parseInt(row.getCell(9).value?.toString() || '1');

        // Skip if no title
        if (!title || title === 'Untitled') {
          skipped++;
          return;
        }

        await prisma.book.upsert({
          where: { accessionNo },
          update: {
            isbn,
            title,
            author,
            publisher,
            category,
            subcategory,
            location,
            totalCopies,
            availableCopies: totalCopies,
            isActive: true,
          },
          create: {
            accessionNo,
            isbn,
            title,
            author,
            publisher,
            category,
            subcategory,
            location,
            totalCopies,
            availableCopies: totalCopies,
            isActive: true,
          },
        });

        imported++;
        if (imported % 50 === 0) {
          console.log(`  ✓ Imported ${imported} books...`);
        }
      } catch (error) {
        console.error('Failed to import book:', {
          error: (error as Error).message,
          rowNumber,
        });
        skipped++;
      }
    });

    // Wait for all async operations to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log(`✅ Books imported: ${imported}, skipped: ${skipped}`);
    return { imported, skipped };
  } catch (error) {
    console.error('❌ Failed to import books from Excel:', error);
    throw error;
  }
}

async function createDefaultEquipment() {
  try {
    console.log('🖥️  Creating default equipment...');

    const equipment = [
      // Student Computers
      {
        equipmentId: 'COMP-01',
        name: 'Student Computer 1',
        type: EquipmentType.COMPUTER,
        location: 'Main Floor',
        status: EquipmentStatus.AVAILABLE,
        maxTimeMinutes: 60,
      },
      {
        equipmentId: 'COMP-02',
        name: 'Student Computer 2',
        type: EquipmentType.COMPUTER,
        location: 'Main Floor',
        status: EquipmentStatus.AVAILABLE,
        maxTimeMinutes: 60,
      },
      {
        equipmentId: 'COMP-03',
        name: 'Student Computer 3',
        type: EquipmentType.COMPUTER,
        location: 'Main Floor',
        status: EquipmentStatus.AVAILABLE,
        maxTimeMinutes: 60,
      },
      // Printer
      {
        equipmentId: 'PRINT-01',
        name: 'Library Printer',
        type: EquipmentType.PRINTER,
        location: 'Main Floor',
        status: EquipmentStatus.AVAILABLE,
        maxTimeMinutes: 15,
      },
      // Recreational Station
      {
        equipmentId: 'REC-01',
        name: 'Recreational Station',
        type: EquipmentType.GAMING,
        location: 'Recreation Area',
        status: EquipmentStatus.AVAILABLE,
        maxTimeMinutes: 30,
      },
    ];

    for (const item of equipment) {
      await prisma.equipment.upsert({
        where: { equipmentId: item.equipmentId },
        update: item,
        create: item,
      });
    }

    console.log(`✅ Created ${equipment.length} equipment items`);
    return equipment.length;
  } catch (error) {
    console.error('❌ Failed to create equipment:', error);
    throw error;
  }
}

async function createAdminUser() {
  try {
    console.log('👤 Creating admin user...');

    const hashedPassword = await bcrypt.hash(
      process.env.ADMIN_PASSWORD || 'librarian123',
      12,
    );

    await prisma.user.upsert({
      where: { username: process.env.ADMIN_USERNAME || 'admin' },
      update: {
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
      },
      create: {
        username: process.env.ADMIN_USERNAME || 'admin',
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
      },
    });

    console.log(
      `✅ Admin user created: ${process.env.ADMIN_USERNAME || 'admin'}`,
    );
  } catch (error) {
    console.error('❌ Failed to create admin user:', error);
    throw error;
  }
}

async function syncToGoogleSheets() {
  try {
    console.log('☁️  Google Sheets sync skipped (service not yet implemented)');
    console.log('⚠️  Google Sheets sync will be available when the service is implemented');
  } catch (error) {
    console.error(
      '⚠️  Google Sheets sync failed (this is optional):',
      (error as Error).message,
    );
  }
}

async function main() {
  console.log('🌱 Starting comprehensive data import...\n');

  try {
    // Clear existing data first (optional - comment out to keep existing)
    console.log('🗑️  Clearing existing data...');
    await prisma.activity.deleteMany();
    await prisma.equipmentSession.deleteMany();
    await prisma.bookCheckout.deleteMany();
    await prisma.student.deleteMany();
    await prisma.book.deleteMany();
    await prisma.equipment.deleteMany();
    await prisma.user.deleteMany();
    console.log('✅ Existing data cleared\n');

    // Import data
    const studentsResult = await importStudentsFromJSON();
    const booksResult = await importBooksFromExcel();
    const equipmentCount = await createDefaultEquipment();
    await createAdminUser();

    console.log('\n📊 Import Summary:');
    console.log(
      `  Students: ${studentsResult.imported} imported, ${studentsResult.skipped} skipped`,
    );
    console.log(
      `  Books: ${booksResult.imported} imported, ${booksResult.skipped} skipped`,
    );
    console.log(`  Equipment: ${equipmentCount} created`);
    console.log(`  Admin user: Created`);

    // Sync to Google Sheets
    console.log('\n');
    await syncToGoogleSheets();

    console.log('\n✅ All data imported successfully!');
    console.log('\nYou can now:');
    console.log('  1. Start the backend: npm run dev');
    console.log('  2. View the data in Prisma Studio: npm run db:studio');
    console.log('  3. Generate barcodes: npm run generate:barcodes');
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
