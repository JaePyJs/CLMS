/**
 * Advanced Service Worker for CLMS
 *
 * This service worker provides intelligent caching, offline support,
 * and performance optimization for the CLMS application.
 */

const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-${CACHE_VERSION}`;
const FONT_CACHE = `fonts-${CACHE_VERSION}`;

// Cache configuration
const CACHE_CONFIG = {
  static: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    maxEntries: 100,
  },
  api: {
    maxAge: 5 * 60 * 1000, // 5 minutes
    maxEntries: 50,
    networkTimeout: 3000, // 3 seconds
  },
  images: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxEntries: 200,
  },
  fonts: {
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    maxEntries: 20,
  },
};

// Critical assets to cache immediately
const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  // Core CSS
  '/assets/css/index-[hash].css',
  // Core JavaScript
  '/assets/js/index-[hash].js',
  '/assets/js/react-vendor-[hash].js',
  // Icons
  '/favicon.ico',
  '/apple-touch-icon.png',
];

// API endpoints to cache
const API_CACHE_PATTERNS = [
  /^\/api\/students/,
  /^\/api\/books/,
  /^\/api\/equipment/,
  /^\/api\/activities/,
  /^\/api\/analytics/,
];

// Never cache these API endpoints
const API_NO_CACHE_PATTERNS = [
  /^\/api\/auth\/login/,
  /^\/api\/auth\/logout/,
  /^\/api\/scan/,
  /^\/api\/import/,
];

// Install event - cache critical assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');

  event.waitUntil(
    (async () => {
      try {
        // Create caches
        const staticCache = await caches.open(STATIC_CACHE);
        const fontCache = await caches.open(FONT_CACHE);

        // Cache critical assets
        const criticalPromises = CRITICAL_ASSETS.map(async (asset) => {
          try {
            await staticCache.add(asset);
            console.log(`[SW] Cached critical asset: ${asset}`);
          } catch (error) {
            console.warn(
              `[SW] Failed to cache critical asset: ${asset}`,
              error
            );
          }
        });

        // Cache fonts
        const fontPromises = [
          '/assets/fonts/inter-v12-latin-regular.woff2',
          '/assets/fonts/inter-v12-latin-500.woff2',
          '/assets/fonts/inter-v12-latin-600.woff2',
        ].map(async (font) => {
          try {
            await fontCache.add(font);
            console.log(`[SW] Cached font: ${font}`);
          } catch (error) {
            console.warn(`[SW] Failed to cache font: ${font}`, error);
          }
        });

        await Promise.all([...criticalPromises, ...fontPromises]);
        console.log('[SW] Installation completed successfully');

        // Skip waiting to activate immediately
        self.skipWaiting();
      } catch (error) {
        console.error('[SW] Installation failed:', error);
      }
    })()
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');

  event.waitUntil(
    (async () => {
      try {
        // Get all cache keys
        const cacheKeys = await caches.keys();

        // Delete old caches
        const deletePromises = cacheKeys
          .filter((key) => !key.includes(CACHE_VERSION))
          .map((key) => {
            console.log(`[SW] Deleting old cache: ${key}`);
            return caches.delete(key);
          });

        await Promise.all(deletePromises);

        // Take control of all pages
        await self.clients.claim();
        console.log('[SW] Activation completed successfully');
      } catch (error) {
        console.error('[SW] Activation failed:', error);
      }
    })()
  );
});

// Check if we're in development mode
const isDev =
  self.location.hostname === 'localhost' ||
  self.location.hostname === '127.0.0.1';

// Fetch event - handle network requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // In development mode, bypass service worker completely for most requests
  if (isDev) {
    // Only cache static assets in dev, let everything else pass through
    if (
      !url.pathname.startsWith('/assets/') &&
      !url.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/i)
    ) {
      return; // Let the browser handle it normally
    }
  }

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip external requests
  if (
    url.origin !== self.location.origin &&
    !url.origin.includes('localhost')
  ) {
    return;
  }

  event.respondWith(handleRequest(request));
});

async function handleRequest(request) {
  const url = new URL(request.url);

  try {
    // Handle API requests
    if (url.pathname.startsWith('/api/')) {
      return handleAPIRequest(request);
    }

    // Handle static assets
    if (url.pathname.startsWith('/assets/')) {
      return handleStaticRequest(request);
    }

    // Handle images
    if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(url.pathname)) {
      return handleImageRequest(request);
    }

    // Handle fonts
    if (/\.(woff2?|eot|ttf|otf)$/i.test(url.pathname)) {
      return handleFontRequest(request);
    }

    // Handle navigation requests
    if (request.mode === 'navigate') {
      return handleNavigationRequest(request);
    }

    // Default: network first with cache fallback
    return networkFirst(request);
  } catch (error) {
    console.error('[SW] Request handling failed:', error);
    return new Response('Service Worker Error', { status: 500 });
  }
}

// API request handling
async function handleAPIRequest(request) {
  const url = new URL(request.url);

  // Check if this endpoint should never be cached
  const shouldNotCache = API_NO_CACHE_PATTERNS.some((pattern) =>
    pattern.test(url.pathname)
  );
  if (shouldNotCache) {
    return fetch(request);
  }

  // Check if this endpoint should be cached
  const shouldCache = API_CACHE_PATTERNS.some((pattern) =>
    pattern.test(url.pathname)
  );
  if (!shouldCache) {
    return networkFirst(request);
  }

  // Use stale-while-revalidate for API requests
  return staleWhileRevalidate(request, API_CACHE, CACHE_CONFIG.api);
}

// Static asset handling
async function handleStaticRequest(request) {
  // Cache first with network fallback for static assets
  return cacheFirst(request, STATIC_CACHE, CACHE_CONFIG.static);
}

// Image handling
async function handleImageRequest(request) {
  // Cache first for images
  return cacheFirst(request, IMAGE_CACHE, CACHE_CONFIG.images);
}

// Font handling
async function handleFontRequest(request) {
  // Cache first for fonts
  return cacheFirst(request, FONT_CACHE, CACHE_CONFIG.fonts);
}

// Navigation request handling
async function handleNavigationRequest(request) {
  try {
    // Try network first for navigation
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Fallback to cached index.html
    const cachedResponse = await caches.match('/');
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page if available
    const offlineResponse = await caches.match('/offline.html');
    if (offlineResponse) {
      return offlineResponse;
    }

    // Final fallback
    return new Response('Offline - No cached version available', {
      status: 503,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

// Caching strategies

async function cacheFirst(request, cacheName, config) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    if (cachedResponse && !isExpired(cachedResponse, config.maxAge)) {
      console.log(`[SW] Cache hit: ${request.url}`);
      return cachedResponse;
    }

    console.log(`[SW] Cache miss: ${request.url}`);
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      // Clean up cache before adding new entry
      await cleanCache(cacheName, config.maxEntries);
      await cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.warn(`[SW] Cache first failed for ${request.url}:`, error);

    // Try to return stale cache if network fails
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      console.log(`[SW] Returning stale cache: ${request.url}`);
      return cachedResponse;
    }

    throw error;
  }
}

async function networkFirst(
  request,
  cacheName = API_CACHE,
  config = CACHE_CONFIG.api
) {
  try {
    console.log(`[SW] Network first: ${request.url}`);

    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error('Network timeout')),
        config.networkTimeout
      );
    });

    // Race between network and timeout
    const networkResponse = await Promise.race([
      fetch(request),
      timeoutPromise,
    ]);

    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);

      // Clean up cache before adding new entry
      await cleanCache(cacheName, config.maxEntries);
      await cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.warn(
      `[SW] Network failed for ${request.url}, trying cache:`,
      error
    );

    // Fallback to cache
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    if (cachedResponse && !isExpired(cachedResponse, config.maxAge)) {
      console.log(`[SW] Returning cached response: ${request.url}`);
      return cachedResponse;
    }

    throw error;
  }
}

async function staleWhileRevalidate(request, cacheName, config) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    // Always try to fetch fresh data in background
    const networkPromise = fetch(request)
      .then(async (networkResponse) => {
        if (networkResponse.ok) {
          // Clean up cache before adding new entry
          await cleanCache(cacheName, config.maxEntries);
          await cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      })
      .catch((error) => {
        console.warn(`[SW] Background fetch failed for ${request.url}:`, error);
        return null;
      });

    // Return cached response immediately if available
    if (cachedResponse && !isExpired(cachedResponse, config.maxAge)) {
      console.log(`[SW] Serving stale cache: ${request.url}`);

      // Don't wait for network response
      networkPromise;

      return cachedResponse;
    }

    // Wait for network response if no cache available
    console.log(`[SW] No cache available, waiting for network: ${request.url}`);
    const networkResponse = await networkPromise;

    if (networkResponse) {
      return networkResponse;
    }

    throw new Error('No cache or network response available');
  } catch (error) {
    console.error(
      `[SW] Stale-while-revalidate failed for ${request.url}:`,
      error
    );
    throw error;
  }
}

// Utility functions

function isExpired(response, maxAge) {
  const dateHeader = response.headers.get('date');
  if (!dateHeader) return false;

  const responseDate = new Date(dateHeader).getTime();
  const now = Date.now();
  return now - responseDate > maxAge;
}

async function cleanCache(cacheName, maxEntries) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();

    if (keys.length > maxEntries) {
      // Sort keys by date (oldest first)
      const sortedKeys = keys.sort((a, b) => {
        const dateA = a.headers.get('date') || '';
        const dateB = b.headers.get('date') || '';
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      });

      // Delete oldest entries
      const keysToDelete = sortedKeys.slice(0, keys.length - maxEntries);
      await Promise.all(keysToDelete.map((key) => cache.delete(key)));

      console.log(
        `[SW] Cleaned ${keysToDelete.length} entries from ${cacheName}`
      );
    }
  } catch (error) {
    console.warn(`[SW] Cache cleanup failed for ${cacheName}:`, error);
  }
}

// Message handling for cache management
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CACHE_CLEAR':
      clearAllCaches()
        .then(() => {
          event.ports[0].postMessage({ success: true });
        })
        .catch((error) => {
          event.ports[0].postMessage({ success: false, error: error.message });
        });
      break;

    case 'CACHE_CLEAR_PATTERN':
      clearCacheByPattern(payload.pattern)
        .then(() => {
          event.ports[0].postMessage({ success: true });
        })
        .catch((error) => {
          event.ports[0].postMessage({ success: false, error: error.message });
        });
      break;

    case 'CACHE_WARMUP':
      warmupCache(payload.urls)
        .then(() => {
          event.ports[0].postMessage({ success: true });
        })
        .catch((error) => {
          event.ports[0].postMessage({ success: false, error: error.message });
        });
      break;

    default:
      console.warn(`[SW] Unknown message type: ${type}`);
  }
});

async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((name) => caches.delete(name)));
  console.log('[SW] All caches cleared');
}

async function clearCacheByPattern(pattern) {
  const cacheNames = await caches.keys();
  const regex = new RegExp(pattern);

  for (const cacheName of cacheNames) {
    if (regex.test(cacheName)) {
      await caches.delete(cacheName);
      console.log(`[SW] Cleared cache: ${cacheName}`);
    }
  }
}

async function warmupCache(urls) {
  const staticCache = await caches.open(STATIC_CACHE);

  const promises = urls.map(async (url) => {
    try {
      const response = await fetch(url);
      if (response.ok) {
        await staticCache.put(url, response);
        console.log(`[SW] Warmed up cache: ${url}`);
      }
    } catch (error) {
      console.warn(`[SW] Failed to warm up cache: ${url}`, error);
    }
  });

  await Promise.all(promises);
  console.log('[SW] Cache warmup completed');
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(handleBackgroundSync());
  }
});

async function handleBackgroundSync() {
  try {
    // Get all pending sync requests from IndexedDB
    const pendingRequests = await getPendingSyncRequests();

    for (const request of pendingRequests) {
      try {
        const response = await fetch(request.url, request.options);

        if (response.ok) {
          await removeSyncRequest(request.id);
          console.log(`[SW] Background sync successful: ${request.url}`);
        } else {
          console.warn(`[SW] Background sync failed: ${request.url}`);
        }
      } catch (error) {
        console.error(`[SW] Background sync error: ${request.url}`, error);
      }
    }

    console.log('[SW] Background sync completed');
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// Helper functions for IndexedDB (simplified)
async function getPendingSyncRequests() {
  // This would interact with IndexedDB to get pending requests
  // For now, return empty array
  return [];
}

async function removeSyncRequest(id) {
  // This would remove the request from IndexedDB
  console.log(`[SW] Removed sync request: ${id}`);
}

// Note: Performance monitoring is handled within the main fetch handler above.
// Having a second fetch listener causes duplicate handling issues.

console.log('[SW] Service worker loaded successfully');
