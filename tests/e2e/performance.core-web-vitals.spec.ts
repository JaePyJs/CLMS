import { test, expect } from '@playwright/test';
import { AuthPage } from './page-objects/auth.page';
import { DashboardPage } from './page-objects/dashboard.page';

/**
 * Performance Testing with Core Web Vitals
 *
 * Tests performance metrics and Core Web Vitals for the CLMS application:
 * - Largest Contentful Paint (LCP) - Loading performance
 * - First Input Delay (FID) - Interactivity
 * - Cumulative Layout Shift (CLS) - Visual stability
 * - First Contentful Paint (FCP) - Initial loading
 * - Time to Interactive (TTI) - Full interactivity
 * - Speed Index - Visual progress
 *
 * Also tests:
 * - API response times
 * - Database query performance
 * - Asset loading optimization
 * - Memory usage
 * - Network performance
 * - Mobile performance
 */

test.describe('Performance - Core Web Vitals', () => {
  let authPage: AuthPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    dashboardPage = new DashboardPage(page);

    // Enable performance monitoring
    await page.addInitScript(() => {
      // Override performance APIs for better measurement
      if (window.PerformanceObserver) {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            console.log(`Performance: ${entry.name} - ${entry.duration}ms`);
          }
        });
        observer.observe({ entryTypes: ['navigation', 'paint', 'layout-shift', 'largest-contentful-paint'] });
      }
    });
  });

  test.describe('Loading Performance', () => {
    test('should meet Core Web Vitals on login page', async ({ page }) => {
      const startTime = Date.now();

      await authPage.goto();

      const loadTime = Date.now() - startTime;

      // Wait for page to be fully loaded
      await page.waitForLoadState('networkidle');

      // Get performance metrics
      const performanceMetrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const paintEntries = performance.getEntriesByType('paint');

        const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0;
        const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
        const lcp = lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1].startTime : 0;

        return {
          // Core Web Vitals
          fcp: Math.round(fcp),
          lcp: Math.round(lcp),
          domContentLoaded: Math.round(navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart),
          loadComplete: Math.round(navigation.loadEventEnd - navigation.loadEventStart),
          totalLoadTime: Math.round(navigation.loadEventEnd - navigation.fetchStart),

          // Resource metrics
          resourceCount: performance.getEntriesByType('resource').length,
          transferSize: navigation.transferSize || 0,
          encodedBodySize: navigation.encodedBodySize || 0,
        };
      });

      console.log('Login Page Performance Metrics:', performanceMetrics);

      // Core Web Vitals thresholds (good thresholds)
      expect(performanceMetrics.fcp).toBeLessThan(1800); // FCP should be under 1.8s
      expect(performanceMetrics.lcp).toBeLessThan(2500); // LCP should be under 2.5s
      expect(performanceMetrics.domContentLoaded).toBeLessThan(3000); // DOM should be ready in 3s
      expect(performanceMetrics.loadComplete).toBeLessThan(5000); // Full load under 5s
      expect(loadTime).toBeLessThan(5000); // Our measurement should align with performance API

      // Resource optimization
      expect(performanceMetrics.resourceCount).toBeLessThan(100); // Should not have too many resources
    });

    test('should have minimal layout shift', async ({ page }) => {
      await authPage.goto();

      // Measure Cumulative Layout Shift
      const clsScore = await page.evaluate(() => {
        return new Promise((resolve) => {
          let clsValue = 0;
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!(entry as any).hadRecentInput) {
                clsValue += (entry as any).value;
              }
            }
          });
          observer.observe({ entryTypes: ['layout-shift'] });

          // Wait a bit for layout shifts to occur
          setTimeout(() => {
            observer.disconnect();
            resolve(Math.round(clsValue * 1000) / 1000);
          }, 3000);
        });
      });

      console.log('Cumulative Layout Shift:', clsScore);

      // CLS should be under 0.1 for good user experience
      expect(clsValue).toBeLessThan(0.1);
    });

    test('should load assets efficiently', async ({ page }) => {
      await authPage.goto();

      // Analyze resource loading
      const resourceAnalysis = await page.evaluate(() => {
        const resources = performance.getEntriesByType('resource');
        const analysis = {
          total: resources.length,
          byType: {} as Record<string, number>,
          totalSize: 0,
          slowResources: [] as any[],
          cachedResources: 0
        };

        resources.forEach((resource) => {
          const type = resource.initiatorType || 'other';
          analysis.byType[type] = (analysis.byType[type] || 0) + 1;

          if ((resource as any).transferSize > 0) {
            analysis.totalSize += (resource as any).transferSize;
          }

          if ((resource as any).transferSize === 0 && (resource as any).encodedBodySize > 0) {
            analysis.cachedResources++;
          }

          if (resource.duration > 1000) {
            analysis.slowResources.push({
              name: resource.name,
              duration: Math.round(resource.duration),
              type: type
            });
          }
        });

        return analysis;
      });

      console.log('Resource Analysis:', resourceAnalysis);

      // Performance expectations
      expect(resourceAnalysis.total).toBeLessThan(50); // Should not have too many resources
      expect(resourceAnalysis.slowResources.length).toBeLessThan(3); // Should not have many slow resources

      // Check for optimal resource types
      expect(resourceAnalysis.byType['script']).toBeLessThan(10); // Not too many scripts
      expect(resourceAnalysis.byType['link']).toBeLessThan(15); // Reasonable number of stylesheets
    });

    test('should handle API responses quickly', async ({ page }) => {
      await authPage.goto();

      // Monitor API calls during login
      const apiResponses: any[] = [];

      page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/api/')) {
          const timing = await response.timing();
          apiResponses.push({
            url: url,
            status: response.status(),
            duration: timing.responseEnd,
            size: (await response.allHeaders())['content-length'] || 'unknown'
          });
        }
      });

      await authPage.login('admin', 'librarian123');

      console.log('API Response Times:', apiResponses);

      // Check API performance
      expect(apiResponses.length).toBeGreaterThan(0);

      for (const apiResponse of apiResponses) {
        expect(apiResponse.duration).toBeLessThan(3000); // API responses under 3s
        expect([200, 201, 304]).toContain(apiResponse.status); // Successful responses
      }

      // Calculate average response time
      const avgResponseTime = apiResponses.reduce((sum, response) => sum + response.duration, 0) / apiResponses.length;
      expect(avgResponseTime).toBeLessThan(1500); // Average under 1.5s
    });
  });

  test.describe('Dashboard Performance', () => {
    test.beforeEach(async ({ page }) => {
      await authPage.goto();
      await authPage.login('admin', 'librarian123');
    });

    test('should load dashboard tabs quickly', async ({ page }) => {
      const tabs = [
        'Dashboard',
        'Students',
        'Books',
        'Analytics',
        'Reports'
      ];

      const tabPerformance: any[] = [];

      for (const tab of tabs) {
        const startTime = Date.now();

        await dashboardPage.navigateToTab(tab);
        await page.waitForLoadState('networkidle');

        const loadTime = Date.now() - startTime;

        // Get performance metrics for this tab
        const tabMetrics = await page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation');
          const latestNav = navigation[navigation.length - 1] as PerformanceNavigationTiming;

          return {
            domContentLoaded: latestNav ? Math.round(latestNav.domContentLoadedEventEnd - latestNav.domContentLoadedEventStart) : 0,
            loadComplete: latestNav ? Math.round(latestNav.loadEventEnd - latestNav.loadEventStart) : 0
          };
        });

        tabPerformance.push({
          tab,
          loadTime,
          metrics: tabMetrics
        });

        console.log(`${tab} tab performance:`, { loadTime, metrics: tabMetrics });

        // Performance expectations for tab switching
        expect(loadTime).toBeLessThan(3000); // Tab switching under 3s
        expect(tabMetrics.domContentLoaded).toBeLessThan(2000); // DOM ready in 2s
      }

      // Check that performance is consistent across tabs
      const avgLoadTime = tabPerformance.reduce((sum, tab) => sum + tab.loadTime, 0) / tabPerformance.length;
      expect(avgLoadTime).toBeLessThan(2500); // Average tab load under 2.5s
    });

    test('should handle data-heavy operations efficiently', async ({ page }) => {
      // Test performance with large datasets
      await dashboardPage.navigateToStudentManagement();

      const startTime = Date.now();

      // Search with potentially large results
      await dashboardPage.searchStudent('');
      await page.waitForTimeout(2000); // Wait for search results

      const searchTime = Date.now() - startTime;

      console.log('Large dataset search time:', searchTime);

      // Even with large datasets, should be reasonably fast
      expect(searchTime).toBeLessThan(5000); // Search under 5s

      // Check memory usage
      const memoryInfo = await page.evaluate(() => {
        return (performance as any).memory ? {
          used: Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024),
          total: Math.round((performance as any).memory.totalJSHeapSize / 1024 / 1024),
          limit: Math.round((performance as any).memory.jsHeapSizeLimit / 1024 / 1024)
        } : null;
      });

      if (memoryInfo) {
        console.log('Memory usage:', memoryInfo);

        // Memory usage should be reasonable
        expect(memoryInfo.used).toBeLessThan(100); // Under 100MB
        expect(memoryInfo.used / memoryInfo.limit).toBeLessThan(0.5); // Using less than 50% of available memory
      }
    });

    test('should maintain performance under stress', async ({ page }) => {
      // Test performance with rapid tab switching
      const tabs = ['Students', 'Books', 'Equipment', 'Analytics'];
      const stressTestDuration = 10000; // 10 seconds
      const startTime = Date.now();

      let tabSwitchCount = 0;
      const performanceDuringStress: any[] = [];

      while (Date.now() - startTime < stressTestDuration) {
        const tab = tabs[tabSwitchCount % tabs.length];
        const tabStartTime = Date.now();

        await dashboardPage.navigateToTab(tab);

        const tabTime = Date.now() - tabStartTime;
        performanceDuringStress.push({ tab, time: tabTime });

        tabSwitchCount++;
      }

      console.log(`Completed ${tabSwitchCount} tab switches in ${stressTestDuration}ms`);
      console.log('Performance during stress:', performanceDuringStress);

      // Performance should remain consistent
      const avgTime = performanceDuringStress.reduce((sum, perf) => sum + perf.time, 0) / performanceDuringStress.length;
      const maxTime = Math.max(...performanceDuringStress.map(p => p.time));

      expect(avgTime).toBeLessThan(2000); // Average under 2s even under stress
      expect(maxTime).toBeLessThan(5000); // Even worst case under 5s
      expect(tabSwitchCount).toBeGreaterThan(5); // Should complete multiple switches
    });
  });

  test.describe('Mobile Performance', () => {
    test('should perform well on mobile devices', async ({ page }) => {
      // Set mobile viewport and simulate mobile network
      await page.setViewportSize({ width: 375, height: 667 });

      // Simulate 3G network
      await page.route('**/*', async (route) => {
        // Add random delay to simulate 3G
        const delay = Math.random() * 300 + 100; // 100-400ms delay
        await new Promise(resolve => setTimeout(resolve, delay));
        await route.continue();
      });

      const startTime = Date.now();

      await authPage.goto();
      await authPage.login('admin', 'librarian123');

      const mobileLoadTime = Date.now() - startTime;

      console.log('Mobile load time (3G simulation):', mobileLoadTime);

      // Mobile performance expectations (more lenient due to network)
      expect(mobileLoadTime).toBeLessThan(15000); // Mobile load under 15s on 3G

      // Test mobile tab performance
      const tabStartTime = Date.now();
      await dashboardPage.navigateToStudentManagement();
      const mobileTabTime = Date.now() - tabStartTime;

      expect(mobileTabTime).toBeLessThan(8000); // Mobile tab switching under 8s
    });

    test('should handle touch interactions efficiently', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await authPage.goto();
      await authPage.login('admin', 'librarian123');

      // Test touch response time
      const touchStartTime = Date.now();

      await page.tap('[data-testid="mobile-menu-toggle"]');
      await page.waitForSelector('[data-testid="mobile-menu"]', { state: 'visible' });

      const touchResponseTime = Date.now() - touchStartTime;

      console.log('Touch response time:', touchResponseTime);

      // Touch interactions should be responsive
      expect(touchResponseTime).toBeLessThan(500); // Touch response under 500ms

      // Test swipe gestures if implemented
      const swipeStartTime = Date.now();

      // Simulate swipe
-      await page.touch().move(300, 100);
-      await page.touch().down();
-      await page.touch().move(100, 100, { steps: 5 });
-      await page.touch().up();
+      await page.touchscreen.down(300, 100);
+      await page.touchscreen.move(100, 100);
+      await page.touchscreen.up();

      await page.waitForTimeout(500); // Wait for swipe to process

      const swipeTime = Date.now() - swipeStartTime;

      console.log('Swipe gesture time:', swipeTime);
      expect(swipeTime).toBeLessThan(1000); // Swipe gestures under 1s
    });
  });

  test.describe('Network Performance', () => {
    test('should optimize network requests', async ({ page }) => {
      await authPage.goto();

      // Analyze network requests
      const networkAnalysis = await page.evaluate(() => {
        const resources = performance.getEntriesByType('resource');
        return {
          totalRequests: resources.length,
          totalSize: resources.reduce((sum, resource) => sum + ((resource as any).transferSize || 0), 0),
          compressedRequests: resources.filter(r => (r as any).encodedBodySize < (r as any).decodedBodySize).length,
          cachedResponses: resources.filter(r => (r as any).transferSize === 0 && (r as any).encodedBodySize > 0).length,
          slowRequests: resources.filter(r => r.duration > 1000).map(r => ({
            name: r.name,
            duration: Math.round(r.duration),
            size: (r as any).transferSize || 0
          }))
        };
      });

      console.log('Network Analysis:', networkAnalysis);

      // Network optimization expectations
      expect(networkAnalysis.totalRequests).toBeLessThan(30); // Should not have too many requests
      expect(networkAnalysis.totalSize).toBeLessThan(3 * 1024 * 1024); // Under 3MB total
      expect(networkAnalysis.compressedRequests).toBeGreaterThan(networkAnalysis.totalRequests * 0.7); // 70%+ should be compressed
      expect(networkAnalysis.slowRequests.length).toBeLessThan(2); // Minimal slow requests
    });

    test('should handle network failures gracefully', async ({ page }) => {
      // Simulate network failure
      await page.route('**/api/**', route => route.abort());

      await authPage.goto();

      const errorStartTime = Date.now();
      await authPage.login('admin', 'librarian123');
      const errorHandlingTime = Date.now() - errorStartTime;

      console.log('Network error handling time:', errorHandlingTime);

      // Should handle network failures quickly
      expect(errorHandlingTime).toBeLessThan(5000); // Error handling under 5s

      // Should show appropriate error message
      const errorMessage = await authPage.getErrorMessage();
      expect(errorMessage).toMatch(/network|connection|error/i);
    });

    test('should implement caching strategies', async ({ page }) => {
      await authPage.goto();
      await authPage.login('admin', 'librarian123');

      // Navigate to a tab and come back
      await dashboardPage.navigateToStudentManagement();
      await page.waitForTimeout(2000);

      const cacheStartTime = Date.now();
      await dashboardPage.navigateToDashboard();
      await page.waitForTimeout(1000);
      const cacheTime = Date.now() - cacheStartTime;

      console.log('Cached navigation time:', cacheTime);

      // Cached navigation should be faster
      expect(cacheTime).toBeLessThan(1500); // Cached navigation under 1.5s
    });
  });

  test.describe('Performance Monitoring', () => {
    test('should track performance metrics', async ({ page }) => {
      // Custom performance tracking
      const performanceTracking = await page.evaluate(() => {
        const metrics = {
          navigation: performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming,
          paint: performance.getEntriesByType('paint'),
          resource: performance.getEntriesByType('resource'),
          longTasks: performance.getEntriesByType('longtask')
        };

        const fcp = metrics.paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0;
        const lcp = Math.max(...(performance.getEntriesByType('largest-contentful-paint').map((e: any) => e.startTime) || [0]));

        return {
          // Core Web Vitals
          fcp: Math.round(fcp),
          lcp: Math.round(lcp),
          cls: Math.round((metrics.longTasks.reduce((sum, task) => sum + task.duration, 0) / 1000) * 100) / 100,

          // Other metrics
          ttfb: Math.round(metrics.navigation.responseStart - metrics.navigation.requestStart),
          domInteractive: Math.round(metrics.navigation.domInteractive - metrics.navigation.navigationStart),
          firstMeaningfulPaint: Math.round(performance.getEntriesByName('first-meaningful-paint')[0]?.startTime || 0),

          // Resource metrics
          totalResources: metrics.resource.length,
          totalTransferSize: metrics.resource.reduce((sum, r) => sum + ((r as any).transferSize || 0), 0),

          // Long tasks (indicator of jank)
          longTaskCount: metrics.longTasks.length,
          longTaskDuration: Math.round(metrics.longTasks.reduce((sum, task) => sum + task.duration, 0))
        };
      });

      console.log('Comprehensive Performance Metrics:', performanceTracking);

      // Performance score calculation
      const performanceScore = calculatePerformanceScore(performanceTracking);
      console.log('Performance Score:', performanceScore);

      expect(performanceScore).toBeGreaterThan(70); // Should score above 70%
    });

    test('should detect performance regressions', async ({ page }) => {
      // Baseline performance measurement
      const baseline = await measurePagePerformance(page, authPage);

      // Simulate performance degradation by adding artificial delays
      await page.route('**/*', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 500)); // Add 500ms delay
        await route.continue();
      });

      // Measure with degradation
      const degraded = await measurePagePerformance(page, authPage);

      console.log('Performance Comparison:', { baseline, degraded });

      // Should detect significant performance degradation
      const performanceDrop = ((degraded.totalLoadTime - baseline.totalLoadTime) / baseline.totalLoadTime) * 100;

      console.log(`Performance degradation: ${performanceDrop.toFixed(1)}%`);

      expect(performanceDrop).toBeGreaterThan(30); // Should detect at least 30% degradation
    });
  });

  test.describe('Database Performance', () => {
    test('should handle database queries efficiently', async ({ page }) => {
      await authPage.goto();
      await authPage.login('admin', 'librarian123');

      // Monitor database-related API calls
      const dbPerformance: any[] = [];

      page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/api/students') || url.includes('/api/books') || url.includes('/api/analytics')) {
          const timing = await response.timing();
          dbPerformance.push({
            endpoint: url,
            duration: timing.responseEnd,
            type: 'database-query'
          });
        }
      });

      // Test database-heavy operations
      await dashboardPage.navigateToStudentManagement();
      await page.waitForTimeout(2000);

      await dashboardPage.searchStudent('');
      await page.waitForTimeout(2000);

      await dashboardPage.navigateToBookCatalog();
      await page.waitForTimeout(2000);

      console.log('Database Query Performance:', dbPerformance);

      // Database queries should be efficient
      expect(dbPerformance.length).toBeGreaterThan(0);

      for (const query of dbPerformance) {
        expect(query.duration).toBeLessThan(2000); // Database queries under 2s
      }

      const avgQueryTime = dbPerformance.reduce((sum, query) => sum + query.duration, 0) / dbPerformance.length;
      expect(avgQueryTime).toBeLessThan(1000); // Average under 1s
    });
  });
});

