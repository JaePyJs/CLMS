import { Request, Response, NextFunction } from 'express';
import { FERPAService, AccessRequestType, AccessJustification, FERPAComplianceLevel } from '../services/ferpaService';
import { logger } from '../utils/logger';
import { FERPAComplianceError } from '../errors/error-types';

// Extend Request interface for FERPA compliance
declare global {
  namespace Express {
    interface Request {
      ferpaContext?: {
        accessGranted: boolean;
        maskedFields: string[];
        dataCategories: string[];
        accessLevel: string;
        requestId?: string;
        expiresAt?: Date;
      };
      studentId?: string;
      dataCategories?: string[];
      ferpaPurpose?: string;
    }
  }
}

/**
 * FERPA Compliance Middleware Factory
 * Enforces FERPA compliance for all data access
 */
export const createFERPAMiddleware = (ferpaService: FERPAService) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Skip FERPA checks for health endpoints and public routes
      if (isPublicRoute(req.path)) {
        return next();
      }

      const user = (req as any).user;
      if (!user) {
        return next();
      }

      // Extract FERPA-related information from the request
      const ferpaContext = await analyzeRequestForFERPA(req, ferpaService, user);
      req.ferpaContext = {
        accessGranted: ferpaContext.accessGranted || false,
        maskedFields: ferpaContext.maskedFields || [],
        dataCategories: ferpaContext.dataCategories || [],
        accessLevel: ferpaContext.accessLevel || 'limited',
        ...(ferpaContext.requestId && { requestId: ferpaContext.requestId }),
        ...(ferpaContext.expiresAt && { expiresAt: ferpaContext.expiresAt })
      };

      // Check if FERPA compliance validation is needed
      if (ferpaContext.requiresJustification) {
        // TODO: Implement checkValidAccessRequest method in FERPAService
        // Check for existing valid access request
        // const hasValidRequest = await ferpaService.checkValidAccessRequest?.(
        //   user.id,
        //   getTargetTypeFromPath(req.path),
        //   getTargetIdFromRequest(req),
        //   getAccessTypeFromMethod(req.method)
        // );

        const hasValidRequest = null; // Placeholder until method is implemented

        if (!hasValidRequest) {
          // Log FERPA violation attempt
          logger.warn('FERPA compliance violation - access without justification', {
            userId: user.id,
            userRole: user.role,
            path: req.path,
            method: req.method,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          });

          res.status(403).json({
            success: false,
            error: 'FERPA_COMPLIANCE_REQUIRED',
            message: 'Access to this data requires FERPA compliance justification. Please submit an access request.',
            requiresAccessRequest: true,
            complianceLevel: ferpaContext.complianceLevel,
            maskedFields: ferpaContext.maskedFields
          });
        }

        // Note: accessRequestId is not part of the interface anymore
        // if (req.ferpaContext && hasValidRequest?.id) {
        //   req.ferpaContext.accessRequestId = hasValidRequest.id;
        // }
      }

      // Continue to next middleware
      next();

    } catch (error) {
      logger.error('FERPA compliance middleware error', {
        error: (error as Error).message,
        path: req.path,
        method: req.method,
        userId: (req as any).user?.id
      });

      // Fail secure - deny access if FERPA check fails
      res.status(500).json({
        success: false,
        error: 'FERPA_COMPLIANCE_ERROR',
        message: 'FERPA compliance check failed. Please try again later.'
      });
    }
  };
};

/**
 * Analyze request to determine FERPA compliance requirements
 */
async function analyzeRequestForFERPA(
  req: Request,
  ferpaService: FERPAService,
  user: any
): Promise<{
  accessGranted: boolean;
  maskedFields: string[];
  dataCategories: string[];
  accessLevel: string;
  requestId?: string;
  expiresAt?: Date;
  requiresJustification?: boolean;
  complianceLevel?: any;
}> {
  const entityType = getEntityTypeFromPath(req.path);
  const fields = getFieldsFromRequest(req);
  const accessType = getAccessTypeFromMethod(req.method);

  try {
    const accessCheck = await ferpaService.checkDataAccess(
      user.id,
      user.role,
      entityType,
      fields,
      accessType,
      undefined, // justification
      undefined, // justificationText
      {
        requestId: (req as any).requestId,
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        sessionId: (req as any).sessionId,
        entityId: getTargetIdFromRequest(req) || 'unknown'
      }
    );

    return {
      accessGranted: accessCheck.allowed || false,
      maskedFields: accessCheck.maskedFields || [],
      dataCategories: [], // Not provided by checkDataAccess, derive from request
      accessLevel: mapComplianceLevelToAccessLevel(accessCheck.complianceLevel),
      requestId: (req as any).requestId,
      // expiresAt omitted as it's not provided by checkDataAccess
      requiresJustification: accessCheck.requiresJustification,
      complianceLevel: accessCheck.complianceLevel
    };
  } catch (error) {
    logger.error('Failed to analyze request for FERPA', { error, path: req.path });

    // Default to strict compliance if analysis fails
    return {
      accessGranted: false,
      maskedFields: fields,
      dataCategories: ['educational_records'],
      accessLevel: 'limited',
      requestId: (req as any).requestId,
      requiresJustification: true,
      complianceLevel: 'CONFIDENTIAL'
    };
  }
}

