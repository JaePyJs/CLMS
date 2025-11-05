// PWA Helper Utilities for CLMS
// Provides utilities for PWA features, offline support, and mobile optimization

export interface PWAInstallPrompt {
  platforms: string[];
  prompt(): Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
}

export interface PWAInfo {
  isInstalled: boolean;
  isStandalone: boolean;
  isOnline: boolean;
  supportsInstall: boolean;
  installPrompt?: PWAInstallPrompt;
  platform?: 'ios' | 'android' | 'desktop' | 'unknown';
}

export interface CacheStats {
  size: number;
  entries: number;
  lastCleared: number | null;
  types: Record<string, number>;
}

// Get PWA installation and device information
export const getPWAInfo = async (): Promise<PWAInfo> => {
  // Check if running in standalone mode
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://');

  // Check if app is installed
  const isInstalled =
    isStandalone || localStorage.getItem('pwa-installed') === 'true';

  // Detect platform
  const userAgent = navigator.userAgent.toLowerCase();
  let platform: 'ios' | 'android' | 'desktop' | 'unknown' = 'unknown';

  if (/iphone|ipad|ipod/.test(userAgent)) {
    platform = 'ios';
  } else if (/android/.test(userAgent)) {
    platform = 'android';
  } else if (!/mobile|tablet/.test(userAgent)) {
    platform = 'desktop';
  }

  // Check online status
  const isOnline = navigator.onLine;

  // Check if install is supported (will be updated by beforeinstallprompt event)
  const supportsInstall = !isInstalled && platform !== 'unknown';

  return {
    isInstalled,
    isStandalone,
    isOnline,
    supportsInstall,
    platform,
  };
};

// Get browser and device information for PWA optimization
export const getDeviceInfo = () => {
  const userAgent = navigator.userAgent;
  const platform = navigator.platform;

  // Detect browser
  let browser = 'unknown';
  let version = 'unknown';

  if (userAgent.includes('Chrome')) {
    browser = 'chrome';
    const match = userAgent.match(/Chrome\/(\d+)/);
    version = match?.[1] || 'unknown';
  } else if (userAgent.includes('Firefox')) {
    browser = 'firefox';
    const match = userAgent.match(/Firefox\/(\d+)/);
    version = match?.[1] || 'unknown';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browser = 'safari';
    const match = userAgent.match(/Version\/(\d+)/);
    version = match?.[1] || 'unknown';
  } else if (userAgent.includes('Edge')) {
    browser = 'edge';
    const match = userAgent.match(/Edge\/(\d+)/);
    version = match?.[1] || 'unknown';
  }

  // Detect device capabilities
  const capabilities = {
    serviceWorker: 'serviceWorker' in navigator,
    pushManager: 'PushManager' in window,
    notifications: 'Notification' in window,
    bluetooth: 'bluetooth' in navigator,
    usb: 'usb' in navigator,
    camera:
      'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,
    geolocation: 'geolocation' in navigator,
    vibration: 'vibrate' in navigator,
    fullscreen: 'fullscreenEnabled' in document,
    webShare: 'share' in navigator,
    webAuthn: 'credentials' in navigator,
    indexedDB: 'indexedDB' in window,
    localStorage: 'localStorage' in window,
    sessionStorage: 'sessionStorage' in window,
  };

  // Screen and viewport info
  const screenInfo = {
    width: window.screen.width,
    height: window.screen.height,
    availWidth: window.screen.availWidth,
    availHeight: window.screen.availHeight,
    colorDepth: window.screen.colorDepth,
    pixelDepth: window.screen.pixelDepth,
  };

  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
  };

  return {
    browser: { name: browser, version },
    platform,
    capabilities,
    screen: screenInfo,
    viewport,
    userAgent,
  };
};

