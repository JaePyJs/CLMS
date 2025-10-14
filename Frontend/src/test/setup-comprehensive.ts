import '@testing-library/jest-dom';
import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { render, RenderOptions } from '@testing-library/react';

// Global cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock IntersectionObserver
const createMockIntersectionObserver = () => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: []
});

vi.stubGlobal('IntersectionObserver', vi.fn().mockImplementation(createMockIntersectionObserver));

// Mock ResizeObserver
const createMockResizeObserver = () => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  boxSize: 'content-box' as const,
  borderBoxSize: {
    blockSize: 0,
    inlineSize: 0
  },
  contentBoxSize: {
    blockSize: 0,
    inlineSize: 0
  },
  devicePixelContentBoxSize: {
    blockSize: 0,
    inlineSize: 0
  }
});

vi.stubGlobal('ResizeObserver', vi.fn().mockImplementation(createMockResizeObserver));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock navigator
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

Object.defineProperty(navigator, 'clipboard', {
  writable: true,
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  },
});

// Mock URL and URLSearchParams
vi.stubGlobal('URL', vi.fn().mockImplementation((url: string, base?: string) => ({
  href: base ? new URL(url, base).href : url,
  origin: 'http://localhost:3000',
  protocol: 'http:',
  host: 'localhost:3000',
  hostname: 'localhost',
  port: '3000',
  pathname: '/',
  search: '',
  hash: '',
  searchParams: new URLSearchParams(),
  toString: () => url,
})));

vi.stubGlobal('URLSearchParams', vi.fn().mockImplementation((init?: string | URLSearchParams | Record<string, string>) => {
  const params = new Map<string, string>();
  if (typeof init === 'string') {
    // Parse query string
    init.split('&').forEach(pair => {
      const [key, value] = pair.split('=');
      if (key) params.set(decodeURIComponent(key), decodeURIComponent(value || ''));
    });
  } else if (init) {
    Object.entries(init).forEach(([key, value]) => params.set(key, value));
  }

  return {
    get: (key: string) => params.get(key),
    set: (key: string, value: string) => params.set(key, value),
    has: (key: string) => params.has(key),
    delete: (key: string) => params.delete(key),
    append: (key: string, value: string) => params.set(key, value),
    toString: () => Array.from(params).map(([k, v]) => `${k}=${v}`).join('&'),
    forEach: (callback: (value: string, key: string) => void) => params.forEach(callback),
  };
}));

// Mock localStorage
const createLocalStorageMock = () => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
    get length() {
      return Object.keys(store).length;
    },
  };
};

Object.defineProperty(window, 'localStorage', {
  value: createLocalStorageMock(),
});

Object.defineProperty(window, 'sessionStorage', {
  value: createLocalStorageMock(),
});

// Mock fetch
global.fetch = vi.fn();

// Mock console methods to reduce noise in tests
Object.defineProperty(console, 'log', {
  value: vi.fn(),
});
Object.defineProperty(console, 'warn', {
  value: vi.fn(),
});
Object.defineProperty(console, 'error', {
  value: vi.fn(),
});

// Mock Web APIs
vi.stubGlobal('requestAnimationFrame', vi.fn().mockImplementation(cb => setTimeout(cb, 16)));
vi.stubGlobal('cancelAnimationFrame', vi.fn().mockImplementation(id => clearTimeout(id)));

// Mock file APIs
vi.stubGlobal('File', vi.fn().mockImplementation((bits: any[], name: string, options: FilePropertyBag = {}) => ({
  name,
  size: bits.reduce((acc, bit) => acc + bit.length, 0),
  type: options.type || '',
  lastModified: Date.now(),
  slice: vi.fn(),
  stream: vi.fn(),
  text: vi.fn().mockResolvedValue(''),
  arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
  bytes: vi.fn().mockResolvedValue(new Uint8Array()),
})));

vi.stubGlobal('Blob', vi.fn().mockImplementation((bits: any[], options: BlobPropertyBag = {}) => ({
  size: bits.reduce((acc, bit) => acc + bit.length, 0),
  type: options.type || '',
  slice: vi.fn(),
  stream: vi.fn(),
  text: vi.fn().mockResolvedValue(''),
  arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
  bytes: vi.fn().mockResolvedValue(new Uint8Array()),
})));

vi.stubGlobal('FormData', vi.fn().mockImplementation(() => {
  const data = new Map<string, string>();
  return {
    append: vi.fn((key: string, value: string) => data.set(key, value)),
    delete: vi.fn((key: string) => data.delete(key)),
    get: vi.fn((key: string) => data.get(key)),
    has: vi.fn((key: string) => data.has(key)),
    set: vi.fn((key: string, value: string) => data.set(key, value)),
    forEach: vi.fn((callback: (value: string, key: string) => void) => data.forEach(callback)),
    entries: vi.fn(() => data.entries()),
    keys: vi.fn(() => data.keys()),
    values: vi.fn(() => data.values()),
  };
}));

