const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const mysql = require('mysql2/promise');

// Database connection config
const dbConfig = {
  host: 'localhost',
  port: 3308,
  user: 'clms_user',
  password: 'clms_password',
  database: 'clms_database',
};

async function verifyAndImportAllData() {
  let connection;
  
  try {
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');

    // Read Students CSV
    console.log('\n📚 Reading Students CSV...');
    const studentsCSV = fs.readFileSync(
      path.join(__dirname, '../csv/SHJCS SCANLOGS - SHJCS USERS.csv'),
      'utf-8'
    );
    const studentsData = parse(studentsCSV, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    console.log(`📊 CSV contains ${studentsData.length} students`);

    // Get existing students from DB
    const [existingStudents] = await connection.query(
      'SELECT student_id FROM students'
    );
    const existingIds = new Set(existingStudents.map(s => s.student_id));
    console.log(`📊 Database contains ${existingIds.size} students`);

    // Find missing students
    const missingStudents = studentsData.filter(
      student => !existingIds.has(student['User ID'])
    );
    
    console.log(`\n❌ Missing ${missingStudents.length} students in database:`);
    missingStudents.forEach((student, idx) => {
      console.log(`  ${idx + 1}. ${student['User ID']} - ${student['First Name']} ${student['Surname']} (${student['Grade Level']} - ${student['Section']})`);
    });

    // Import missing students
    if (missingStudents.length > 0) {
      console.log(`\n📥 Importing ${missingStudents.length} missing students...`);
      let imported = 0;
      let failed = 0;

      for (const student of missingStudents) {
        try {
          const gradeLevel = parseInt(student['Grade Level']) || 0;
          const studentId = student['User ID'];
          const firstName = student['First Name'] || 'Unknown';
          const lastName = student['Surname'] || 'Unknown';
          const section = student['Section'] || '';
          const barcode = studentId; // Use student ID as barcode

          await connection.query(
            `INSERT INTO students 
            (id, student_id, first_name, last_name, grade_level, section, barcode, is_active, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
              `student_${studentId}_${Date.now()}`,
              studentId,
              firstName,
              lastName,
              gradeLevel,
              section,
              barcode,
              1
            ]
          );
          imported++;
          console.log(`  ✅ Imported: ${studentId} - ${firstName} ${lastName}`);
        } catch (error) {
          failed++;
          console.error(`  ❌ Failed: ${student['User ID']} - ${error.message}`);
        }
      }

      console.log(`\n✅ Import complete: ${imported} successful, ${failed} failed`);
    } else {
      console.log('\n✅ All students are already in the database!');
    }

    // Verify final count
    const [finalCount] = await connection.query('SELECT COUNT(*) as count FROM students');
    console.log(`\n📊 Final student count: ${finalCount[0].count}`);

    // Check Books
    console.log('\n\n📚 Checking Books...');
    const booksCSV = fs.readFileSync(
      path.join(__dirname, '../csv/SHJCS Bibliography - BOOK COLLECTIONS.csv'),
      'utf-8'
    );
    const booksData = parse(booksCSV, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    console.log(`📊 CSV contains ${booksData.length} books`);

    const [booksCount] = await connection.query('SELECT COUNT(*) as count FROM books');
    console.log(`📊 Database contains ${booksCount[0].count} books`);
    
    const booksDiff = booksData.length - booksCount[0].count;
    if (booksDiff > 0) {
      console.log(`❌ Missing ${booksDiff} books in database`);
    } else {
      console.log('✅ All books are in the database!');
    }

    // Check for students without barcodes
    console.log('\n\n🔍 Checking for students without barcodes...');
    const [noBarcodeStudents] = await connection.query(
      'SELECT student_id, first_name, last_name FROM students WHERE barcode IS NULL OR barcode = ""'
    );

    if (noBarcodeStudents.length > 0) {
      console.log(`❌ Found ${noBarcodeStudents.length} students without barcodes:`);
      noBarcodeStudents.forEach((s, idx) => {
        console.log(`  ${idx + 1}. ${s.student_id} - ${s.first_name} ${s.last_name}`);
      });

      console.log('\n🔧 Generating barcodes for students without them...');
      for (const student of noBarcodeStudents) {
        await connection.query(
          'UPDATE students SET barcode = ? WHERE student_id = ?',
          [student.student_id, student.student_id]
        );
        console.log(`  ✅ Generated barcode for ${student.student_id}`);
      }
    } else {
      console.log('✅ All students have barcodes!');
    }

    // Summary
    console.log('\n\n═══════════════════════════════════');
    console.log('📊 FINAL SUMMARY');
    console.log('═══════════════════════════════════');
    
    const [finalStudents] = await connection.query('SELECT COUNT(*) as count FROM students');
    const [finalBooks] = await connection.query('SELECT COUNT(*) as count FROM books');
    const [studentsWithBarcode] = await connection.query(
      'SELECT COUNT(*) as count FROM students WHERE barcode IS NOT NULL AND barcode != ""'
    );

    console.log(`Students in CSV:       ${studentsData.length}`);
    console.log(`Students in Database:  ${finalStudents[0].count}`);
    console.log(`Students with Barcode: ${studentsWithBarcode[0].count}`);
    console.log(`\nBooks in CSV:          ${booksData.length}`);
    console.log(`Books in Database:     ${finalBooks[0].count}`);
    console.log('═══════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the script
verifyAndImportAllData()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