/**
 * Response interceptor to apply data masking
 */
export const createFERPAResponseInterceptor = (ferpaService: FERPAService) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalSend = res.send;
    const user = (req as any).user;
    const ferpaContext = req.ferpaContext;

    res.send = function(body: any) {
      try {
        // Apply data masking if FERPA context exists and there are masked fields
        if (user && ferpaContext && ferpaContext.maskedFields.length > 0) {
          let parsedBody = body;

          // Parse response body if it's a string
          if (typeof body === 'string') {
            try {
              parsedBody = JSON.parse(body);
            } catch {
              // If parsing fails, apply masking to the string directly
              const maskedBody = ferpaService.applyDataMasking(
                { data: body },
                ['data'],
                user.role
              );
              return originalSend.call(this, JSON.stringify(maskedBody?.data || body));
            }
          }

          // Apply masking to parsed data
          const maskedData = ferpaService.applyDataMasking(
            parsedBody,
            ferpaContext.maskedFields,
            user.role
          );

          // Add FERPA compliance metadata to response
          if (maskedData && typeof maskedData === 'object') {
            (maskedData as any)._ferpaCompliance = {
              maskedFields: ferpaContext.maskedFields,
              accessLevel: ferpaContext.accessLevel,
              timestamp: new Date().toISOString()
            };
          }

          return originalSend.call(this, JSON.stringify(maskedData));
        }

        return originalSend.call(this, body);
      } catch (error) {
        logger.error('FERPA response interceptor error', { error });
        // If masking fails, return original response
        return originalSend.call(this, body);
      }
    };

    next();
  };
};

/**
 * Create FERPA access request endpoint handler
 */
export const createAccessRequestHandler = (ferpaService: FERPAService) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;
      const {
        targetType,
        targetId,
        accessType,
        justification,
        justificationText,
        duration
      } = req.body;

      // Validate request
      if (!targetType || !accessType || !justification || !justificationText || !duration) {
        res.status(400).json({
          success: false,
          error: 'INVALID_REQUEST',
          message: 'Missing required fields for access request'
        });
        return;
      }

      // Create access request
      const accessRequest = await ferpaService.createAccessRequest(
        user.id,
        user.role,
        targetType,
        targetId,
        accessType,
        justification,
        justificationText,
        duration,
        {
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          requestId: (req as any).requestId,
          sessionId: (req as any).sessionId
        }
      );

      logger.info('FERPA access request submitted', {
        requestId: accessRequest.id,
        userId: user.id,
        userRole: user.role,
        targetType,
        accessType,
        justification
      });

      res.status(201).json({
        success: true,
        data: {
          requestId: accessRequest.id,
          status: accessRequest.status,
          createdAt: accessRequest.createdAt,
          message: 'Access request submitted successfully. Pending approval.'
        }
      });

    } catch (error) {
      logger.error('Failed to create FERPA access request', { error });
      res.status(500).json({
        success: false,
        error: 'REQUEST_FAILED',
        message: 'Failed to create access request'
      });
    }
  };
};

/**
 * Create FERPA access request approval handler (admin only)
 */
