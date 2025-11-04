import '@testing-library/jest-dom';
import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

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
const MockFile = vi.fn().mockImplementation((bits: any[], name: string, options: FilePropertyBag = {}) => ({
  name,
  size: bits.reduce((acc, bit) => acc + bit.length, 0),
  type: options.type || '',
  lastModified: Date.now(),
  slice: vi.fn(),
  stream: vi.fn(),
  text: vi.fn().mockResolvedValue(''),
  arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
  bytes: vi.fn().mockResolvedValue(new Uint8Array()),
}));

vi.stubGlobal('File', MockFile);

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

// Mock canvas APIs - simple approach
vi.stubGlobal('HTMLCanvasElement', {
  prototype: {
    getContext: vi.fn().mockReturnValue({
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
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
    }),
    toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mock'),
    toBlob: vi.fn().mockImplementation((callback: any) => callback(new Blob())),
  },
});

// Mock Image constructor - create a proper mock before any imports
const createMockImage = () => {
  const mockImage = {
    src: '',
    width: 0,
    height: 0,
    naturalWidth: 0,
    naturalHeight: 0,
    complete: true,
    onload: null,
    onerror: null,
    onabort: null,
    load: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    decode: vi.fn().mockResolvedValue(undefined),
    getAttribute: vi.fn(),
    setAttribute: vi.fn(),
    removeAttribute: vi.fn(),
    hasAttribute: vi.fn(),
    querySelector: vi.fn(),
    querySelectorAll: vi.fn(),
    appendChild: vi.fn(),
    removeChild: vi.fn(),
    insertBefore: vi.fn(),
    replaceChild: vi.fn(),
    cloneNode: vi.fn(),
    getBoundingClientRect: vi.fn().mockReturnValue({
      x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0
    }),
    closest: vi.fn(),
    matches: vi.fn(),
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      contains: vi.fn(),
      toggle: vi.fn(),
    },
    style: {},
    parentNode: null,
    parentElement: null,
    children: [],
    childNodes: [],
    firstChild: null,
    lastChild: null,
    nextSibling: null,
    previousSibling: null,
    textContent: '',
    innerText: '',
    innerHTML: '',
    outerHTML: '',
    scrollIntoView: vi.fn(),
    scroll: vi.fn(),
    scrollTo: vi.fn(),
    focus: vi.fn(),
    blur: vi.fn(),
    click: vi.fn(),
  };

  return vi.fn().mockImplementation(() => mockImage);
};

// Create and export the Image mock
const mockImageConstructor = createMockImage();
vi.stubGlobal('Image', mockImageConstructor);

// Mock IndexedDB - simple approach
vi.stubGlobal('indexedDB', {
  open: vi.fn().mockReturnValue({
    result: {
      createObjectStore: vi.fn(),
      deleteObjectStore: vi.fn(),
      transaction: vi.fn().mockReturnValue({
        objectStore: vi.fn().mockReturnValue({
          add: vi.fn().mockReturnValue({ result: undefined, error: null, onsuccess: null, onerror: null }),
          get: vi.fn().mockReturnValue({ result: undefined, error: null, onsuccess: null, onerror: null }),
          put: vi.fn().mockReturnValue({ result: undefined, error: null, onsuccess: null, onerror: null }),
          delete: vi.fn().mockReturnValue({ result: undefined, error: null, onsuccess: null, onerror: null }),
        }),
        abort: vi.fn(),
        commit: vi.fn(),
      }),
      close: vi.fn(),
    },
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
  }),
  deleteDatabase: vi.fn(),
  cmp: vi.fn().mockReturnValue(0),
});

// Mock problematic services that cause issues during module loading
vi.mock('@/services/imageOptimizationService', () => ({
  ImageOptimizationService: {
    getInstance: () => ({
      detectSupportedFormats: () => ['webp', 'avif', 'jpeg', 'png'],
      optimizeImage: async () => 'optimized-image-url',
      getCompressionSettings: () => ({ quality: 80 }),
      initialize: async () => {},
      cleanup: () => {},
    }),
  },
}));

vi.mock('@/hooks/useOfflineSync', () => ({
  useOfflineSync: () => ({
    isOnline: true,
    syncData: async () => {},
    isSyncing: false,
    lastSyncTime: null,
    pendingChanges: 0,
  }),
  OfflineSyncService: vi.fn().mockImplementation(() => ({
    initializeDB: async () => {},
    syncToServer: async () => {},
    cacheData: async () => {},
  })),
}));

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

// Global setup
beforeAll(() => {
  console.log('🧪 Setting up simplified frontend test environment');
});

afterAll(() => {
  console.log('🧹 Cleaning up frontend test environment');
});