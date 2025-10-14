import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'
import viteCompression from 'vite-plugin-compression'
import imagemin from 'vite-plugin-imagemin'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // PWA plugin for service worker and caching
    // Temporarily disabled during development
    // VitePWA({
    //   registerType: 'autoUpdate',
    //   includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
    //   manifest: {
    //     name: 'CLMS - Library Management System',
    //     short_name: 'CLMS',
    //     description: 'Comprehensive Library Management System',
    //     theme_color: '#2563eb',
    //     background_color: '#ffffff',
    //     display: 'standalone',
    //     icons: [
    //       {
    //         src: 'pwa-192x192.png',
    //         sizes: '192x192',
    //         type: 'image/png'
    //       },
    //       {
    //         src: 'pwa-512x512.png',
    //         sizes: '512x512',
    //         type: 'image/png'
    //       }
    //     ]
    //   },
    //   workbox: {
    //     globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
    //     runtimeCaching: [
    //       {
    //         urlPattern: /^https:\/\/api\./i,
    //         handler: 'NetworkFirst',
    //         options: {
    //           cacheName: 'api-cache',
    //           expiration: {
    //             maxEntries: 100,
    //             maxAgeSeconds: 60 * 60 * 24 // 24 hours
    //           },
    //           cacheKeyWillBeUsed: async ({ request }) => {
    //             return `${request.url}?version=1`
    //           }
    //         }
    //       },
    //       {
    //         urlPattern: /\.(?:png|jpg|jpeg|svg)$/,
    //         handler: 'CacheFirst',
    //         options: {
    //           cacheName: 'images-cache',
    //           expiration: {
    //             maxEntries: 100,
    //             maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
    //           }
    //         }
    //       }
    //     ]
    //   }
    // }),
    // Compression plugin for production builds
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz'
    }),
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br'
    }),
    // Bundle analyzer
    visualizer({
      filename: 'dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true
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
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    },
    cacheDir: 'node_modules/.vite-custom-cache',
    // Enable HTTP/2 for development
    https: false,
    // Enable file watching optimizations
    watch: {
      usePolling: false,
      interval: 100
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // Disable sourcemaps in production for smaller bundle
    minify: 'terser',
    target: 'es2015',
    // Optimize build for production
    cssMinify: true,
    cssCodeSplit: true,

    rollupOptions: {
      output: {
        // Advanced code splitting strategy
        manualChunks: (id) => {
          // Core React and React DOM
          if (id.includes('react') || id.includes('react-dom')) {
            return 'react-vendor';
          }

          // Radix UI components
          if (id.includes('@radix-ui')) {
            return 'radix-ui';
          }

          // State management and data fetching
          if (id.includes('@tanstack') || id.includes('zustand')) {
            return 'state-management';
          }

          // Charts and visualization
          if (id.includes('recharts') || id.includes('d3')) {
            return 'charts';
          }

          // Utility libraries
          if (id.includes('axios') || id.includes('date-fns') ||
              id.includes('clsx') || id.includes('tailwind-merge') ||
              id.includes('lodash')) {
            return 'utils';
          }

          // Icon libraries
          if (id.includes('lucide-react')) {
            return 'icons';
          }

          // Animation libraries
          if (id.includes('framer-motion')) {
            return 'animations';
          }

          // Barcode/QR code libraries
          if (id.includes('@zxing') || id.includes('qrcode')) {
            return 'scanning';
          }

          // PDF generation libraries
          if (id.includes('pdf-lib') || id.includes('jspdf')) {
            return 'pdf';
          }

          // Large vendor chunks
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },

        // Optimize chunk file naming for caching
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'chunk';
          return `assets/js/[name]-[hash].js`;
        },
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') || [];
          const extType = info[info.length - 1];

          // Organize assets by type for better caching
          if (/\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/i.test(assetInfo.name || '')) {
            return 'assets/media/[name]-[hash].[ext]';
          }
          if (/\.(png|jpe?g|gif|svg|webp)(\?.*)?$/i.test(assetInfo.name || '')) {
            return 'assets/images/[name]-[hash].[ext]';
          }
          if (/\.(woff2?|eot|ttf|otf)(\?.*)?$/i.test(assetInfo.name || '')) {
            return 'assets/fonts/[name]-[hash].[ext]';
          }
          if (extType === 'css') {
            return 'assets/css/[name]-[hash].[ext]';
          }
          return `assets/${extType}/[name]-[hash].[ext]`;
        }
      },

      // External dependencies optimization
      external: [],

      // Treeshaking optimization
      treeshake: 'smallest'
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
      'axios',
      'date-fns',
      'framer-motion'
    ],
    exclude: [
      '@tanstack/react-query-devtools' // Exclude dev tools from production bundle
    ],
    // Pre-bundle dependencies for faster dev server
    force: false,
    // Optimize for production builds
    includeBuilds: true
  },

  define: {
    // Remove devtools from production
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    // Enable production optimizations
    __DEV__: process.env.NODE_ENV !== 'production'
  },

  // Environment variables optimization
  envPrefix: 'VITE_',

  // CSS optimization
  css: {
    devSourcemap: false,
    preprocessorOptions: {
      scss: {
        additionalData: `@import "@/styles/variables.scss";`
      }
    }
  },

  // Experimental features for performance
  experimental: {
    renderBuiltUrl: (filename, { hostType }) => {
      if (hostType === 'js') {
        return { js: `/${filename}` };
      } else {
        return { relative: true };
      }
    }
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup-comprehensive.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'src/test/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        'coverage/**',
        '**/*.spec.ts',
        '**/factories/**',
        '**/mocks/**',
        'vite.config.ts'
      ],
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        },
        // Lower thresholds for complex components
        'src/components/dashboard/**': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85
        }
      }
    },
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    exclude: [
      'node_modules/',
      'dist/',
      '**/*.d.ts',
      'coverage/**'
    ],
    testTimeout: 10000,
    hookTimeout: 10000,
    sequence: {
      concurrent: false,
      shuffle: false
    }
  },

  // Preview server configuration
  preview: {
    port: 4173,
    host: true,
    https: false
  }
})