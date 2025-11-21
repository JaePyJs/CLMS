import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  apiClient,
  setAccessTokenProvider,
  setUnauthorizedHandler,
  type LoginResponse,
} from '@/lib/api';
import {
  authKeys,
  clearAuthState,
  fetchCurrentUser,
  primeAuthState,
  type AuthUser,
} from '@/lib/auth-queries';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    username: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

interface LogoutOptions {
  message?: string;
  silent?: boolean;
  severity?: 'info' | 'error';
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(
    () =>
      localStorage.getItem('clms_token') || sessionStorage.getItem('clms_token')
  );

  const performLogout = useCallback(
    ({ message, silent, severity = 'info' }: LogoutOptions = {}) => {
      // Clear both localStorage and sessionStorage
      localStorage.removeItem('clms_token');
      localStorage.removeItem('clms_refresh_token');
      localStorage.removeItem('clms_user');
      sessionStorage.removeItem('clms_token');
      sessionStorage.removeItem('clms_refresh_token');
      sessionStorage.removeItem('clms_user');
      setToken(null);
      clearAuthState(queryClient);

      if (!silent) {
        const text = message ?? 'You have been logged out';
        if (severity === 'error') {
          toast.error(text);
        } else {
          toast.info(text);
        }
      }
    },
    [queryClient]
  );

  const authQuery = useQuery<AuthUser>({
    queryKey: authKeys.current(),
    queryFn: fetchCurrentUser,
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: false,
  });

  // Handle successful auth query with useEffect (React Query v5 pattern)
  useEffect(() => {
    if (authQuery.data) {
      localStorage.setItem('clms_user', JSON.stringify(authQuery.data));
    }
  }, [authQuery.data]);

  const logout = useCallback(() => {
    performLogout();
  }, [performLogout]);

  useEffect(() => {
    setAccessTokenProvider(
      () =>
        localStorage.getItem('clms_token') ||
        sessionStorage.getItem('clms_token')
    );

    setUnauthorizedHandler(() => {
      performLogout({
        message: 'Please log in to continue',
        severity: 'info',
      });
    });

    return () => {
      setAccessTokenProvider(() => null);
      setUnauthorizedHandler(null);
    };
  }, [performLogout]);

  const login = useCallback(
    async (username: string, password: string, rememberMe: boolean = false) => {
      try {
        console.log('🚀 Starting login attempt for:', username);

        const response = await apiClient.post<LoginResponse>(
          '/api/auth/login',
          {
            username,
            password,
            rememberMe,
          }
        );

        console.log('📡 Login response:', response);

        if (response.success && response.data) {
          const { accessToken, refreshToken, user } = response.data;

          console.log(
            '✅ Login successful, token:',
            accessToken.substring(0, 10) + '...'
          );
          console.log('👤 User:', user);

          // Store token in localStorage or sessionStorage based on rememberMe
          if (rememberMe) {
            localStorage.setItem('clms_token', accessToken);
            localStorage.setItem('clms_refresh_token', refreshToken);
            localStorage.setItem('clms_user', JSON.stringify(user));
          } else {
            // For session-only, use sessionStorage
            sessionStorage.setItem('clms_token', accessToken);
            sessionStorage.setItem('clms_refresh_token', refreshToken);
            sessionStorage.setItem('clms_user', JSON.stringify(user));
          }

          setToken(accessToken);

          queryClient.setQueryData(authKeys.current(), user);

          // Update the access token provider immediately so interceptors can use it
          setAccessTokenProvider(() => accessToken);

          console.log('🔄 Calling primeAuthState...');

          try {
            await primeAuthState(queryClient);
            console.log('✅ primeAuthState completed successfully');
          } catch (primeError) {
            console.error(
              '❌ Failed to prime auth state after login:',
              primeError
            );
          }

          toast.success(`Welcome back, ${user.username}!`);
          return true;
        }

        console.log('❌ Login failed - response.success is false or no data');
        const errorData = response as unknown as Record<string, unknown>;
        const error = errorData.error;
        toast.error(
          typeof error === 'string'
            ? error
            : error &&
                typeof error === 'object' &&
                'message' in error &&
                typeof error.message === 'string'
              ? error.message
              : 'Login failed'
        );
        return false;
      } catch (error) {
        console.error('❌ Login error:', error);
        toast.error('An error occurred during login');
        return false;
      }
    },
    [queryClient]
  );

  const checkAuth = useCallback(async (): Promise<boolean> => {
    const storedToken =
      localStorage.getItem('clms_token') ||
      sessionStorage.getItem('clms_token');

    if (!storedToken) {
      performLogout({ silent: true });
      return false;
    }

    setToken(storedToken);

    try {
      const currentUser: AuthUser = await primeAuthState(queryClient);
      queryClient.setQueryData(authKeys.current(), currentUser);
      return true;
    } catch (error) {
      console.error('Auth check failed:', error);
      try {
        const cached =
          localStorage.getItem('clms_user') ||
          sessionStorage.getItem('clms_user');
        if (cached) {
          const cachedUser = JSON.parse(cached) as AuthUser;
          queryClient.setQueryData(authKeys.current(), cachedUser);
          return true;
        }
      } catch {
        // Ignore JSON parsing errors for invalid cache data
      }
      performLogout({ message: 'Please log in to continue', severity: 'info' });
      return false;
    }
  }, [performLogout, queryClient]);

  // Call checkAuth only once on mount
  useEffect(() => {
    checkAuth();
  }, []); // Empty dependency array to run only once on mount

  const user: AuthUser | null = authQuery.data || null;
  const isAuthenticated = Boolean(token);
  const isLoading = false;

  // T053: Auto-refresh token before expiration
  useEffect(() => {
    if (!token || !user) {
      return;
    }

    // Refresh token 5 minutes before expiration (assuming 1 hour token lifetime)
    const REFRESH_INTERVAL = 55 * 60 * 1000; // 55 minutes in milliseconds

    const refreshTimer = setInterval(async () => {
      try {
        const storedRefreshToken =
          localStorage.getItem('clms_refresh_token') ||
          sessionStorage.getItem('clms_refresh_token');

        if (!storedRefreshToken) {
          throw new Error('Missing refresh token');
        }

        const response = await apiClient.post<LoginResponse>(
          '/api/auth/refresh',
          { refreshToken: storedRefreshToken },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.data?.accessToken) {
          const newToken = response.data.accessToken;
          const storage = localStorage.getItem('clms_token')
            ? localStorage
            : sessionStorage;
          storage.setItem('clms_token', newToken);
          setToken(newToken);

          // Silent refresh - no console log in production
        }
      } catch (error) {
        // If refresh fails, the unauthorized handler will logout the user
        console.error('Auto-refresh failed:', error);
      }
    }, REFRESH_INTERVAL);

    return () => clearInterval(refreshTimer);
  }, [token, user]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      token,
      isAuthenticated,
      isLoading,
      login,
      logout,
      checkAuth,
    }),
    [checkAuth, isAuthenticated, isLoading, login, logout, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
