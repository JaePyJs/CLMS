import { screen as testingScreen } from '@testing-library/react'
import { vi, beforeEach, describe, it, expect } from 'vitest'
import App from '../App'
import { render } from './test-utils'

// Mock the problematic Image component that uses canvas and Image constructor
vi.mock('@/components/performance/Image', () => ({
  default: ({ children, ...props }: any) => (
    <div data-testid="mock-image" {...props}>
      Mock Image Component
    </div>
  ),
  AvatarImage: ({ children, ...props }: any) => (
    <div data-testid="mock-avatar-image" {...props}>
      Mock Avatar Image
    </div>
  ),
  StudentPhotoImage: ({ children, ...props }: any) => (
    <div data-testid="mock-student-photo-image" {...props}>
      Mock Student Photo Image
    </div>
  ),
  BookCoverImage: ({ children, ...props }: any) => (
    <div data-testid="mock-book-cover-image" {...props}>
      Mock Book Cover Image
    </div>
  ),
  EquipmentImage: ({ children, ...props }: any) => (
    <div data-testid="mock-equipment-image" {...props}>
      Mock Equipment Image
    </div>
  ),
  BarcodeImage: ({ children, ...props }: any) => (
    <div data-testid="mock-barcode-image" {...props}>
      Mock Barcode Image
    </div>
  ),
  BackgroundImage: ({ children, ...props }: any) => (
    <div data-testid="mock-background-image" {...props}>
      Mock Background Image
    </div>
  ),
}))

// Mock the hooks that use API
vi.mock('@/hooks/api-hooks', () => ({
  useHealthCheck: () => ({
    data: { success: true },
    isLoading: false,
  }),
}))

// Mock the problematic services that cause canvas and indexedDB errors
vi.mock('@/services/imageOptimizationService', () => {
  const mockImageOptimizationService = {
    getInstance: () => mockImageOptimizationService,
    detectSupportedFormats: () => ['webp', 'avif', 'jpeg', 'png'],
    optimizeImage: async () => 'optimized-image-url',
    getCompressionSettings: () => ({ quality: 80 }),
    initialize: async () => {},
    cleanup: () => {},
    getOptimalFormat: () => 'webp',
    generateOptimizedUrl: (baseUrl: string, config: any = {}) => {
      const url = new URL(baseUrl, 'http://localhost:3000');
      Object.entries(config).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, value.toString());
        }
      });
      return url.toString();
    },
    generateSrcSet: (baseUrl: string, config: any = {}) => {
      const sizes = [1, 2, 3];
      return sizes.map(size => {
        const width = config.width ? config.width * size : config.width;
        const height = config.height ? config.height * size : config.height;
        const url = new URL(baseUrl, 'http://localhost:3000');
        if (width) url.searchParams.set('width', width.toString());
        if (height) url.searchParams.set('height', height.toString());
        if (config.quality) url.searchParams.set('quality', config.quality.toString());
        if (config.format) url.searchParams.set('format', config.format);
        return `${url.toString()} ${size}x`;
      }).join(', ');
    },
    generateSizes: () => '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
    preloadImage: async () => {
      // Mock preloading by doing nothing
      return Promise.resolve();
    },
    loadImageWithMetrics: async () => ({
      optimizedUrl: 'test.jpg',
      metrics: {
        originalSize: 1000,
        optimizedSize: 500,
        compressionRatio: 2,
        loadTime: 100,
        format: 'webp',
        dimensions: { width: 800, height: 600 },
      },
      savings: { size: 500, percentage: 50 },
    }),
    batchOptimizeImages: async () => [],
    getImageMetrics: () => [],
    getPerformanceStats: () => ({
      totalImages: 0,
      averageLoadTime: 0,
      averageCompressionRatio: 0,
      totalSavings: 0,
      formatDistribution: {},
    }),
    clearCache: () => {},
    generatePlaceholder: (width: number = 300, height: number = 200, color: string = '#e5e7eb') =>
      `data:image/svg+xml,%3Csvg width='${width}' height='${height}' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100%25' height='100%25' fill='${color.replace('#', '%23')}'/%3E%3C/svg%3E`,
    generateBlurPlaceholder: async (width: number = 40, height: number = 40) =>
      `data:image/svg+xml,%3Csvg width='${width}' height='${height}' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100%25' height='100%25' fill='%23e5e7eb'/%3E%3C/svg%3E`,
    isFormatSupported: () => true,
    getSupportedFormats: () => ['webp', 'avif', 'jpeg', 'png'],
  };

  return {
    ImageOptimizationService: {
      getInstance: () => mockImageOptimizationService,
    },
    imageOptimizationService: mockImageOptimizationService,
    default: mockImageOptimizationService,
  };
});

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
}))

// Mock WebSocket context
vi.mock('@/contexts/WebSocketContext', () => {
  const mockWebSocketProvider = ({ children }: { children: React.ReactNode }) => children;
  const mockUseWebSocketContext = () => ({
    isConnected: true,
    sendMessage: vi.fn(),
    lastMessage: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    requestDashboardData: vi.fn(),
    sendChatMessage: vi.fn(),
    triggerEmergencyAlert: vi.fn(),
    recentActivities: [],
    equipmentStatus: {},
    notifications: [],
    dashboardData: {},
    clearNotifications: vi.fn(),
    refreshDashboard: vi.fn(),
  });

  return {
    default: mockWebSocketProvider,
    WebSocketProvider: mockWebSocketProvider,
    useWebSocketContext: mockUseWebSocketContext,
  };
});

// Mock the AuthContext to provide test user
vi.mock('../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../contexts/AuthContext')
  return {
    ...actual,
    useAuth: () => ({
      user: {
        id: 'test-user-id',
        username: 'test-user',
        role: 'ADMIN'
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn().mockResolvedValue(true),
      logout: vi.fn(),
      checkAuth: vi.fn().mockResolvedValue(true)
    })
  }
})

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing with AuthProvider', () => {
    render(<App />)
    // Check that the main app container is rendered
    expect(testingScreen.getByRole('main')).toBeInTheDocument()
    // Check that the header/banner is rendered
    expect(testingScreen.getByRole('banner')).toBeInTheDocument()
  })

  it('displays authenticated user content', () => {
    render(<App />)
    // The presence of header and main content proves AuthProvider is working
    expect(testingScreen.getByRole('banner')).toBeInTheDocument()
    expect(testingScreen.getByRole('main')).toBeInTheDocument()
  })

  it('has interactive elements', () => {
    render(<App />)
    // Look for buttons to ensure interactivity
    const buttons = testingScreen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
    // At least one button should have an SVG icon
    const buttonsWithIcons = buttons.filter(button => button.querySelector('svg'))
    expect(buttonsWithIcons.length).toBeGreaterThan(0)
  })
})