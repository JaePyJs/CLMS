import axios, { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';

import {
  setAccessTokenProvider,
  setUnauthorizedHandler,
  setupInterceptors,
} from '@/lib/api/interceptors';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe('API interceptors', () => {
  beforeEach(() => {
    const client = axios.create();
    setupInterceptors(client);
    (axios as any).__TEST_CLIENT__ = client;
    setAccessTokenProvider(() => 'test-token');
    setUnauthorizedHandler(null);
    (toast.error as any).mockReset?.();
  });

  it('attaches Authorization header when token present', async () => {
    const client = (axios as any).__TEST_CLIENT__;
    const requestHandlers = (client.interceptors.request as any).handlers;
    const config = await requestHandlers[0].fulfilled({ headers: {} });
    expect(config.headers.Authorization).toBe('Bearer test-token');
  });

  it('invokes unauthorized handler only once for repeated 401s', async () => {
    const client = (axios as any).__TEST_CLIENT__;
    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    const error = {
      response: { status: 401, data: {} },
    } as AxiosError;

    const responseHandlers = (client.interceptors.response as any).handlers;

    const firstRejection = responseHandlers[0]
      .rejected(error)
      .catch((err: any) => err);
    const secondRejection = responseHandlers[0]
      .rejected(error)
      .catch((err: any) => err);

    const results = await Promise.all([firstRejection, secondRejection]);

    results.forEach((result) => {
      expect(result.appError).toBeDefined();
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('normalizes validation errors', async () => {
    const client = (axios as any).__TEST_CLIENT__;
    const responseHandlers = (client.interceptors.response as any).handlers;

    const error = {
      response: {
        status: 400,
        data: {
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          validationErrors: [
            {
              field: 'username',
              message: 'Username is required',
            },
          ],
        },
      },
    } as AxiosError;

    await expect(responseHandlers[0].rejected(error)).rejects.toMatchObject({
      appError: {
        code: 'VALIDATION_ERROR',
        validationErrors: [
          { field: 'username', message: 'Username is required' },
        ],
      },
    });

    expect(toast.error).toHaveBeenCalledWith('username: Username is required');
  });
});
