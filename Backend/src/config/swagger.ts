import swaggerJsdoc from 'swagger-jsdoc';
import { version } from '../../package.json';

const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.1.0',
    info: {
      title: 'CLMS API Documentation',
      version: version,
      description: `
## Comprehensive Library Management System (CLMS) API

A production-ready full-stack educational library management platform with 193+ REST endpoints.

### Features
- 🎓 Student activity tracking with grade-based time limits
- 📚 Book catalog and checkout management
- 💻 Equipment session tracking (computers, gaming, AVR)
- 🔍 Barcode/QR code scanning integration
- 📊 Advanced analytics and reporting
- 🔄 Automated background jobs (backups, sync, notifications)
- 🔐 Role-based access control (6 permission levels)
- 📱 Real-time WebSocket notifications
- 🛡️ Self-healing error recovery system

### Authentication
All endpoints (except \`/health\` and \`/api/auth/login\`) require JWT Bearer token authentication.

Include the token in the Authorization header:
\`\`\`
Authorization: Bearer <your_jwt_token>
\`\`\`

### Response Format
All successful responses follow this structure:
\`\`\`json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
\`\`\`

All error responses follow this structure:
\`\`\`json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
\`\`\`

### Rate Limiting
- **Default**: 100 requests per 15 minutes per IP
- **Authentication endpoints**: 5 requests per 15 minutes per IP

### Pagination
List endpoints support pagination with these query parameters:
- \`page\`: Page number (default: 1)
- \`limit\`: Items per page (default: 50, max: 100)
- \`sortBy\`: Field to sort by
- \`sortOrder\`: Sort direction (asc/desc)
      `,
      contact: {
        name: 'CLMS Development Team',
        email: 'support@clms.edu',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
      {
        url: 'http://localhost:3001/api',
        description: 'Development API',
      },
      {
        url: 'https://your-domain.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token obtained from /api/auth/login',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              example: 'Error message',
            },
            code: {
              type: 'string',
              example: 'ERROR_CODE',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00.000Z',
            },
          },
        },
        ValidationError: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              example: 'Validation failed',
            },
            code: {
              type: 'string',
              example: 'VALIDATION_ERROR',
            },
            validationErrors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: {
                    type: 'string',
                    example: 'email',
                  },
                  message: {
                    type: 'string',
                    example: 'Email is required',
                  },
                  value: {
                    type: 'string',
                    example: '',
                  },
                },
              },
            },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              example: 1,
            },
            limit: {
              type: 'integer',
              example: 50,
            },
            total: {
              type: 'integer',
              example: 150,
            },
            pages: {
              type: 'integer',
              example: 3,
            },
          },
        },
        Student: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'clm1234567890abc',
            },
            studentId: {
              type: 'string',
              example: 'STU001',
              description: 'School-issued student ID',
            },
            firstName: {
              type: 'string',
              example: 'John',
            },
            lastName: {
              type: 'string',
              example: 'Doe',
            },
            gradeLevel: {
              type: 'string',
              example: 'Grade 7',
            },
            gradeCategory: {
              type: 'string',
              enum: ['PRIMARY', 'GRADE_SCHOOL', 'JUNIOR_HIGH', 'SENIOR_HIGH'],
              example: 'JUNIOR_HIGH',
            },
            section: {
              type: 'string',
              example: '7-A',
            },
            barcodeImage: {
              type: 'string',
              nullable: true,
              example: '/barcodes/STU001.png',
            },
            isActive: {
              type: 'boolean',
              example: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Book: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'clm1234567890abc',
            },
            accessionNo: {
              type: 'string',
              example: 'ACC001',
              description: 'Unique library catalog number',
            },
            title: {
              type: 'string',
              example: 'The Great Gatsby',
            },
            author: {
              type: 'string',
              example: 'F. Scott Fitzgerald',
            },
            isbn: {
              type: 'string',
              nullable: true,
              example: '978-0-7432-7356-5',
            },
            publisher: {
              type: 'string',
              nullable: true,
              example: 'Scribner',
            },
            category: {
              type: 'string',
              example: 'Fiction',
            },
            subcategory: {
              type: 'string',
              nullable: true,
              example: 'Classic Literature',
            },
            location: {
              type: 'string',
              nullable: true,
              example: 'Shelf A-12',
            },
            totalCopies: {
              type: 'integer',
              example: 3,
            },
            availableCopies: {
              type: 'integer',
              example: 2,
            },
            isActive: {
              type: 'boolean',
              example: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Equipment: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'clm1234567890abc',
            },
            equipmentId: {
              type: 'string',
              example: 'EQ001',
            },
            name: {
              type: 'string',
              example: 'Computer Station 1',
            },
            type: {
              type: 'string',
              enum: ['COMPUTER', 'GAMING', 'AVR', 'PRINTER', 'SCANNER', 'OTHER'],
              example: 'COMPUTER',
            },
            location: {
              type: 'string',
              example: 'Computer Lab',
            },
            status: {
              type: 'string',
              enum: ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OUT_OF_ORDER'],
              example: 'AVAILABLE',
            },
            maxTimeMinutes: {
              type: 'integer',
              example: 90,
              description: 'Maximum session duration in minutes',
            },
            requiresSupervision: {
              type: 'boolean',
              example: false,
            },
            description: {
              type: 'string',
              nullable: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'clm1234567890abc',
            },
            username: {
              type: 'string',
              example: 'admin',
            },
            email: {
              type: 'string',
              nullable: true,
              example: 'admin@clms.edu',
            },
            fullName: {
              type: 'string',
              nullable: true,
              example: 'John Admin',
            },
            role: {
              type: 'string',
              enum: [
                'SUPER_ADMIN',
                'ADMIN',
                'LIBRARIAN',
                'ASSISTANT',
                'TEACHER',
                'VIEWER',
              ],
              example: 'ADMIN',
            },
            isActive: {
              type: 'boolean',
              example: true,
            },
            lastLoginAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints',
      },
      {
        name: 'Students',
        description: 'Student management and activity tracking',
      },
      {
        name: 'Books',
        description: 'Book catalog and checkout management',
      },
      {
        name: 'Equipment',
        description: 'Equipment inventory and session management',
      },
      {
        name: 'Activities',
        description: 'Student activity logging and tracking',
      },
      {
        name: 'Scan',
        description: 'Barcode/QR code scanning integration',
      },
      {
        name: 'Analytics',
        description: 'Advanced analytics, metrics, and forecasting',
      },
      {
        name: 'Reports',
        description: 'Report generation (daily, weekly, monthly, custom)',
      },
      {
        name: 'Automation',
        description: 'Background job management and scheduling',
      },
      {
        name: 'Notifications',
        description: 'System notification management',
      },
      {
        name: 'Users',
        description: 'User management and permissions',
      },
      {
        name: 'Settings',
        description: 'System configuration and settings',
      },
      {
        name: 'Utilities',
        description: 'Utility endpoints (QR codes, barcodes, quick actions)',
      },
      {
        name: 'Backup',
        description: 'System backup and restore operations',
      },
      {
        name: 'Fines',
        description: 'Fine calculation and payment management',
      },
      {
        name: 'Import',
        description: 'Bulk data import from CSV files',
      },
      {
        name: 'Self-Service',
        description: 'Self-service check-in/out kiosk endpoints',
      },
      {
        name: 'Errors',
        description: 'Error reporting and self-healing system',
      },
      {
        name: 'Admin',
        description: 'Administrative operations',
      },
    ],
  },
  apis: [
    './src/routes/*.ts', // All route files
    './src/routes/**/*.ts', // Nested route files
    './src/app.ts', // Main app file
  ],
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);
