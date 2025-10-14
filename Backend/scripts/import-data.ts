import {
  PrismaClient,
  students_grade_category,
  equipment_type,
  equipment_status,
} from '@prisma/client';
import ExcelJS from 'exceljs';
import { readFileSync } from 'fs';
import { join } from 'path';
import bcrypt from 'bcryptjs';
// import { logger } from '@/utils/logger';

const prisma = new PrismaClient();

// Grade category mapping
function mapGradeCategory(grade_level: string): students_grade_category {
  const level = grade_level.toLowerCase();
  if (
    level.includes('k-') ||
    level.includes('kindergarten') ||
    level.includes('grade 1') ||
    level.includes('grade 2') ||
    level.includes('grade 3')
  ) {
    return students_grade_category.PRIMARY;
  } else if (
    level.includes('grade 4') ||
    level.includes('grade 5') ||
    level.includes('grade 6')
  ) {
    return students_grade_category.GRADE_SCHOOL;
  } else if (
    level.includes('grade 7') ||
    level.includes('grade 8') ||
    level.includes('grade 9') ||
    level.includes('grade 10')
  ) {
    return students_grade_category.JUNIOR_HIGH;
  } else if (level.includes('grade 11') || level.includes('grade 12')) {
    return students_grade_category.SENIOR_HIGH;
  }
  return students_grade_category.GRADE_SCHOOL; // default
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

        const student_id = String(student['User id']);
        const fullName = student.Full_Name || 'Unknown Unknown';

        // Parse name (format: "LastName, FirstName MiddleInitial.")
        const nameParts = fullName.split(',').map((s: string) => s.trim());
        const lastName = nameParts[0] || 'Unknown';
        const firstNameParts = (nameParts[1] || 'Unknown').split(' ');
        const firstName = firstNameParts[0] || 'Unknown';

        const gradeLevel = student.Grade_Level || 'Unknown';
        const schoolLevel = student.School_Level || 'Unknown';

        // Map school level to grade category
        let grade_category: students_grade_category = students_grade_category.GRADE_SCHOOL;
        if (schoolLevel.includes('Senior High')) {
          grade_category = students_grade_category.SENIOR_HIGH;
        } else if (
          schoolLevel.includes('Junior') ||
          schoolLevel.includes('High School (Junior)')
        ) {
          grade_category = students_grade_category.JUNIOR_HIGH;
        } else if (
          gradeLevel.includes('Grade 4') ||
          gradeLevel.includes('Grade 5') ||
          gradeLevel.includes('Grade 6')
        ) {
          grade_category = students_grade_category.GRADE_SCHOOL;
        } else if (
          gradeLevel.includes('Grade 1') ||
          gradeLevel.includes('Grade 2') ||
          gradeLevel.includes('Grade 3') ||
          gradeLevel.includes('K-')
        ) {
          grade_category = students_grade_category.PRIMARY;
        }

        await prisma.students.upsert({
          where: { student_id },
          update: {
            first_name: firstName,
            last_name: lastName,
            grade_level: gradeLevel,
            grade_category,
            is_active: true,
          },
          create: {
            id: crypto.randomUUID(),
            student_id,
            first_name: firstName,
            last_name: lastName,
            grade_level: gradeLevel,
            grade_category,
            is_active: true,
            updated_at: new Date(),
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

        await prisma.books.upsert({
          where: { accession_no: accessionNo },
          update: {
            isbn,
            title,
            author,
            publisher,
            category,
            subcategory,
            location,
            total_copies: totalCopies,
            available_copies: totalCopies,
            is_active: true,
          },
          create: {
            id: crypto.randomUUID(),
            accession_no: accessionNo,
            isbn,
            title,
            author,
            publisher,
            category,
            subcategory,
            location,
            total_copies: totalCopies,
            available_copies: totalCopies,
            is_active: true,
            updated_at: new Date(),
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
        equipment_id: 'COMP-01',
        name: 'Student Computer 1',
        type: equipment_type.COMPUTER,
        location: 'Main Floor',
        status: equipment_status.AVAILABLE,
        max_time_minutes: 60,
      },
      {
        equipment_id: 'COMP-02',
        name: 'Student Computer 2',
        type: equipment_type.COMPUTER,
        location: 'Main Floor',
        status: equipment_status.AVAILABLE,
        max_time_minutes: 60,
      },
      {
        equipment_id: 'COMP-03',
        name: 'Student Computer 3',
        type: equipment_type.COMPUTER,
        location: 'Main Floor',
        status: equipment_status.AVAILABLE,
        max_time_minutes: 60,
      },
      // Printer
      {
        equipment_id: 'PRINT-01',
        name: 'Library Printer',
        type: equipment_type.PRINTER,
        location: 'Main Floor',
        status: equipment_status.AVAILABLE,
        max_time_minutes: 15,
      },
      // Recreational Station
      {
        equipment_id: 'REC-01',
        name: 'Recreational Station',
        type: equipment_type.GAMING,
        location: 'Recreation Area',
        status: equipment_status.AVAILABLE,
        max_time_minutes: 30,
      },
    ];

    for (const item of equipment) {
      await prisma.equipment.upsert({
        where: { equipment_id: item.equipment_id },
        update: item,
        create: {
          ...item,
          id: crypto.randomUUID(),
          updated_at: new Date(),
        },
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

    await prisma.users.upsert({
      where: { username: process.env.ADMIN_USERNAME || 'admin' },
      update: {
        password: hashedPassword,
        role: 'ADMIN',
        is_active: true,
      },
      create: {
        id: crypto.randomUUID(),
        username: process.env.ADMIN_USERNAME || 'admin',
        password: hashedPassword,
        role: 'ADMIN',
        is_active: true,
        updated_at: new Date(),
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
    await prisma.student_activities.deleteMany();
    await prisma.equipment_sessions.deleteMany();
    await prisma.book_checkouts.deleteMany();
    await prisma.students.deleteMany();
    await prisma.books.deleteMany();
    await prisma.equipment.deleteMany();
    await prisma.users.deleteMany();
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
