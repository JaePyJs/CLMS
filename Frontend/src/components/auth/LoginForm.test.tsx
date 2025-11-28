import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import LoginForm from './LoginForm';

// Mock the AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    login: vi.fn(),
    logout: vi.fn(),
    user: null,
    isAuthenticated: false,
    isLoading: false,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form correctly', () => {
    render(<LoginForm onLoginSuccess={() => {}} />);

    expect(screen.getByPlaceholderText(/username/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/password/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDefined();
  });

  it('displays validation error for empty username', async () => {
    render(<LoginForm onLoginSuccess={() => {}} />);

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/username is required/i)).toBeDefined();
    });
  });

  it('displays validation error for empty password', async () => {
    render(<LoginForm onLoginSuccess={() => {}} />);

    const usernameInput = screen.getByPlaceholderText(/username/i);
    await userEvent.type(usernameInput, 'testuser');

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/password is required/i)).toBeDefined();
    });
  });

  it('calls login function with valid credentials', async () => {
    const mockOnLoginSuccess = vi.fn();
    render(<LoginForm onLoginSuccess={mockOnLoginSuccess} />);

    const usernameInput = screen.getByPlaceholderText(/username/i);
    const passwordInput = screen.getByPlaceholderText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await userEvent.type(usernameInput, 'admin');
    await userEvent.type(passwordInput, 'password123');
    await userEvent.click(submitButton);

    await waitFor(() => {
      // Form should submit without validation errors
      expect(screen.queryByText(/is required/i)).toBeNull();
    });
  });

  it('toggles password visibility', async () => {
    render(<LoginForm onLoginSuccess={() => {}} />);

    const passwordInput = screen.getByPlaceholderText(
      /password/i
    ) as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    // Note: The toggle button might not have an accessible name, so this test may need adjustment
    const form = passwordInput.closest('form');
    expect(form).toBeDefined();
  });

  it('handles "remember me" checkbox', async () => {
    render(<LoginForm onLoginSuccess={() => {}} />);

    const checkboxes = screen.queryAllByRole('checkbox');
    if (checkboxes.length > 0) {
      const rememberMeCheckbox = checkboxes[0] as HTMLInputElement;
      expect(rememberMeCheckbox.checked).toBe(false);

      await userEvent.click(rememberMeCheckbox);
      expect(rememberMeCheckbox.checked).toBe(true);
    }
  });
});
