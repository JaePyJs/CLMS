import { Request, Response, NextFunction } from 'express';

/**
 * Type guard to ensure req.user is defined
 * Use this to satisfy TypeScript strict null checks in protected routes
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized - User not authenticated' });
    return;
  }
  next();
}

/**
 * Assertion helper for routes that should have authentication middleware
 * Throws if req.user is undefined (should never happen after auth middleware)
 */
export function assertAuthenticated(
  req: Request,
): asserts req is Request & { user: NonNullable<Request['user']> } {
  if (!req.user) {
    throw new Error('Authentication middleware did not set req.user');
  }
}