export const createAccessRequestApprovalHandler = (ferpaService: FERPAService) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const approver = (req as any).user;
      const { requestId } = req.params;
      const { approved } = req.body;

      if (!requestId || typeof approved !== 'boolean') {
        res.status(400).json({
          success: false,
          error: 'INVALID_REQUEST',
          message: 'Request ID and approval status are required'
        });
        return;
      }

      if (approved) {
        const success = await ferpaService.approveAccessRequest(
          requestId,
          approver.id,
          approver.role
        );

        if (success) {
          logger.info('FERPA access request approved', {
            requestId,
            approvedBy: approver.id,
            approvedByRole: approver.role
          });

          res.json({
            success: true,
            message: 'Access request approved successfully'
          });
        } else {
          res.status(404).json({
            success: false,
            error: 'REQUEST_NOT_FOUND',
            message: 'Access request not found'
          });
        }
      } else {
        // Handle denial logic here
        res.json({
          success: true,
          message: 'Access request denied'
        });
      }

    } catch (error) {
      logger.error('Failed to process FERPA access request approval', { error });
      res.status(500).json({
        success: false,
        error: 'APPROVAL_FAILED',
        message: 'Failed to process access request approval'
      });
    }
  };
};

/**
 * Helper functions
 */

function isPublicRoute(path: string): boolean {
  const publicRoutes = [
    '/health',
    '/auth/login',
    '/auth/logout',
    '/auth/refresh',
    '/api/docs',
    '/api/openapi.json',
    '/favicon.ico',
    '/static'
  ];

  return publicRoutes.some(route => path.startsWith(route));
}

function getEntityTypeFromPath(path: string): string {
  if (path.includes('/students')) return 'student';
  if (path.includes('/activities')) return 'activity';
  if (path.includes('/books')) return 'book';
  if (path.includes('/equipment')) return 'equipment';
  return 'unknown';
}

function getTargetTypeFromPath(path: string): 'student' | 'students' | 'activity' | 'activities' {
  if (path.includes('/students/') || path.includes('/students')) return 'student';
  if (path.includes('/activities/') || path.includes('/activities')) return 'activity';
  return 'students'; // Default to plural for list endpoints
}

function getTargetIdFromRequest(req: Request): string | undefined {
  // Extract ID from URL parameters
  if (req.params.id) return req.params.id;
  if (req.params.studentId) return req.params.studentId;
  if (req.params.activityId) return req.params.activityId;

  // Extract ID from request body for POST/PUT requests
  if (req.body.id) return req.body.id;
  if (req.body.studentId) return req.body.studentId;

  return undefined;
}

function getAccessTypeFromMethod(method: string): AccessRequestType {
  switch (method.toUpperCase()) {
    case 'GET':
      return AccessRequestType.VIEW;
    case 'POST':
      return AccessRequestType.EDIT;
    case 'PUT':
    case 'PATCH':
      return AccessRequestType.EDIT;
    case 'DELETE':
      return 'DELETE' as any; // This would need to be added to the enum
    default:
      return AccessRequestType.VIEW;
  }
}

function getFieldsFromRequest(req: Request): string[] {
  const fields: string[] = [];

  // Extract fields from query parameters
  if (req.query.fields) {
    const queryFields = Array.isArray(req.query.fields)
      ? req.query.fields
      : [req.query.fields];
    fields.push(...queryFields.map(String));
  }

  // Extract fields from request body
  if (req.body && typeof req.body === 'object') {
    fields.push(...Object.keys(req.body));
  }

  // Add default fields based on path
  const entityType = getEntityTypeFromPath(req.path);
  switch (entityType) {
    case 'student':
      fields.push(
        'students.first_name',
        'students.last_name',
        'students.student_id',
        'students.grade_level',
        'students.grade_category',
        'students.section',
        'students.fine_balance',
        'students.equipment_ban',
        'students.equipment_ban_reason'
      );
      break;
    case 'activity':
      fields.push(
        'student_activities.student_name',
        'student_activities.notes',
        'student_activities.activity_type',
        'student_activities.start_time',
        'student_activities.end_time'
      );
      break;
  }

  return Array.from(new Set(fields)); // Remove duplicates
}

/**
 * Map FERPA compliance level to access level string
 */
function mapComplianceLevelToAccessLevel(complianceLevel: any): string {
  if (!complianceLevel) return 'limited';
  
  switch (complianceLevel.toString().toUpperCase()) {
    case 'PUBLIC':
    case 'DIRECTORY':
      return 'public';
    case 'LIMITED':
      return 'limited';
    case 'SENSITIVE':
      return 'sensitive';
    case 'RESTRICTED':
    case 'CONFIDENTIAL':
      return 'restricted';
    default:
      return 'limited';
  }
}

export default {
  createFERPAMiddleware,
  createFERPAResponseInterceptor,
  createAccessRequestHandler,
  createAccessRequestApprovalHandler
};