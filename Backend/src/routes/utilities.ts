import { Router, Request, Response } from 'express';
import { ApiResponse } from '@/types';
import { qrCodeService } from '@/services/qrCodeService';
import { barcodeService } from '@/services/barcodeService';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

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
      ],
    },
    timestamp: new Date().toISOString(),
  };
  res.json(response);
});

export default router;