// Cache management utilities
export const cacheUtils = {
  // Get cache statistics
  async getStats(): Promise<CacheStats> {
    if (!('caches' in window)) {
      return { size: 0, entries: 0, lastCleared: null, types: {} };
    }

    try {
      const cacheNames = await caches.keys();
      let totalSize = 0;
      let totalEntries = 0;
      const types: Record<string, number> = {};

      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        const entries = keys.length;

        totalEntries += entries;

        // Categorize cache types
        if (cacheName.includes('api')) {
          types.api = (types.api || 0) + entries;
        } else if (cacheName.includes('image')) {
          types.images = (types.images || 0) + entries;
        } else if (cacheName.includes('font')) {
          types.fonts = (types.fonts || 0) + entries;
        } else {
          types.static = (types.static || 0) + entries;
        }

        // Estimate size (rough calculation)
        for (const request of keys.slice(0, 10)) {
          // Sample first 10 entries
          try {
            const response = await cache.match(request);
            if (response) {
              const blob = await response.blob();
              totalSize += blob.size;
            }
          } catch (error) {
            // Skip if we can't read the response
          }
        }

        // Extrapolate size based on sample
        if (keys.length > 10) {
          totalSize = Math.round(totalSize * (keys.length / 10));
        }
      }

      const lastCleared = localStorage.getItem('cache-last-cleared');

      return {
        size: totalSize,
        entries: totalEntries,
        lastCleared: lastCleared ? parseInt(lastCleared) : null,
        types,
      };
    } catch (error) {
      console.error('[CacheUtils] Failed to get cache stats:', error);
      return { size: 0, entries: 0, lastCleared: null, types: {} };
    }
  },

  // Clear specific cache
  async clearCache(pattern: string): Promise<boolean> {
    if (!('caches' in window)) {
      return false;
    }

    try {
      const cacheNames = await caches.keys();
      const regex = new RegExp(pattern);

      for (const cacheName of cacheNames) {
        if (regex.test(cacheName)) {
          await caches.delete(cacheName);
        }
      }

      localStorage.setItem('cache-last-cleared', Date.now().toString());
      return true;
    } catch (error) {
      console.error('[CacheUtils] Failed to clear cache:', error);
      return false;
    }
  },

  // Clear all caches
  async clearAll(): Promise<boolean> {
    if (!('caches' in window)) {
      return false;
    }

    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      localStorage.setItem('cache-last-cleared', Date.now().toString());
      return true;
    } catch (error) {
      console.error('[CacheUtils] Failed to clear all caches:', error);
      return false;
    }
  },

  // Warm up cache with specific URLs
  async warmup(urls: string[]): Promise<void> {
    if (!('caches' in window)) {
      return;
    }

    try {
      const cache = await caches.open('pwa-warmup');
      const promises = urls.map(async (url) => {
        try {
          const response = await fetch(url);
          if (response.ok) {
            await cache.put(url, response);
          }
        } catch (error) {
          console.warn(
            `[CacheUtils] Failed to warm up cache for ${url}:`,
            error
          );
        }
      });

      await Promise.all(promises);
    } catch (error) {
      console.error('[CacheUtils] Cache warmup failed:', error);
    }
  },
};

// Notification utilities
export const notificationUtils = {
  // Request notification permission
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      throw new Error('Notifications not supported');
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      return 'denied';
    }

    return await Notification.requestPermission();
  },

  // Show notification
  async show(title: string, options?: NotificationOptions): Promise<void> {
    if (!('Notification' in window)) {
      throw new Error('Notifications not supported');
    }

    if (Notification.permission !== 'granted') {
      throw new Error('Notification permission not granted');
    }

    const notification = new Notification(title, {
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: 'clms-notification',
      requireInteraction: false,
      ...options,
    });

    // Auto-close after 5 seconds
    setTimeout(() => {
      notification.close();
    }, 5000);

    // Handle click
    notification.onclick = () => {
      window.focus();
      notification.close();
      if (options?.data?.url) {
        window.location.href = options.data.url;
      }
    };
  },

  // Schedule notification (for when app is in background)
  async schedule(
    title: string,
    options?: NotificationOptions & { delay?: number }
  ): Promise<void> {
    const delay = options?.delay || 0;

    if (delay > 0) {
      setTimeout(() => {
        this.show(title, options);
      }, delay);
    } else {
      await this.show(title, options);
    }
  },
};

// Network utilities
export const networkUtils = {
  // Check network quality
  getConnectionType(): string {
    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;

    if (!connection) {
      return 'unknown';
    }

    return connection.effectiveType || connection.type || 'unknown';
  },

  // Check if network is slow
  isSlowConnection(): boolean {
    const type = this.getConnectionType();
    return type === 'slow-2g' || type === '2g' || type === '3g';
  },

  // Get network information
  getInfo() {
    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;

    if (!connection) {
      return {
        type: 'unknown',
        effectiveType: 'unknown',
        downlink: 0,
        rtt: 0,
        saveData: false,
      };
    }

    return {
      type: connection.type || 'unknown',
      effectiveType: connection.effectiveType || 'unknown',
      downlink: connection.downlink || 0,
      rtt: connection.rtt || 0,
      saveData: connection.saveData || false,
    };
  },

  // Monitor network changes
  onChange(callback: (online: boolean, info: any) => void): () => void {
    const handleOnline = () => callback(true, this.getInfo());
    const handleOffline = () => callback(false, this.getInfo());
    const handleConnectionChange = () =>
      callback(navigator.onLine, this.getInfo());

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;

    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
    }

    // Return cleanup function
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
    };
  },
};

