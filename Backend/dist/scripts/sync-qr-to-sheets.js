"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const google_spreadsheet_1 = require("google-spreadsheet");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const prisma = new client_1.PrismaClient();
async function uploadQRToGoogleSheets() {
    console.log('📤 Starting QR Code upload to Google Sheets...\n');
    try {
        const SHEET_ID = process.env.GOOGLE_SHEET_ID;
        if (!SHEET_ID) {
            throw new Error('GOOGLE_SHEET_ID not found in environment variables');
        }
        const doc = new google_spreadsheet_1.GoogleSpreadsheet(SHEET_ID);
        const credsPath = path.join(process.cwd(), '..', 'google-credentials.json');
        if (!fs.existsSync(credsPath)) {
            throw new Error(`Credentials file not found at: ${credsPath}`);
        }
        const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
        await doc.useServiceAccountAuth(creds);
        await doc.loadInfo();
        console.log(`📊 Connected to sheet: ${doc.title}\n`);
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
        }
        else {
            console.log('📄 Using existing "Student QR Codes" sheet\n');
            await qrSheet.clearRows();
        }
        const students = await prisma.students.findMany({
            where: { is_active: true },
            orderBy: { student_id: 'asc' },
        });
        console.log(`👥 Found ${students.length} students\n`);
        const rows = students.map(student => ({
            'Student ID': student.student_id,
            'Full Name': `${student.first_name} ${student.last_name}`,
            'Grade Level': student.grade_level,
            Section: student.section || 'N/A',
            Status: student.is_active ? 'Active' : 'Inactive',
            'QR Code Generated': student.barcode_image ? 'Yes' : 'No',
            'QR Code Path': student.barcode_image || 'Not generated',
            'QR Code URL': student.barcode_image
                ? `file:///${student.barcode_image.replace(/\\/g, '/')}`
                : 'N/A',
            'Last Updated': new Date().toISOString(),
        }));
        await qrSheet.addRows(rows);
        console.log('✅ Successfully uploaded QR code information to Google Sheets!\n');
        console.log(`📊 Sheet ID: ${SHEET_ID}`);
        console.log(`📄 Tab: Student QR Codes\n`);
        await qrSheet.loadCells();
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
    }
    catch (error) {
        console.error('❌ Error uploading to Google Sheets:', error);
        throw error;
    }
    finally {
        await prisma.$disconnect();
    }
}
async function generateStudentIDCards() {
    console.log('\n📇 Generating Student ID Cards with QR Codes...\n');
    const students = await prisma.students.findMany({
        where: { is_active: true },
        orderBy: { student_id: 'asc' },
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
        .map(student => `
      <div class="id-card id-card-front">
        <div class="id-card-left">
          <div class="school-logo">📚 SHJCS</div>
          <div class="student-info">
            <h2>${student.first_name} ${student.last_name}</h2>
            <p>${student.grade_level}</p>
            <p>Section: ${student.section || 'N/A'}</p>
            <div class="student-id-number">${student.student_id}</div>
          </div>
        </div>
        <div class="id-card-right">
          <div class="qr-code-container">
            <img src="students/${student.student_id}.png" alt="QR Code">
            <div class="qr-label">SCAN ME</div>
          </div>
        </div>
      </div>
    `)
        .join('')}
  </div>
</body>
</html>
  `;
    const qrDir = path.join(process.cwd(), 'qr-codes');
    const htmlPath = path.join(qrDir, 'student-id-cards.html');
    fs.writeFileSync(htmlPath, html);
    console.log(`✅ ID Cards generated: ${htmlPath}`);
    console.log(`   Open this file to view and print professional student ID cards\n`);
}
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
