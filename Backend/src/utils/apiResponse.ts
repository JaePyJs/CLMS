import type { Response } from 'express';
import type { ApiResponse } from '@/types';

export function sendSuccess<T>(
  res: Response,
  data: T,
  options: { status?: number; message?: string } = {},
): Response<ApiResponse<T>> {
  const { status = 200, message } = options;

  const payload: ApiResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };

  if (message) {
    payload.message = message;
  }

  return res.status(status).json(payload);
}
