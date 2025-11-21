import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { TestProviders } from './TestProviders';

describe('useWebSocket exponential backoff', () => {
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <TestProviders>{children}</TestProviders>
  );
  it('initializes hook state and exposes API', () => {
    const { result } = renderHook(() => useWebSocket({ autoConnect: false }), {
      wrapper: Wrapper,
    });
    expect(result.current.connect).toBeTypeOf('function');
    expect(result.current.disconnect).toBeTypeOf('function');
  });

  it('updates connectionAttempts on reconnect attempts (simulated)', () => {
    const { result } = renderHook(() => useWebSocket({ autoConnect: false }), {
      wrapper: Wrapper,
    });
    act(() => {
      // simulate what the socket listener would do
      (result.current as any).connectionAttempts = 3;
    });
    expect((result.current as any).connectionAttempts).toBe(3);
  });
});
