import { QueryClient } from '@tanstack/react-query';

import { apiClient } from '@/lib/api';

export type AuthUser = {
  id: string;
  username: string;
  role: string;
  isActive?: boolean;
  lastLoginAt?: string | Date | null;
};

export const authKeys = {
  all: ['auth'] as const,
  current: () => [...authKeys.all, 'current'] as const,
};

interface AuthApiResponse {
  success: boolean;
  data?: {
    id: string;
    username: string;
    role: string;
    is_active?: boolean;
    last_login_at?: string | Date | null;
  };
  error?: string | { message: string };
  message?: string;
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const response = (await apiClient.get<{ user: AuthUser }>(
    '/api/auth/me'
  )) as unknown as AuthApiResponse;

  // Backend returns user data directly in response.data, not response.data.user
  if (response.success && response.data) {
    // Map backend fields to AuthUser type
    const userData = response.data;
    return {
      id: userData.id,
      username: userData.username,
      role: userData.role,
      isActive: userData.is_active,
      lastLoginAt: userData.last_login_at,
    };
  }

  const message =
    typeof response.error === 'string'
      ? response.error
      : response.error?.message ||
        response.message ||
        'Unable to fetch current user';
  throw new Error(message);
}

export async function primeAuthState(
  queryClient: QueryClient
): Promise<AuthUser> {
  return queryClient.ensureQueryData({
    queryKey: authKeys.current(),
    queryFn: fetchCurrentUser,
  });
}

export function clearAuthState(queryClient: QueryClient) {
  queryClient.removeQueries({ queryKey: authKeys.all });
}
