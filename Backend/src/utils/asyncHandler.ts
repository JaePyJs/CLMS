import type { NextFunction, Request, Response, RequestHandler } from 'express';

type AsyncMiddleware = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export function asyncHandler(handler: AsyncMiddleware): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