// Performance utilities
export const performanceUtils = {
  // Measure load time
  getLoadTime(): number {
    if ('performance' in window && performance.timing) {
      const { navigationStart, loadEventEnd } = performance.timing;
      return loadEventEnd - navigationStart;
    }
    return 0;
  },

  // Get memory usage (if available)
  getMemoryUsage(): any {
    if ('performance' in window && (performance as any).memory) {
      const memory = (performance as any).memory;
      return {
        used: Math.round(memory.usedJSHeapSize / 1048576), // MB
        total: Math.round(memory.totalJSHeapSize / 1048576), // MB
        limit: Math.round(memory.jsHeapSizeLimit / 1048576), // MB
      };
    }
    return null;
  },

  // Log performance metrics
  logMetrics(): void {
    console.log('[Performance] Load time:', this.getLoadTime() + 'ms');

    const memory = this.getMemoryUsage();
    if (memory) {
      console.log(
        '[Performance] Memory:',
        memory.used + '/' + memory.total + 'MB'
      );
    }

    const network = networkUtils.getInfo();
    console.log('[Performance] Network:', network.effectiveType);
  },

  // Create performance observer
  createObserver(
    type: string,
    callback: (entries: PerformanceEntryList) => void
  ): PerformanceObserver | null {
    if (!('PerformanceObserver' in window)) {
      return null;
    }

    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });

      observer.observe({ type, buffered: true });
      return observer;
    } catch (error) {
      console.error('[Performance] Failed to create observer:', error);
      return null;
    }
  },
};

// Install prompt utilities
export const installUtils = {
  // Show install instructions for iOS
  getIOSInstructions(): string[] {
    return [
      'Tap the Share button at the bottom of the screen',
      'Scroll down and tap "Add to Home Screen"',
      'Tap "Add" to install the app',
    ];
  },

  // Show install instructions for Android
  getAndroidInstructions(): string[] {
    return [
      'Tap the menu button (⋮) in the browser',
      'Tap "Add to Home screen" or "Install app"',
      'Tap "Install" to add to your home screen',
    ];
  },

  // Get platform-specific instructions
  getInstructions(platform: string): string[] {
    switch (platform) {
      case 'ios':
        return this.getIOSInstructions();
      case 'android':
        return this.getAndroidInstructions();
      default:
        return [
          'Look for the install icon in your browser toolbar',
          'Click to add the app to your device',
          'Launch from your home screen',
        ];
    }
  },

  // Check if can show install prompt
  canShowPrompt(): boolean {
    const wasDismissed =
      localStorage.getItem('pwa-install-dismissed') === 'true';
    const wasInstalled = localStorage.getItem('pwa-installed') === 'true';

    return !wasDismissed && !wasInstalled;
  },

  // Mark prompt as dismissed
  markDismissed(): void {
    localStorage.setItem('pwa-install-dismissed', 'true');
  },

  // Mark app as installed
  markInstalled(): void {
    localStorage.setItem('pwa-installed', 'true');
  },

  // Reset install state (for testing)
  resetState(): void {
    localStorage.removeItem('pwa-install-dismissed');
    localStorage.removeItem('pwa-installed');
  },
};

// Theme utilities
export const themeUtils = {
  // Get preferred theme
  getPreferredTheme(): 'light' | 'dark' | 'system' {
    const stored = localStorage.getItem('theme') as 'light' | 'dark' | 'system';
    return stored || 'system';
  },

  // Set theme
  setTheme(theme: 'light' | 'dark' | 'system'): void {
    localStorage.setItem('theme', theme);
    this.applyTheme(theme);
  },

  // Apply theme to document
  applyTheme(theme: 'light' | 'dark' | 'system'): void {
    const root = document.documentElement;

    if (theme === 'system') {
      const prefersDark = window.matchMedia(
        '(prefers-color-scheme: dark)'
      ).matches;
      root.classList.toggle('dark', prefersDark);
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
  },

  // Watch for system theme changes
  watchSystemTheme(callback: (isDark: boolean) => void): () => void {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      callback(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  },
};

// Main PWA helper object
export const pwa = {
  info: getPWAInfo,
  device: getDeviceInfo,
  cache: cacheUtils,
  notifications: notificationUtils,
  network: networkUtils,
  performance: performanceUtils,
  install: installUtils,
  theme: themeUtils,
};

export default pwa;
