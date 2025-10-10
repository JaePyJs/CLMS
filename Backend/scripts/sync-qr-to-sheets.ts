import { PrismaClient } from '@prisma/client';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function uploadQRToGoogleSheets() {
  console.log('📤 Starting QR Code upload to Google Sheets...\n');

  try {
    // Initialize Google Sheets
    const SHEET_ID = process.env.GOOGLE_SHEET_ID;
    if (!SHEET_ID) {
      throw new Error('GOOGLE_SHEET_ID not found in environment variables');
    }

    const doc = new GoogleSpreadsheet(SHEET_ID);

    // Load credentials
    const credsPath = path.join(process.cwd(), '..', 'google-credentials.json');
    if (!fs.existsSync(credsPath)) {
      throw new Error(`Credentials file not found at: ${credsPath}`);
    }

    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
    await doc.useServiceAccountAuth(creds);
    await doc.loadInfo();

    console.log(`📊 Connected to sheet: ${doc.title}\n`);

    // Get or create QR Codes sheet
    let qrSheet = doc.sheetsByTitle['Student QR Codes'];

    if (!qrSheet) {
      console.log('📄 Creating new "Student QR Codes" sheet...');
      qrSheet = await doc.addSheet({
        title: 'Student QR Codes',
        headerValues: [
          'Student ID',
          'Full Name',
          'Grade Level',
          'Section',
          'Status',
          'QR Code Generated',
          'QR Code Path',
          'QR Code URL',
          'Last Updated',
        ],
      });
      console.log('✅ Sheet created\n');
    } else {
      console.log('📄 Using existing "Student QR Codes" sheet\n');
      // Clear existing data (keep headers)
      await qrSheet.clearRows();
    }

    // Fetch students with QR codes
    const students = await prisma.student.findMany({
      where: { isActive: true },
      orderBy: { studentId: 'asc' },
    });

    console.log(`👥 Found ${students.length} students\n`);

    const rows = students.map(student => ({
      'Student ID': student.studentId,
      'Full Name': `${student.firstName} ${student.lastName}`,
      'Grade Level': student.gradeLevel,
      Section: student.section || 'N/A',
      Status: student.isActive ? 'Active' : 'Inactive',
      'QR Code Generated': student.barcodeImage ? 'Yes' : 'No',
      'QR Code Path': student.barcodeImage || 'Not generated',
      'QR Code URL': student.barcodeImage
        ? `file:///${student.barcodeImage.replace(/\\/g, '/')}`
        : 'N/A',
      'Last Updated': new Date().toISOString(),
    }));

    // Add rows to sheet
    await qrSheet.addRows(rows);

    console.log(
      '✅ Successfully uploaded QR code information to Google Sheets!\n',
    );
    console.log(`📊 Sheet ID: ${SHEET_ID}`);
    console.log(`📄 Tab: Student QR Codes\n`);

    // Format the sheet
    await qrSheet.loadCells();

    // Format header row
    const headerRange = `A1:I1`;
    await qrSheet.loadCells(headerRange);

    for (let col = 0; col < 9; col++) {
      const cell = qrSheet.getCell(0, col);
      cell.textFormat = { bold: true };
      cell.backgroundColor = { red: 0.2, green: 0.4, blue: 0.8, alpha: 1 };
      cell.textFormat = {
        ...cell.textFormat,
        foregroundColor: { red: 1, green: 1, blue: 1, alpha: 1 },
      };
    }

    await qrSheet.saveUpdatedCells();

    console.log('✨ Formatting applied!\n');
  } catch (error) {
    console.error('❌ Error uploading to Google Sheets:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Create a comprehensive student ID card generator
async function generateStudentIDCards() {
  console.log('\n📇 Generating Student ID Cards with QR Codes...\n');

  const students = await prisma.student.findMany({
    where: { isActive: true },
    orderBy: { studentId: 'asc' },
  });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Student ID Cards - CLMS</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      padding: 20px;
      background: #f0f4f8;
    }
    
    .print-button {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #2563eb;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      z-index: 1000;
    }
    
    .print-button:hover {
      background: #1d4ed8;
    }
    
    .id-cards-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .id-card {
      width: 100%;
      height: 200px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      padding: 20px;
      color: white;
      position: relative;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      page-break-inside: avoid;
      display: flex;
      justify-content: space-between;
    }
    
    .id-card-front {
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
    }
    
    .id-card-left {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    
    .id-card-right {
      display: flex;
      align-items: center;
      padding-left: 15px;
    }
    
    .school-logo {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    
    .student-photo {
      width: 80px;
      height: 80px;
      background: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      color: #2563eb;
      margin-bottom: 10px;
    }
    
    .student-info h2 {
      font-size: 18px;
      margin-bottom: 5px;
      text-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    
    .student-info p {
      font-size: 12px;
      opacity: 0.9;
      margin: 2px 0;
    }
    
    .student-id-number {
      font-size: 20px;
      font-weight: bold;
      background: rgba(255,255,255,0.2);
      padding: 5px 10px;
      border-radius: 4px;
      display: inline-block;
      margin-top: 5px;
    }
    
    .qr-code-container {
      background: white;
      padding: 8px;
      border-radius: 8px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    }
    
    .qr-code-container img {
      width: 120px;
      height: 120px;
      display: block;
    }
    
    .qr-label {
      text-align: center;
      font-size: 10px;
      color: #1e40af;
      margin-top: 4px;
      font-weight: bold;
    }
    
    @media print {
      body {
        background: white;
      }
      
      .print-button {
        display: none;
      }
      
      .id-cards-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
      }
      
      .id-card {
        box-shadow: none;
        border: 1px solid #ddd;
      }
    }
    
    @page {
      size: A4;
      margin: 10mm;
    }
  </style>
</head>
<body>
  <button class="print-button" onclick="window.print()">🖨️ Print ID Cards</button>
  
  <div class="id-cards-grid">
    ${students
      .map(
        student => `
      <div class="id-card id-card-front">
        <div class="id-card-left">
          <div class="school-logo">📚 SHJCS</div>
          <div class="student-info">
            <h2>${student.firstName} ${student.lastName}</h2>
            <p>${student.gradeLevel}</p>
            <p>Section: ${student.section || 'N/A'}</p>
            <div class="student-id-number">${student.studentId}</div>
          </div>
        </div>
        <div class="id-card-right">
          <div class="qr-code-container">
            <img src="students/${student.studentId}.png" alt="QR Code">
            <div class="qr-label">SCAN ME</div>
          </div>
        </div>
      </div>
    `,
      )
      .join('')}
  </div>
</body>
</html>
  `;

  const qrDir = path.join(process.cwd(), 'qr-codes');
  const htmlPath = path.join(qrDir, 'student-id-cards.html');
  fs.writeFileSync(htmlPath, html);

  console.log(`✅ ID Cards generated: ${htmlPath}`);
  console.log(
    `   Open this file to view and print professional student ID cards\n`,
  );
}

// Run both functions
uploadQRToGoogleSheets()
  .then(() => generateStudentIDCards())
  .then(() => {
    console.log('✅ All tasks completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Task failed:', error);
    process.exit(1);
  });
