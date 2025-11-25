import swaggerJsdoc from 'swagger-jsdoc';
import { SwaggerUiOptions } from 'swagger-ui-express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CLMS API Documentation',
      version: '1.0.3',
      description:
        'Centralized Library Management System - RESTful API for managing library operations including students, books, equipment, and analytics.',
      contact: {
        name: 'CLMS Development Team',
        url: 'https://github.com/JaePyJs/CLMS',
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
        description: 'Development server (with /api prefix)',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT authentication token obtained from /auth/login',
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
            message: {
              type: 'string',
              example: 'Error message',
            },
            code: {
              type: 'string',
              example: 'ERROR_CODE',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            username: { type: 'string' },
            email: { type: 'string' },
            full_name: { type: 'string' },
            role: {
              type: 'string',
              enum: ['LIBRARIAN', 'ADMIN', 'KIOSK_DISPLAY'],
            },
            is_active: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Student: {
          type: 'object',
          properties: {
            student_id: { type: 'string' },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            grade_level: { type: 'string' },
            section: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            barcode: { type: 'string' },
            qr_code: { type: 'string' },
            is_active: { type: 'boolean' },
          },
        },
        Book: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            accession_no: { type: 'string' },
            title: { type: 'string' },
            author: { type: 'string' },
            isbn: { type: 'string' },
            publisher: { type: 'string' },
            category: { type: 'string' },
            location: { type: 'string' },
            total_copies: { type: 'integer' },
            available_copies: { type: 'integer' },
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
        description: 'User authentication and authorization',
      },
      { name: 'Students', description: 'Student management operations' },
      { name: 'Books', description: 'Book catalog management' },
      { name: 'Borrows', description: 'Book checkout and return operations' },
      { name: 'Equipment', description: 'Equipment tracking and management' },
    ],
  },
  apis: ['./src/routes/*.ts'], // Path to the API routes
};

export const swaggerSpec = swaggerJsdoc(options);

export const swaggerUiOptions: SwaggerUiOptions = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'CLMS API Documentation',
};