// Mock WebSocket
vi.stubGlobal('WebSocket', vi.fn().mockImplementation(() => ({
  readyState: 1, // WebSocket.OPEN
  send: vi.fn(),
  close: vi.fn(),
  onopen: null,
  onmessage: null,
  onerror: null,
  onclose: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
})));

// Mock barcode scanner APIs
vi.stubGlobal('BarcodeDetector', vi.fn().mockImplementation(() => ({
  detect: vi.fn().mockResolvedValue([]),
  getSupportedFormats: vi.fn().mockResolvedValue(['qr_code', 'code_128']),
})));

// Mock camera APIs
vi.stubGlobal('navigator', {
  ...navigator,
  mediaDevices: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
      getVideoTracks: () => [{ stop: vi.fn() }],
      getAudioTracks: () => [{ stop: vi.fn() }],
    }),
    enumerateDevices: vi.fn().mockResolvedValue([
      { deviceId: 'camera1', kind: 'videoinput', label: 'Test Camera' },
    ]),
  },
});

// Mock canvas APIs
const createCanvasContext2D = () => ({
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  getImageData: vi.fn().mockReturnValue({
    data: new Uint8ClampedArray(4),
    width: 1,
    height: 1,
  }),
  putImageData: vi.fn(),
  createImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(4) }),
  setTransform: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  fillText: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  stroke: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  measureText: vi.fn().mockReturnValue({ width: 0 }),
  transform: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
});

vi.stubGlobal('HTMLCanvasElement', {
  prototype: {
    getContext: vi.fn().mockReturnValue(createCanvasContext2D()),
    toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mock'),
    toBlob: vi.fn().mockImplementation((callback) => {
      callback(new Blob());
    }),
  },
});

// Test utilities
export const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
    },
    mutations: {
      retry: false,
    },
  },
});

export const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// Mock user data
export const mockUser = {
  id: '1',
  username: 'test-user',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'LIBRARIAN',
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Mock auth context
export const mockAuthContext = {
  user: mockUser,
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  updateUser: vi.fn(),
};

// Mock theme context
export const mockThemeContext = {
  theme: 'light' as const,
  setTheme: vi.fn(),
  systemTheme: 'light' as const,
  resolvedTheme: 'light' as const,
};

// Performance testing utilities
export const measureRenderPerformance = async (
  renderFn: () => void,
  label: string = 'Render'
) => {
  const start = performance.now();
  renderFn();
  await new Promise(resolve => setTimeout(resolve, 0)); // Wait for async rendering
  const end = performance.now();
  const duration = end - start;

  console.log(`⏱️  ${label}: ${duration.toFixed(2)}ms`);

  if (duration > 100) {
    console.warn(`⚠️  ${label} exceeded performance threshold (${duration.toFixed(2)}ms > 100ms)`);
  }

  return { duration };
};

// Mock API responses
export const createMockApiResponse = <T>(data: T, status = 200) => ({
  data,
  status,
  statusText: 'OK',
  headers: new Headers(),
  config: {
    url: 'http://localhost:3001/api/test',
    method: 'GET',
  },
});

export const createMockErrorResponse = (message: string, status = 400) => ({
  response: {
    data: { message },
    status,
    statusText: 'Bad Request',
    headers: new Headers(),
    config: {
      url: 'http://localhost:3001/api/test',
      method: 'GET',
    },
  },
});

// Async test utilities
export const waitFor = (condition: () => boolean, timeout = 5000): Promise<void> => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Wait condition not met within ${timeout}ms`));
      } else {
        setTimeout(check, 50);
      }
    };

    check();
  });
};

export const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

// Component testing utilities
export const fireEventAsync = async (element: HTMLElement, eventType: string) => {
  element.dispatchEvent(new Event(eventType, { bubbles: true }));
  await flushPromises();
};

// Mock data factories for frontend tests
export const createMockStudent = (overrides = {}) => ({
  id: '1',
  studentId: 'TEST001',
  firstName: 'John',
  lastName: 'Doe',
  gradeLevel: 'Grade 7',
  gradeCategory: 'GRADE_7',
  section: '7-A',
  isActive: true,
  barcode: 'TEST001',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createMockBook = (overrides = {}) => ({
  id: '1',
  accessionNo: 'ACC001',
  title: 'Test Book',
  author: 'Test Author',
  category: 'Fiction',
  totalCopies: 5,
  availableCopies: 3,
  isActive: true,
  barcode: 'ACC001',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createMockEquipment = (overrides = {}) => ({
  id: '1',
  name: 'Test Equipment',
  category: 'Technology',
  serialNumber: 'SN123456',
  barcode: 'EQ123456',
  location: 'Library',
  status: 'Available',
  condition: 'Good',
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createMockStudentActivity = (overrides = {}) => ({
  id: '1',
  studentId: '1',
  activityType: 'CHECK_IN',
  status: 'ACTIVE',
  startTime: new Date().toISOString(),
  endTime: null,
  durationMinutes: null,
  notes: 'Test activity',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

// Global setup
beforeAll(() => {
  console.log('🧪 Setting up comprehensive frontend test environment');
});

afterAll(() => {
  console.log('🧹 Cleaning up frontend test environment');
});

// Re-export testing-library utilities
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';