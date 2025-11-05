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

export async function fetchCurrentUser(): Promise<AuthUser> {
  const response = (await apiClient.get<{ user: AuthUser }>(
    '/api/auth/me'
  )) as any;

  if (response.success && response.data?.user) {
    return response.data.user;
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
