// Mock services that cause issues during test execution
export const mockImageOptimizationService = {
  getInstance: () => ({
    detectSupportedFormats: () => ['webp', 'avif', 'jpeg', 'png'],
    optimizeImage: async () => 'optimized-image-url',
    getCompressionSettings: () => ({ quality: 80 }),
    initialize: async () => {},
    cleanup: () => {},
  }),
};

export const mockOfflineSyncService = {
  initializeDB: async () => {},
  syncToServer: async () => {},
  cacheData: async () => {},
  getLastSyncTime: () => null,
  isOnline: true,
  pendingChanges: 0,
};

export const mockWebSocketService = {
  connect: () => {},
  disconnect: () => {},
  send: () => {},
  on: () => {},
  off: () => {},
  emit: () => {},
};