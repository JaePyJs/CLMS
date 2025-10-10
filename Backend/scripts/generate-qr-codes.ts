import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import QRCode from 'qrcode';

const prisma = new PrismaClient();

interface QRGenerationResult {
  studentId: string;
  name: string;
  qrPath: string;
  success: boolean;
  error?: string;
}

async function generateQRCodes() {
  console.log('🎨 Starting QR Code Generation for Students...\n');

  // Create output directory
  const qrDir = path.join(process.cwd(), 'qr-codes', 'students');
  if (!fs.existsSync(qrDir)) {
    fs.mkdirSync(qrDir, { recursive: true });
    console.log(`📁 Created directory: ${qrDir}\n`);
  }

  try {
    // Fetch all active students
    const students = await prisma.student.findMany({
      where: { isActive: true },
      orderBy: { studentId: 'asc' },
    });

    console.log(`📊 Found ${students.length} active students\n`);

    const results: QRGenerationResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Generate QR code for each student
    for (const student of students) {
      try {
        // QR code data format: StudentID or full JSON
        const qrData = student.studentId; // Simple format - just the ID

        // Alternative: Include more data in QR code
        // const qrData = JSON.stringify({
        //   id: student.studentId,
        //   name: `${student.firstName} ${student.lastName}`,
        //   grade: student.gradeLevel,
        //   type: 'student'
        // });

        // Generate filename
        const fileName = `${student.studentId}.png`;
        const filePath = path.join(qrDir, fileName);

        // Generate QR code with options
        await QRCode.toFile(filePath, qrData, {
          type: 'png',
          width: 300,
          margin: 2,
          color: {
            dark: '#000000', // Black dots
            light: '#FFFFFF', // White background
          },
          errorCorrectionLevel: 'H', // High error correction
        });

        // Update database with QR code path
        await prisma.student.update({
          where: { id: student.id },
          data: { barcodeImage: filePath },
        });

        results.push({
          studentId: student.studentId,
          name: `${student.firstName} ${student.lastName}`,
          qrPath: filePath,
          success: true,
        });

        successCount++;

        // Progress indicator
        if (successCount % 50 === 0) {
          console.log(`✅ Generated ${successCount} QR codes...`);
        }
      } catch (error) {
        errorCount++;
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        results.push({
          studentId: student.studentId,
          name: `${student.firstName} ${student.lastName}`,
          qrPath: '',
          success: false,
          error: errorMessage,
        });

        console.error(
          `❌ Error generating QR for ${student.studentId}: ${errorMessage}`,
        );
      }
    }

    // Generate summary report
    console.log('\n' + '='.repeat(60));
    console.log('📋 QR CODE GENERATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully generated: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`📁 Output directory: ${qrDir}`);
    console.log('='.repeat(60) + '\n');

    // Save detailed report
    const reportPath = path.join(qrDir, '_generation-report.json');
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          totalStudents: students.length,
          successCount,
          errorCount,
          results,
        },
        null,
        2,
      ),
    );

    console.log(`📄 Detailed report saved: ${reportPath}\n`);

    // Generate printable HTML sheet
    await generatePrintableSheet(students, qrDir);

    console.log('✨ QR Code generation complete!\n');
  } catch (error) {
    console.error('💥 Error during QR code generation:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function generatePrintableSheet(students: any[], qrDir: string) {
  console.log('📄 Generating printable QR code sheet...\n');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Student QR Codes - CLMS</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      background: #f5f5f5;
    }
    
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding: 20px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .header h1 {
      color: #2563eb;
      margin-bottom: 10px;
    }
    
    .header p {
      color: #64748b;
    }
    
    .qr-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .qr-card {
      background: white;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      padding: 15px;
      text-align: center;
      page-break-inside: avoid;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      transition: transform 0.2s;
    }
    
    .qr-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    
    .qr-card img {
      width: 200px;
      height: 200px;
      margin: 10px auto;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
    }
    
    .student-id {
      font-size: 18px;
      font-weight: bold;
      color: #1e293b;
      margin: 10px 0 5px;
    }
    
    .student-name {
      font-size: 14px;
      color: #64748b;
      margin-bottom: 5px;
    }
    
    .student-grade {
      font-size: 12px;
      color: #94a3b8;
      background: #f1f5f9;
      padding: 4px 8px;
      border-radius: 4px;
      display: inline-block;
    }
    
    @media print {
      body {
        background: white;
        padding: 10px;
      }
      
      .qr-grid {
        grid-template-columns: repeat(3, 1fr);
        gap: 15px;
      }
      
      .qr-card {
        box-shadow: none;
        border: 1px solid #000;
      }
      
      .header {
        box-shadow: none;
      }
    }
    
    .footer {
      text-align: center;
      margin-top: 30px;
      padding: 20px;
      background: white;
      border-radius: 8px;
      color: #64748b;
      font-size: 12px;
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
    
    @media print {
      .print-button {
        display: none;
      }
    }
  </style>
</head>
<body>
  <button class="print-button" onclick="window.print()">🖨️ Print QR Codes</button>
  
  <div class="header">
    <h1>📚 Student QR Codes</h1>
    <p>Sacred Heart of Jesus Catholic School - Library Management System</p>
    <p>Generated: ${new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}</p>
    <p><strong>${students.length}</strong> Active Students</p>
  </div>
  
  <div class="qr-grid">
    ${students
      .map(
        student => `
      <div class="qr-card">
        <img src="${student.studentId}.png" alt="QR Code for ${student.studentId}">
        <div class="student-id">${student.studentId}</div>
        <div class="student-name">${student.firstName} ${student.lastName}</div>
        <div class="student-grade">${student.gradeLevel}</div>
      </div>
    `,
      )
      .join('')}
  </div>
  
  <div class="footer">
    <p>© ${new Date().getFullYear()} Sacred Heart of Jesus Catholic School</p>
    <p>Scan these QR codes using the CLMS Scanner to quickly check in students</p>
  </div>
</body>
</html>
  `;

  const htmlPath = path.join(qrDir, 'index.html');
  fs.writeFileSync(htmlPath, html);

  console.log(`✅ Printable sheet generated: ${htmlPath}`);
  console.log(
    `   Open this file in a browser to view and print all QR codes\n`,
  );
}

// Run the generator
generateQRCodes()
  .then(() => {
    console.log('✅ All done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Generation failed:', error);
    process.exit(1);
  });
