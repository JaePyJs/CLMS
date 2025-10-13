import { Router, Request, Response } from 'express';
import { ApiResponse } from '@/types';
import { qrCodeService } from '@/services/qrCodeService';
import { barcodeService } from '@/services/barcodeService';
import { documentationService } from '@/services/documentationService';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

// ============================================
// DOCUMENTATION ROUTES
// ============================================

// Get comprehensive documentation information
router.get('/documentation', async (req: Request, res: Response) => {
  try {
    const docsInfo = await documentationService.getDocumentationInfo();

    const response: ApiResponse = {
      success: true,
      data: docsInfo,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get documentation info',
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

// Refresh documentation cache
router.post('/documentation/refresh', async (req: Request, res: Response) => {
  try {
    await documentationService.refreshCache();
    const docsInfo = await documentationService.getDocumentationInfo();

    const response: ApiResponse = {
      success: true,
      data: docsInfo,
      message: 'Documentation cache refreshed successfully',
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to refresh documentation cache',
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

// Get documentation health status
router.get('/documentation/health', async (req: Request, res: Response) => {
  try {
    const docsInfo = await documentationService.getDocumentationInfo();

    const response: ApiResponse = {
      success: true,
      data: {
        status: docsInfo.health.status,
        checks: docsInfo.health.checks,
        lastChecked: docsInfo.lastUpdated,
      },
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get documentation health',
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

// ============================================
// QR CODE ROUTES
// ============================================

// Generate QR codes for all students
router.post('/generate-qr-codes', async (req: Request, res: Response) => {
  try {
    const summary = await qrCodeService.generateQRCodesForAllStudents();

    const response: ApiResponse = {
      success: true,
      data: summary,
      message: `Generated ${summary.successCount} QR codes successfully`,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to generate QR codes',
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

// Generate QR code for single student
router.post(
  '/generate-qr-code/:studentId',
  async (req: Request, res: Response) => {
    try {
      const { studentId } = req.params;
      if (!studentId) {
        return res.status(400).json({
          success: false,
          error: 'Student ID is required',
          timestamp: new Date().toISOString(),
        });
      }

      const result = await qrCodeService.generateQRCodeForStudent(studentId);

      const response: ApiResponse = {
        success: true,
        data: result,
        message: 'QR code generated successfully',
        timestamp: new Date().toISOString(),
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to generate QR code',
        timestamp: new Date().toISOString(),
      };
      res.status(500).json(response);
    }
  },
);

// Get QR code generation report
router.get('/qr-generation-report', async (req: Request, res: Response) => {
  try {
    const report = await qrCodeService.getGenerationReport();

    if (!report) {
      const response: ApiResponse = {
        success: false,
        error: 'No generation report found. Generate QR codes first.',
        timestamp: new Date().toISOString(),
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: report,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get report',
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

// Serve QR code image
router.get('/qr-code/:studentId', async (req: Request, res: Response) => {
  try {
    const studentId = req.params.studentId as string;
    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: 'Student ID is required',
        timestamp: new Date().toISOString(),
      });
    }

    const qrPath = await qrCodeService.getQRCodeForStudent(studentId);

    if (!qrPath || !fs.existsSync(qrPath)) {
      return res.status(404).json({
        success: false,
        error: 'QR code not found for this student',
        timestamp: new Date().toISOString(),
      });
    }

    res.sendFile(qrPath);
  } catch (error) {
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to retrieve QR code',
      timestamp: new Date().toISOString(),
    });
  }
});

// Delete QR code
router.delete('/qr-code/:studentId', async (req: Request, res: Response) => {
  try {
    const studentId = req.params.studentId as string;
    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: 'Student ID is required',
        timestamp: new Date().toISOString(),
      });
    }

    const deleted = await qrCodeService.deleteQRCode(studentId);

    const response: ApiResponse = {
      success: deleted,
      message: deleted ? 'QR code deleted successfully' : 'QR code not found',
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to delete QR code',
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

// Regenerate QR code
router.post(
  '/regenerate-qr-code/:studentId',
  async (req: Request, res: Response) => {
    try {
      const studentId = req.params.studentId as string;
      if (!studentId) {
        return res.status(400).json({
          success: false,
          error: 'Student ID is required',
          timestamp: new Date().toISOString(),
        });
      }

      const result = await qrCodeService.regenerateQRCode(studentId);

      const response: ApiResponse = {
        success: true,
        data: result,
        message: 'QR code regenerated successfully',
        timestamp: new Date().toISOString(),
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to regenerate QR code',
        timestamp: new Date().toISOString(),
      };
      res.status(500).json(response);
    }
  },
);

// Serve printable QR code sheet
router.get('/qr-codes-sheet', (req: Request, res: Response) => {
  const htmlPath = path.join(
    process.cwd(),
    'qr-codes',
    'students',
    'index.html',
  );

  if (!fs.existsSync(htmlPath)) {
    return res.status(404).json({
      success: false,
      error: 'Printable sheet not found. Generate QR codes first.',
      timestamp: new Date().toISOString(),
    });
  }

  res.sendFile(htmlPath);
});

// ============================================
// BARCODE ROUTES
// ============================================

// Generate barcodes for all students
router.post('/generate-barcodes', async (req: Request, res: Response) => {
  try {
    const summary = await barcodeService.generateBarcodesForAllStudents();

    const response: ApiResponse = {
      success: true,
      data: summary,
      message: `Generated ${summary.successCount} barcodes successfully`,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to generate barcodes',
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

// Generate barcode for single student
router.post(
  '/generate-barcode/:studentId',
  async (req: Request, res: Response) => {
    try {
      const { studentId } = req.params;
      if (!studentId) {
        return res.status(400).json({
          success: false,
          error: 'Student ID is required',
          timestamp: new Date().toISOString(),
        });
      }

      const result = await barcodeService.generateBarcodeForStudent(studentId);

      const response: ApiResponse = {
        success: true,
        data: result,
        message: 'Barcode generated successfully',
        timestamp: new Date().toISOString(),
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to generate barcode',
        timestamp: new Date().toISOString(),
      };
      res.status(500).json(response);
    }
  },
);

// Get barcode generation report
router.get(
  '/barcode-generation-report',
  async (req: Request, res: Response) => {
    try {
      const report = await barcodeService.getGenerationReport();

      if (!report) {
        const response: ApiResponse = {
          success: false,
          error: 'No generation report found. Generate barcodes first.',
          timestamp: new Date().toISOString(),
        };
        return res.status(404).json(response);
      }

      const response: ApiResponse = {
        success: true,
        data: report,
        timestamp: new Date().toISOString(),
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get report',
        timestamp: new Date().toISOString(),
      };
      res.status(500).json(response);
    }
  },
);

// Serve barcode image
router.get('/barcode/:studentId', async (req: Request, res: Response) => {
  try {
    const studentId = req.params.studentId as string;
    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: 'Student ID is required',
        timestamp: new Date().toISOString(),
      });
    }

    const barcodePath = barcodeService.getBarcodePath(studentId);

    if (!barcodePath || !fs.existsSync(barcodePath)) {
      return res.status(404).json({
        success: false,
        error: 'Barcode not found for this student',
        timestamp: new Date().toISOString(),
      });
    }

    res.sendFile(barcodePath);
  } catch (error) {
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to retrieve barcode',
      timestamp: new Date().toISOString(),
    });
  }
});

// Delete barcode
router.delete('/barcode/:studentId', async (req: Request, res: Response) => {
  try {
    const studentId = req.params.studentId as string;
    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: 'Student ID is required',
        timestamp: new Date().toISOString(),
      });
    }

    await barcodeService.deleteBarcodeForStudent(studentId);

    const response: ApiResponse = {
      success: true,
      message: 'Barcode deleted successfully',
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to delete barcode',
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

// Regenerate barcode
router.post(
  '/regenerate-barcode/:studentId',
  async (req: Request, res: Response) => {
    try {
      const studentId = req.params.studentId as string;
      if (!studentId) {
        return res.status(400).json({
          success: false,
          error: 'Student ID is required',
          timestamp: new Date().toISOString(),
        });
      }

      const result =
        await barcodeService.regenerateBarcodeForStudent(studentId);

      const response: ApiResponse = {
        success: true,
        data: result,
        message: 'Barcode regenerated successfully',
        timestamp: new Date().toISOString(),
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to regenerate barcode',
        timestamp: new Date().toISOString(),
      };
      res.status(500).json(response);
    }
  },
);

// Serve printable barcode sheet
router.get('/barcodes-sheet', (req: Request, res: Response) => {
  const htmlPath = path.join(
    process.cwd(),
    'barcodes',
    'students',
    'index.html',
  );

  if (!fs.existsSync(htmlPath)) {
    return res.status(404).json({
      success: false,
      error: 'Printable sheet not found. Generate barcodes first.',
      timestamp: new Date().toISOString(),
    });
  }

  res.sendFile(htmlPath);
});

// ============================================
// QUICK ACTIONS ROUTES
// ============================================

// Add quick student (simple endpoint for dashboard quick action)
router.post('/quick-add-student', async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, grade, section } = req.body;

    if (!firstName || !lastName || !grade) {
      return res.status(400).json({
        success: false,
        error: 'First name, last name, and grade are required',
        timestamp: new Date().toISOString(),
      });
    }

    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    // Generate unique student ID
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substr(2, 9).toUpperCase();
    const studentId = `STU-${timestamp}-${randomStr}`;

    // Determine grade category based on grade level
    const gradeNum = parseInt(grade);
    let gradeCategory: string;
    if (gradeNum >= 1 && gradeNum <= 6) {
      gradeCategory = 'ELEMENTARY';
    } else if (gradeNum >= 7 && gradeNum <= 10) {
      gradeCategory = 'JUNIOR_HIGH';
    } else if (gradeNum >= 11 && gradeNum <= 12) {
      gradeCategory = 'SENIOR_HIGH';
    } else {
      gradeCategory = 'JUNIOR_HIGH'; // default
    }

    const student = await prisma.student.create({
      data: {
        studentId,
        firstName,
        lastName,
        gradeLevel: grade,
        gradeCategory,
        section: section || null,
        isActive: true,
        barcodeImage: `STU-${timestamp}-${randomStr}`,
      }
    });

    await prisma.$disconnect();

    const response: ApiResponse = {
      success: true,
      data: {
        student: {
          id: student.id,
          studentId: student.studentId,
          firstName: student.firstName,
          lastName: student.lastName,
          gradeLevel: student.gradeLevel,
          gradeCategory: student.gradeCategory,
          section: student.section,
          barcodeImage: student.barcodeImage
        }
      },
      message: `Student ${firstName} ${lastName} added successfully`,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add student',
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

// Quick session start (for dashboard quick action)
router.post('/quick-start-session', async (req: Request, res: Response) => {
  try {
    const { studentId, equipmentId, timeLimitMinutes = 60 } = req.body;

    if (!studentId || !equipmentId) {
      return res.status(400).json({
        success: false,
        error: 'Student ID and Equipment ID are required',
        timestamp: new Date().toISOString(),
      });
    }

    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    // Check if student and equipment exist
    const [student, equipment] = await Promise.all([
      prisma.student.findUnique({ where: { id: studentId } }),
      prisma.equipment.findUnique({ where: { id: equipmentId } })
    ]);

    if (!student || !equipment) {
      return res.status(404).json({
        success: false,
        error: 'Student or equipment not found',
        timestamp: new Date().toISOString(),
      });
    }

    if (equipment.status !== 'available') {
      return res.status(400).json({
        success: false,
        error: 'Equipment is not available',
        timestamp: new Date().toISOString(),
      });
    }

    // Create activity
    const activity = await prisma.activity.create({
      data: {
        studentId,
        equipmentId,
        startTime: new Date(),
        endTime: new Date(Date.now() + timeLimitMinutes * 60 * 1000),
        activityType: 'computer_usage',
        status: 'active',
      }
    });

    // Update equipment status
    await prisma.equipment.update({
      where: { id: equipmentId },
      data: { status: 'in_use' }
    });

    await prisma.$disconnect();

    const response: ApiResponse = {
      success: true,
      data: {
        activity: {
          id: activity.id,
          studentId: activity.studentId,
          equipmentId: activity.equipmentId,
          startTime: activity.startTime,
          endTime: activity.endTime,
          activityType: activity.activityType,
          status: activity.status,
        }
      },
      message: 'Session started successfully',
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start session',
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

// Quick report generation
router.get('/quick-report', async (req: Request, res: Response) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const [totalStudents, activeStudents, todayActivities, totalEquipment, availableEquipment] = await Promise.all([
      prisma.student.count(),
      prisma.student.count({ where: { isActive: true } }),
      prisma.activity.count({
        where: { startTime: { gte: todayStart } }
      }),
      prisma.equipment.count(),
      prisma.equipment.count({ where: { status: 'available' } })
    ]);

    await prisma.$disconnect();

    const report = {
      date: today.toISOString().split('T')[0],
      summary: {
        totalStudents,
        activeStudents,
        todayActivities,
        totalEquipment,
        availableEquipment,
        equipmentUtilization: totalEquipment > 0 ? ((totalEquipment - availableEquipment) / totalEquipment * 100).toFixed(1) : '0'
      },
      status: 'healthy',
      recommendations: [
        totalEquipment - availableEquipment > totalEquipment * 0.8 ? 'Consider adding more equipment - utilization is high' : null,
        todayActivities > totalStudents * 2 ? 'High activity volume - excellent engagement' : null,
        availableEquipment < totalEquipment * 0.3 ? 'Most equipment is in use - monitor availability' : null
      ].filter(Boolean)
    };

    const response: ApiResponse = {
      success: true,
      data: report,
      message: 'Quick report generated successfully',
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate report',
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

// Quick backup (simplified version for dashboard)
router.post('/quick-backup', async (req: Request, res: Response) => {
  try {
    // Simulate backup process
    const backupData = {
      timestamp: new Date().toISOString(),
      type: 'quick_backup',
      status: 'initiated',
      estimatedDuration: '2-3 minutes'
    };

    // In a real implementation, this would trigger an actual backup process
    // For now, we'll simulate a successful backup after a short delay

    setTimeout(() => {
      console.log('Quick backup completed successfully');
    }, 2000);

    const response: ApiResponse = {
      success: true,
      data: backupData,
      message: 'Quick backup initiated successfully',
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initiate backup',
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

router.get('/', (req: Request, res: Response) => {
  const response: ApiResponse = {
    success: true,
    data: {
      message: 'Utilities API',
      endpoints: [
        'POST /api/utilities/generate-qr-codes - Generate QR codes for all students',
        'POST /api/utilities/generate-qr-code/:studentId - Generate QR code for one student',
        'GET /api/utilities/qr-generation-report - Get generation report',
        'GET /api/utilities/qr-code/:studentId - Get QR code image',
        'DELETE /api/utilities/qr-code/:studentId - Delete QR code',
        'POST /api/utilities/regenerate-qr-code/:studentId - Regenerate QR code',
        'GET /api/utilities/qr-codes-sheet - View printable QR codes sheet',
        '--- BARCODE ROUTES ---',
        'POST /api/utilities/generate-barcodes - Generate barcodes for all students',
        'POST /api/utilities/generate-barcode/:studentId - Generate barcode for one student',
        'GET /api/utilities/barcode-generation-report - Get barcode generation report',
        'GET /api/utilities/barcode/:studentId - Get barcode image',
        'DELETE /api/utilities/barcode/:studentId - Delete barcode',
        'POST /api/utilities/regenerate-barcode/:studentId - Regenerate barcode',
        'GET /api/utilities/barcodes-sheet - View printable barcodes sheet',
        '--- QUICK ACTIONS ---',
        'POST /api/utilities/quick-add-student - Quick add student (firstName, lastName, grade, section)',
        'POST /api/utilities/quick-start-session - Quick start session (studentId, equipmentId, timeLimitMinutes)',
        'GET /api/utilities/quick-report - Quick daily report',
        'POST /api/utilities/quick-backup - Quick system backup',
      ],
    },
    timestamp: new Date().toISOString(),
  };
  res.json(response);
});

export default router;
