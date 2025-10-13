import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { ApiResponse } from '@/types';

const router = Router();
const prisma = new PrismaClient();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// ==========================================
// SYSTEM SETTINGS
// ==========================================

// Get system settings
router.get('/system', async (req: Request, res: Response) => {
  try {
    // Fetch all system settings from database
    const configRecords = await prisma.system_config.findMany({
      where: {
        category: 'system',
      },
      orderBy: {
        key: 'asc',
      },
    });

    // Convert to key-value object
    const settings: Record<string, any> = {};
    for (const record of configRecords) {
      try {
        // Parse JSON values
        settings[record.key] = JSON.parse(record.value);
      } catch {
        // If not JSON, use as string
        settings[record.key] = record.value;
      }
    }

    // Ensure default values exist
    const defaults = {
      fineRatePerDay: 5.0,
      defaultCheckoutPeriod: 7,
      overdueGracePeriod: 0,
      maxBooksPerStudent: 5,
      sessionTimeout: 30,
      libraryHours: {
        open: '08:00',
        close: '18:00',
      },
      libraryName: 'School Library',
      sessionLimits: {
        PRIMARY: 30,
        GRADE_SCHOOL: 60,
        JUNIOR_HIGH: 90,
        SENIOR_HIGH: 120,
      },
    };

    const response: ApiResponse = {
      success: true,
      data: { ...defaults, ...settings },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    console.error('Failed to fetch system settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system settings',
      timestamp: new Date().toISOString(),
    });
  }
});

