// Axios client for service modules (notifications, users, etc.)
import axios from 'axios';

const isBrowser = typeof window !== 'undefined';
const API_BASE_URL = isBrowser
  ? ''
  : (import.meta.env.VITE_API_URL || 'http://localhost:3001');

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  },
  validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem('clms_token') ||
      sessionStorage.getItem('clms_token');

    if (token) {
      const authHeader = `Bearer ${token}`;
      const headersAny = config.headers as unknown as { set?: (key: string, value: string) => void };
      if (headersAny && typeof headersAny.set === 'function') {
        headersAny.set('Authorization', authHeader);
      } else {
        config.headers = {
          ...(config.headers || {}),
          Authorization: authHeader,
        } as any;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Let the centralized unauthorized handler in AuthContext manage logout/UI
      // Avoid redirecting to a non-existent route in this app structure
    }
    return Promise.reject(error);
  }
);

export default api;
