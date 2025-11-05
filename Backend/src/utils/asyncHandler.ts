/**
 * Async Handler Utility
 * Wraps async route handlers to catch errors
 */

import { Request, Response, NextFunction } from 'express';

export const asyncHandler = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>,
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default asyncHandler;