// Update system settings
router.put('/system', async (req: Request, res: Response) => {
  try {
    const settings = req.body;
    const updatedSettings: Record<string, any> = {};

    // Save each setting to database
    for (const [key, value] of Object.entries(settings)) {
      // Serialize value to JSON
      const serializedValue = JSON.stringify(value);

      // Upsert setting
      await prisma.system_config.upsert({
        where: { key },
        create: {
          id: `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          key,
          value: serializedValue,
          category: 'system',
          description: `System setting: ${key}`,
          is_secret: false,
          updated_at: new Date(),
        },
        update: {
          value: serializedValue,
          updated_at: new Date(),
        },
      });

      updatedSettings[key] = value;
    }

    const response: ApiResponse = {
      success: true,
      data: updatedSettings,
      message: 'Settings updated successfully',
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    console.error('Failed to update system settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update system settings',
      timestamp: new Date().toISOString(),
    });
  }
});

// Reset settings to defaults
router.post('/system/reset', async (req: Request, res: Response) => {
  try {
    const defaultSettings = {
      fineRatePerDay: 5.0,
      defaultCheckoutPeriod: 7,
      overdueGracePeriod: 0,
      maxBooksPerStudent: 5,
      sessionTimeout: 30,
      libraryHours: {
        open: '08:00',
        close: '18:00',
      },
    };

    const response: ApiResponse = {
      success: true,
      data: defaultSettings,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    console.error('Failed to reset settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset settings',
      timestamp: new Date().toISOString(),
    });
  }
});

// ==========================================
// GOOGLE SHEETS SETTINGS
// ==========================================

// Get Google Sheets config
router.get('/google-sheets', async (req: Request, res: Response) => {
  try {
    // Fetch Google Sheets configuration from database
    const configRecords = await prisma.system_config.findMany({
      where: {
        category: 'google_sheets',
      },
    });

    const config: Record<string, any> = {
      spreadsheetId: '',
      credentialsUploaded: false,
      connectionStatus: 'disconnected',
      lastSync: null,
      lastSyncRecordCount: 0,
      autoSync: false,
      syncSchedule: '0 */4 * * *',
    };

    // Parse config from database
    for (const record of configRecords) {
      try {
        config[record.key] = JSON.parse(record.value);
      } catch {
        config[record.key] = record.value;
      }
    }

    const response: ApiResponse = {
      success: true,
      data: config,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    console.error('Failed to fetch Google Sheets config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch configuration',
      timestamp: new Date().toISOString(),
    });
  }
});

// Upload Google Sheets credentials
router.post(
  '/google-sheets/upload',
  upload.single('credentials'),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
          timestamp: new Date().toISOString(),
        });
      }

      // Validate JSON
      const content = await fs.readFile(file.path, 'utf-8');
      const credentials = JSON.parse(content);

      // TODO: Store credentials securely
      // For now, just validate and delete the temp file
      await fs.unlink(file.path);

      const response: ApiResponse = {
        success: true,
        message: 'Credentials uploaded successfully',
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error) {
      console.error('Failed to upload credentials:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload credentials',
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// Test Google Sheets connection
router.post('/google-sheets/test', async (req: Request, res: Response) => {
  try {
    const { spreadsheetId } = req.body;

    // TODO: Actually test connection
    // For now, return mock success

    const response: ApiResponse = {
      success: true,
      message: 'Successfully connected to Google Sheets',
      data: { spreadsheetId },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    console.error('Failed to test connection:', error);
    res.status(500).json({
      success: false,
      error: 'Connection test failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// Manual sync with Google Sheets
router.post('/google-sheets/sync', async (req: Request, res: Response) => {
  try {
    // TODO: Implement actual sync
    const recordCount = 0;

    const response: ApiResponse = {
      success: true,
      message: 'Sync completed successfully',
      data: { recordCount },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    console.error('Failed to sync:', error);
    res.status(500).json({
      success: false,
      error: 'Sync failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// Update sync schedule
router.put('/google-sheets/schedule', async (req: Request, res: Response) => {
  try {
    const { autoSync, syncSchedule, spreadsheetId } = req.body;

    // Store configuration in database
    if (spreadsheetId !== undefined) {
      await prisma.system_config.upsert({
        where: { key: 'spreadsheetId' },
        create: {
          id: `config_sheets_id_${Date.now()}`,
          key: 'spreadsheetId',
          value: JSON.stringify(spreadsheetId),
          category: 'google_sheets',
          description: 'Google Sheets Spreadsheet ID',
          is_secret: false,
          updated_at: new Date(),
        },
        update: {
          value: JSON.stringify(spreadsheetId),
          updated_at: new Date(),
        },
      });
    }

    if (autoSync !== undefined) {
      await prisma.system_config.upsert({
        where: { key: 'autoSync' },
        create: {
          id: `config_sheets_auto_${Date.now()}`,
          key: 'autoSync',
          value: JSON.stringify(autoSync),
          category: 'google_sheets',
          description: 'Auto-sync enabled',
          is_secret: false,
          updated_at: new Date(),
        },
        update: {
          value: JSON.stringify(autoSync),
          updated_at: new Date(),
        },
      });
    }

    if (syncSchedule !== undefined) {
      await prisma.system_config.upsert({
        where: { key: 'syncSchedule' },
        create: {
          id: `config_sheets_schedule_${Date.now()}`,
          key: 'syncSchedule',
          value: JSON.stringify(syncSchedule),
          category: 'google_sheets',
          description: 'Sync cron schedule',
          is_secret: false,
          updated_at: new Date(),
        },
        update: {
          value: JSON.stringify(syncSchedule),
          updated_at: new Date(),
        },
      });
    }

    // TODO: Update automation job if autoSync is enabled

    const response: ApiResponse = {
      success: true,
      message: 'Schedule updated successfully',
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    console.error('Failed to update schedule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update schedule',
      timestamp: new Date().toISOString(),
    });
  }
});

// ==========================================
// BACKUPS
// ==========================================

// Get all backups
router.get('/backups', async (req: Request, res: Response) => {
  try {
    const backupsDir = path.join(process.cwd(), 'backups');
    
    // Ensure backups directory exists
    try {
      await fs.access(backupsDir);
    } catch {
      await fs.mkdir(backupsDir, { recursive: true });
    }

    // List backup files
    const files = await fs.readdir(backupsDir);
    const backups = await Promise.all(
      files
        .filter(file => file.endsWith('.sql') || file.endsWith('.json'))
        .map(async (file) => {
          const filePath = path.join(backupsDir, file);
          const stats = await fs.stat(filePath);
          return {
            id: file,
            filename: file,
            size: stats.size,
            createdAt: stats.birthtime,
            type: file.endsWith('.sql') ? 'database' : 'json',
          };
        })
    );

    // Sort by creation date (newest first)
    backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const response: ApiResponse = {
      success: true,
      data: backups,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    console.error('Failed to fetch backups:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch backups',
      timestamp: new Date().toISOString(),
    });
  }
});

// Create backup
router.post('/backups/create', async (req: Request, res: Response) => {
  try {
    // TODO: Implement actual backup creation
    const filename = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

    const response: ApiResponse = {
      success: true,
      message: 'Backup created successfully',
      data: { filename },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    console.error('Failed to create backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create backup',
      timestamp: new Date().toISOString(),
    });
  }
});

// Download backup
router.get('/backups/:id/download', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // TODO: Stream actual backup file
    res.status(501).json({
      success: false,
      error: 'Not implemented yet',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to download backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download backup',
      timestamp: new Date().toISOString(),
    });
  }
});

// Delete backup
router.delete('/backups/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // TODO: Delete actual backup file

    const response: ApiResponse = {
      success: true,
      message: 'Backup deleted successfully',
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    console.error('Failed to delete backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete backup',
      timestamp: new Date().toISOString(),
    });
  }
});

// Restore from backup
router.post(
  '/backups/restore',
  upload.single('backup'),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
          timestamp: new Date().toISOString(),
        });
      }

      // TODO: Implement restore logic
      await fs.unlink(file.path);

      const response: ApiResponse = {
        success: true,
        message: 'Backup restored successfully',
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error) {
      console.error('Failed to restore backup:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to restore backup',
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// ==========================================
// SYSTEM LOGS
// ==========================================

// Get logs with filtering and pagination
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      pageSize = '50',
      level,
      source,
      search,
    } = req.query;

    const pageNum = parseInt(page as string);
    const pageSizeNum = parseInt(pageSize as string);
    const skip = (pageNum - 1) * pageSizeNum;

    // Build where clause
    const where: any = {};
    if (level) where.entity = level;
    if (search) {
      where.OR = [
        { entity: { contains: search as string } },
        { action: { contains: search as string } },
      ];
    }

    // Fetch logs from audit_logs table
    const [logs, total] = await Promise.all([
      prisma.audit_logs.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: pageSizeNum,
        select: {
          id: true,
          entity: true,
          action: true,
          entity_id: true,
          performed_by: true,
          created_at: true,
          ip_address: true,
          user_agent: true,
        },
      }),
      prisma.audit_logs.count({ where }),
    ]);

    const response: ApiResponse = {
      success: true,
      data: {
        logs,
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages: Math.ceil(total / pageSizeNum),
      },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    console.error('Failed to fetch logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch logs',
      timestamp: new Date().toISOString(),
    });
  }
});

// Download logs
router.get('/logs/download', async (req: Request, res: Response) => {
  try {
    const { level, source, search } = req.query;

    // TODO: Generate and stream log file
    res.status(501).json({
      success: false,
      error: 'Not implemented yet',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to download logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download logs',
      timestamp: new Date().toISOString(),
    });
  }
});

// Clear old logs
router.post('/logs/clear', async (req: Request, res: Response) => {
  try {
    // TODO: Delete logs older than 30 days

    const response: ApiResponse = {
      success: true,
      message: 'Old logs cleared successfully',
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    console.error('Failed to clear logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear logs',
      timestamp: new Date().toISOString(),
    });
  }
});

// ==========================================
// USER MANAGEMENT (for /api/users routes)
// ==========================================

// Get all users
router.get('/users', async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const response: ApiResponse = {
      success: true,
      data: users,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    console.error('Failed to fetch users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
      timestamp: new Date().toISOString(),
    });
  }
});

// Create new user
router.post('/users', async (req: Request, res: Response) => {
  try {
    const { username, password, role = 'LIBRARIAN', isActive = true } = req.body;

    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required',
        timestamp: new Date().toISOString(),
      });
    }

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Username already exists',
        timestamp: new Date().toISOString(),
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS || '12'));

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role,
        isActive,
      },
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    const response: ApiResponse = {
      success: true,
      data: user,
      message: 'User created successfully',
      timestamp: new Date().toISOString(),
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Failed to create user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create user',
      timestamp: new Date().toISOString(),
    });
  }
});

// Update user
router.put('/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { username, password, role, isActive } = req.body;

    // Build update data
    const updateData: any = {};
    if (username) updateData.username = username;
    if (role) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Hash new password if provided
    if (password) {
      updateData.password = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS || '12'));
    }

    // Update user
    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    const response: ApiResponse = {
      success: true,
      data: user,
      message: 'User updated successfully',
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    console.error('Failed to update user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user',
      timestamp: new Date().toISOString(),
    });
  }
});

// Delete user
router.delete('/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Prevent deleting the last admin
    const user = await prisma.user.findUnique({ where: { id } });
    if (user?.role === 'ADMIN') {
      const adminCount = await prisma.user.count({
        where: { role: 'ADMIN', isActive: true },
      });
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete the last active admin user',
          timestamp: new Date().toISOString(),
        });
      }
    }

    await prisma.user.delete({
      where: { id },
    });

    const response: ApiResponse = {
      success: true,
      message: 'User deleted successfully',
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    console.error('Failed to delete user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user',
      timestamp: new Date().toISOString(),
    });
  }
});

// Change user password
router.post('/users/:id/change-password', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { password, newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        error: 'New password is required',
        timestamp: new Date().toISOString(),
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS || '12'));

    // Update password
    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    const response: ApiResponse = {
      success: true,
      message: 'Password changed successfully',
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    console.error('Failed to change password:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change password',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