/**
 * Helper function to measure page performance
 */
async function measurePagePerformance(page: any, authPage: AuthPage): Promise<any> {
  const startTime = Date.now();
  await authPage.goto();
  const loadTime = Date.now() - startTime;

  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return {
      fcp: Math.round(performance.getEntriesByType('paint').find((p: any) => p.name === 'first-contentful-paint')?.startTime || 0),
      domLoad: Math.round(navigation.domContentLoadedEventEnd - navigation.fetchStart),
      totalLoadTime: Math.round(navigation.loadEventEnd - navigation.fetchStart)
    };
  });

  return {
    totalLoadTime: loadTime,
    ...metrics
  };
}

/**
 * Calculate performance score based on metrics
 */
function calculatePerformanceScore(metrics: any): number {
  const weights = {
    fcp: 0.25,
    lcp: 0.25,
    ttfb: 0.15,
    domInteractive: 0.15,
    totalResources: 0.10,
    longTaskDuration: 0.10
  };

  const scores = {
    fcp: Math.max(0, 100 - (metrics.fcp / 1800) * 100), // 1800ms = 0 points
    lcp: Math.max(0, 100 - (metrics.lcp / 2500) * 100), // 2500ms = 0 points
    ttfb: Math.max(0, 100 - (metrics.ttfb / 600) * 100),  // 600ms = 0 points
    domInteractive: Math.max(0, 100 - (metrics.domInteractive / 3000) * 100), // 3000ms = 0 points
    totalResources: Math.max(0, 100 - (metrics.totalResources / 50) * 100), // 50 resources = 0 points
    longTaskDuration: Math.max(0, 100 - (metrics.longTaskDuration / 200) * 100) // 200ms = 0 points
  };

  const totalScore = Object.entries(weights).reduce((sum, [key, weight]) => {
    return sum + (scores[key as keyof typeof scores] * weight);
  }, 0);

  return Math.round(totalScore);
}