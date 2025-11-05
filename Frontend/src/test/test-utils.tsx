import { render } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { TestProviders, createTestQueryClient } from './TestProviders';

// Custom render function that includes all providers
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & {
    queryClient?: QueryClient;
  }
) => {
  const { queryClient, ...renderOptions } = options || {};

  return render(ui, {
    wrapper: ({ children }) =>
      queryClient ? (
        <TestProviders queryClient={queryClient}>{children}</TestProviders>
      ) : (
        <TestProviders>{children}</TestProviders>
      ),
    ...renderOptions,
  });
};

// Mock auth context for testing
export const mockAuthContext = {
  user: {
    id: 'test-user-id',
    username: 'test-user',
    role: 'ADMIN',
  },
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn().mockResolvedValue(true),
  logout: vi.fn(),
  checkAuth: vi.fn().mockResolvedValue(true),
};

// Re-export everything from testing-library
export * from '@testing-library/react';
export { customRender as render };
export { createTestQueryClient };
export { TestProviders };

// Export types for test utilities
export type { RenderOptions };
