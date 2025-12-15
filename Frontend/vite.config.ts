import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import viteCompression from 'vite-plugin-compression';
import imagemin from 'vite-plugin-imagemin';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // PWA plugin for service worker and caching (temporarily disabled due to workbox validation issues)
    ...(process.env.ENABLE_PWA === 'true'
      ? [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: [
              'favicon.ico',
              'apple-touch-icon.png',
              'masked-icon.svg',
              'robots.txt',
              'manifest.webmanifest',
            ],
            strategies: 'generateSW',
            manifest: {
              name: 'CLMS - Library Management System',
              short_name: 'CLMS',
              description:
                'Comprehensive Library Management System for educational institutions',
              theme_color: '#2563eb',
              background_color: '#ffffff',
              display: 'standalone',
              orientation: 'portrait-primary',
              scope: '/',
              start_url: '/',
              id: '/',
              icons: [
                {
                  src: 'pwa-192x192.png',
                  sizes: '192x192',
                  type: 'image/png',
                  purpose: 'any maskable',
                },
                {
                  src: 'pwa-512x512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'any maskable',
                },
                {
                  src: 'apple-touch-icon.png',
                  sizes: '180x180',
                  type: 'image/png',
                  purpose: 'apple touch icon',
                },
              ],
              shortcuts: [
                {
                  name: 'Quick Scan',
                  short_name: 'Scan',
                  description: 'Quick barcode/QR scanning',
                  url: '/?tab=scan',
                  icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
                },
                {
                  name: 'Book Checkout',
                  short_name: 'Checkout',
                  description: 'Quick book checkout',
                  url: '/?tab=checkout',
                  icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
                },
              ],
              categories: ['education', 'productivity', 'utilities'],
              lang: 'en',
              dir: 'ltr',
            },
            workbox: {
              globPatterns: [
                '**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff,woff2,ttf,eot}',
              ],
              runtimeCaching: [
                {
                  urlPattern: /^https:\/\/api\./i,
                  handler: 'NetworkFirst',
                  options: {
                    cacheName: 'api-cache',
                    expiration: {
                      maxEntries: 100,
                      maxAgeSeconds: 60 * 60 * 24, // 24 hours
                    },
                    // Removed deprecated cacheKeyWillBeUsed option
                    // Cache key will be automatically generated
                    networkTimeoutSeconds: 10,
                    fetchOptions: {
                      cache: 'no-store',
                    },
                  },
                },
                {
                  urlPattern: /\.(?:png|jpg|jpeg|svg|webp|avif)$/,
                  handler: 'CacheFirst',
                  options: {
                    cacheName: 'images-cache',
                    expiration: {
                      maxEntries: 200,
                      maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                    },
                    // Removed deprecated cacheKeyWillBeUsed option
                    // Cache key will be automatically generated
                  },
                },
                {
                  urlPattern: /\.(?:woff|woff2|ttf|eot)$/,
                  handler: 'CacheFirst',
                  options: {
                    cacheName: 'fonts-cache',
                    expiration: {
                      maxEntries: 50,
                      maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                    },
                  },
                },
                {
                  urlPattern: /\.(?:js|css)$/,
                  handler: 'StaleWhileRevalidate',
                  options: {
                    cacheName: 'static-cache',
                    expiration: {
                      maxEntries: 100,
                      maxAgeSeconds: 60 * 60 * 24, // 24 hours
                    },
                  },
                },
                {
                  urlPattern: /^https:\/\/cdn\./i,
                  handler: 'CacheFirst',
                  options: {
                    cacheName: 'cdn-cache',
                    expiration: {
                      maxEntries: 100,
                      maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
                    },
                  },
                },
              ],
              cleanupOutdatedCaches: true,
              skipWaiting: true,
              clientsClaim: true,
            },
            injectRegister: 'auto',
            injectManifest: {
              globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
            },
            devOptions: {
              enabled: false,
              type: 'module',
            },
          }),
        ]
      : []),
    // Compression plugin for production builds
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
    }),
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
    }),
    // Bundle analyzer
    visualizer({
      filename: 'dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
    // Image optimization plugin
    imagemin({
      gifsicle: {
        optimizationLevel: 7,
        interlaced: false,
      },
      optipng: {
        optimizationLevel: 7,
      },
      mozjpeg: {
        quality: 80,
      },
      pngquant: {
        quality: [0.8, 0.9],
        speed: 4,
      },
      svgo: {
        plugins: [
          {
            name: 'removeViewBox',
          },
          {
            name: 'removeEmptyAttrs',
            active: false,
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: process.env.NODE_ENV === 'test' ? 3001 : 3000,
    host: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://127.0.0.1:3001',
        changeOrigin: true,
        rewrite: (path) => path,
      },
      '/socket.io': {
        target: process.env.VITE_API_URL || 'http://127.0.0.1:3001',
        changeOrigin: true,
        ws: true,
      },
      '/ws': {
        target: process.env.VITE_API_URL || 'http://127.0.0.1:3001',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path,
      },
    },
    // Removed invalid cacheDir configuration
    // Enable HTTP/2 for development server
    // Removed HTTPS configuration for development server
    // Enable file watching optimizations
    watch: {
      usePolling: false,
      interval: 100,
    },
    // T029: Error handling configuration
    hmr: {
      overlay: false,
      host: 'localhost',
      port: 3000,
      protocol: 'ws',
    },
    // Prevent server crashes on errors
    strictPort: false, // Fallback to next port if busy
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: false, // Disable minification to debug
    target: 'es2015',
    // Optimize build for production
    cssMinify: true,
    cssCodeSplit: true,

    rollupOptions: {
      output: {
        // Advanced code splitting strategy
        manualChunks: undefined, // Disable manual chunks to simplify
      },
      // External dependencies optimization
      external: [],

      // Treeshaking optimization
      treeshake: false, // Disable treeshaking to avoid issues
    },

    // Performance optimizations
    chunkSizeWarningLimit: 1000,
    // Enable more aggressive code splitting
    reportCompressedSize: true,
    // Optimize for mobile
    assetsInlineLimit: 4096, // 4kb
  },

  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'lucide-react',
      '@tanstack/react-query',
      'date-fns',
      'framer-motion',
    ],
    exclude: ['axios', '@tanstack/react-query-devtools'],
    force: false,
  },

  define: {
    // Remove devtools from production
    'process.env.NODE_ENV': JSON.stringify(
      process.env.NODE_ENV || 'development'
    ),
    // Enable production optimizations
    __DEV__: process.env.NODE_ENV !== 'production',
  },

  // Environment variables optimization
  envPrefix: 'VITE_',

  // CSS optimization
  css: {
    devSourcemap: false,
    preprocessorOptions: {
      scss: {
        additionalData: `@import "@/styles/variables.scss";`,
      },
    },
  },

  // Experimental features for performance
  experimental: {
    renderBuiltUrl: (filename, { hostType }) => {
      if (hostType === 'js') {
        return { js: `/${filename}` };
      } else {
        return { relative: true };
      }
    },
  },

  // Test configuration moved to vitest.config.ts

  // Preview server configuration
  preview: {
    port: 4173,
    host: true,
    // HTTPS configuration handled separately if needed
  },
});
