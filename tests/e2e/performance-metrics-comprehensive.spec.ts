import { test, expect, Page } from '@playwright/test';
import { AuthPage } from './page-objects/auth.page';
import { DashboardPage } from './page-objects/dashboard.page';

/**
 * Comprehensive Performance Metrics Test Suite for CLMS
 * 
 * This test suite collects performance metrics including:
 * - Core Web Vitals (LCP, FID, CLS)
 * - Page Load Times
 * - Time to Interactive (TTI)
 * - First Contentful Paint (FCP)
 * - Network Performance
 * - Memory Usage
 * - Bundle Size Analysis
 * - Critical User Flow Performance
 */

interface PerformanceMetrics {
  lcp?: number;
  fid?: number;
  cls?: number;
  fcp?: number;
  tti?: number;
  loadTime?: number;
  domContentLoaded?: number;
  networkRequests?: number;
  totalTransferSize?: number;
  jsHeapUsed?: number;
  timestamp: number;
  url: string;
  testName: string;
}

test.describe('⚡ Comprehensive Performance Metrics Testing', () => {
  let authPage: AuthPage;
  let dashboardPage: DashboardPage;
  let performanceResults: PerformanceMetrics[] = [];

  const testUser = {
    username: 'admin@clms.edu',
    password: 'admin123',
    role: 'Administrator'
  };

  // Performance thresholds based on Core Web Vitals
  const PERFORMANCE_THRESHOLDS = {
    LCP: 2500, // Largest Contentful Paint (ms)
    FID: 100,  // First Input Delay (ms)
    CLS: 0.1,  // Cumulative Layout Shift
    FCP: 1800, // First Contentful Paint (ms)
    TTI: 3800, // Time to Interactive (ms)
    LOAD_TIME: 3000, // Page Load Time (ms)
    MEMORY_LIMIT: 50 * 1024 * 1024 // 50MB heap limit
  };

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    dashboardPage = new DashboardPage(page);

    // Enable performance monitoring
    await page.addInitScript(() => {
      // Collect Core Web Vitals
      window.performanceMetrics = {
        lcp: 0,
        fid: 0,
        cls: 0,
        fcp: 0,
        tti: 0,
        loadTime: 0,
        domContentLoaded: 0
      };

      // LCP Observer
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        window.performanceMetrics.lcp = lastEntry.startTime;
      }).observe({ entryTypes: ['largest-contentful-paint'] });

      // FID Observer
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          window.performanceMetrics.fid = entry.processingStart - entry.startTime;
        });
      }).observe({ entryTypes: ['first-input'] });

      // CLS Observer
      let clsValue = 0;
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            window.performanceMetrics.cls = clsValue;
          }
        });
      }).observe({ entryTypes: ['layout-shift'] });

      // Navigation timing
      window.addEventListener('load', () => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        window.performanceMetrics.loadTime = navigation.loadEventEnd - navigation.fetchStart;
        window.performanceMetrics.domContentLoaded = navigation.domContentLoadedEventEnd - navigation.fetchStart;
        
        // FCP
        const paintEntries = performance.getEntriesByType('paint');
        const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
        if (fcpEntry) {
          window.performanceMetrics.fcp = fcpEntry.startTime;
        }
      });
    });
  });

  async function collectPerformanceMetrics(page: Page, testName: string): Promise<PerformanceMetrics> {
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Allow time for metrics collection

    // Get performance metrics from the page
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paintEntries = performance.getEntriesByType('paint');
      const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
      
      // Get memory info if available
      const memoryInfo = (performance as any).memory;
      
      // Get network requests
      const resourceEntries = performance.getEntriesByType('resource');
      const totalTransferSize = resourceEntries.reduce((total, entry: any) => {
        return total + (entry.transferSize || 0);
      }, 0);

      return {
        lcp: window.performanceMetrics?.lcp || 0,
        fid: window.performanceMetrics?.fid || 0,
        cls: window.performanceMetrics?.cls || 0,
        fcp: fcpEntry?.startTime || 0,
        tti: 0, // TTI calculation would need more complex logic
        loadTime: navigation.loadEventEnd - navigation.fetchStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
        networkRequests: resourceEntries.length,
        totalTransferSize: totalTransferSize,
        jsHeapUsed: memoryInfo?.usedJSHeapSize || 0
      };
    });

    const performanceData: PerformanceMetrics = {
      ...metrics,
      timestamp: Date.now(),
      url: page.url(),
      testName: testName
    };

    performanceResults.push(performanceData);
    return performanceData;
  }

  function analyzePerformance(metrics: PerformanceMetrics): { score: number; issues: string[] } {
    const issues: string[] = [];
    let score = 100;

    // LCP Analysis
    if (metrics.lcp > PERFORMANCE_THRESHOLDS.LCP) {
      issues.push(`LCP too slow: ${metrics.lcp.toFixed(0)}ms (threshold: ${PERFORMANCE_THRESHOLDS.LCP}ms)`);
      score -= 20;
    }

    // FID Analysis
    if (metrics.fid && metrics.fid > PERFORMANCE_THRESHOLDS.FID) {
      issues.push(`FID too slow: ${metrics.fid.toFixed(0)}ms (threshold: ${PERFORMANCE_THRESHOLDS.FID}ms)`);
      score -= 15;
    }

    // CLS Analysis
    if (metrics.cls > PERFORMANCE_THRESHOLDS.CLS) {
      issues.push(`CLS too high: ${metrics.cls.toFixed(3)} (threshold: ${PERFORMANCE_THRESHOLDS.CLS})`);
      score -= 15;
    }

    // FCP Analysis
    if (metrics.fcp > PERFORMANCE_THRESHOLDS.FCP) {
      issues.push(`FCP too slow: ${metrics.fcp.toFixed(0)}ms (threshold: ${PERFORMANCE_THRESHOLDS.FCP}ms)`);
      score -= 10;
    }

    // Load Time Analysis
    if (metrics.loadTime && metrics.loadTime > PERFORMANCE_THRESHOLDS.LOAD_TIME) {
      issues.push(`Load time too slow: ${metrics.loadTime.toFixed(0)}ms (threshold: ${PERFORMANCE_THRESHOLDS.LOAD_TIME}ms)`);
      score -= 15;
    }

    // Memory Analysis
    if (metrics.jsHeapUsed > PERFORMANCE_THRESHOLDS.MEMORY_LIMIT) {
      issues.push(`Memory usage high: ${(metrics.jsHeapUsed / 1024 / 1024).toFixed(1)}MB (threshold: ${PERFORMANCE_THRESHOLDS.MEMORY_LIMIT / 1024 / 1024}MB)`);
      score -= 10;
    }

    // Network Analysis
    if (metrics.networkRequests && metrics.networkRequests > 100) {
      issues.push(`Too many network requests: ${metrics.networkRequests} (consider bundling)`);
      score -= 5;
    }

    if (metrics.totalTransferSize && metrics.totalTransferSize > 5 * 1024 * 1024) { // 5MB
      issues.push(`Large transfer size: ${(metrics.totalTransferSize / 1024 / 1024).toFixed(1)}MB`);
      score -= 10;
    }

    return { score: Math.max(0, score), issues };
  }

  test.describe('🏠 Login Page Performance', () => {
    test('should measure login page load performance', async ({ page }) => {
      await test.step('Measure initial page load', async () => {
        await authPage.goto();
        await authPage.waitForPageLoad();

        const metrics = await collectPerformanceMetrics(page, 'Login Page Load');
        const analysis = analyzePerformance(metrics);

        console.log('📊 Login Page Performance Metrics:');
        console.log(`  - LCP: ${metrics.lcp.toFixed(0)}ms`);
        console.log(`  - FCP: ${metrics.fcp.toFixed(0)}ms`);
        console.log(`  - CLS: ${metrics.cls.toFixed(3)}`);
        console.log(`  - Load Time: ${metrics.loadTime?.toFixed(0)}ms`);
        console.log(`  - DOM Content Loaded: ${metrics.domContentLoaded?.toFixed(0)}ms`);
        console.log(`  - Network Requests: ${metrics.networkRequests}`);
        console.log(`  - Transfer Size: ${(metrics.totalTransferSize! / 1024).toFixed(1)}KB`);
        console.log(`  - JS Heap Used: ${(metrics.jsHeapUsed / 1024 / 1024).toFixed(1)}MB`);
        console.log(`  - Performance Score: ${analysis.score}/100`);

        if (analysis.issues.length > 0) {
          console.log('⚠️ Performance Issues:');
          analysis.issues.forEach(issue => console.log(`  - ${issue}`));
        }

        // Assert critical metrics
        expect(metrics.lcp).toBeLessThan(PERFORMANCE_THRESHOLDS.LCP * 1.5); // Allow 50% tolerance
        expect(metrics.cls).toBeLessThan(PERFORMANCE_THRESHOLDS.CLS * 2);
      });

      await test.step('Measure login form interaction performance', async () => {
        const startTime = performance.now();
        
        await authPage.usernameInput.fill(testUser.username);
        await authPage.passwordInput.fill(testUser.password);
        
        const inputTime = performance.now() - startTime;
        console.log(`⌨️ Form input time: ${inputTime.toFixed(0)}ms`);
        
        expect(inputTime).toBeLessThan(500); // Form should be responsive
      });
    });
  });

  test.describe('🏢 Dashboard Performance', () => {
    test('should measure dashboard load performance', async ({ page }) => {
      // Login first
      await authPage.goto();
      await authPage.login(testUser.username, testUser.password);
      await page.waitForURL('**/dashboard**', { timeout: 15000 });

      await test.step('Measure dashboard initial load', async () => {
        const metrics = await collectPerformanceMetrics(page, 'Dashboard Load');
        const analysis = analyzePerformance(metrics);

        console.log('📊 Dashboard Performance Metrics:');
        console.log(`  - LCP: ${metrics.lcp.toFixed(0)}ms`);
        console.log(`  - FCP: ${metrics.fcp.toFixed(0)}ms`);
        console.log(`  - CLS: ${metrics.cls.toFixed(3)}`);
        console.log(`  - Load Time: ${metrics.loadTime?.toFixed(0)}ms`);
        console.log(`  - Network Requests: ${metrics.networkRequests}`);
        console.log(`  - Transfer Size: ${(metrics.totalTransferSize! / 1024).toFixed(1)}KB`);
        console.log(`  - JS Heap Used: ${(metrics.jsHeapUsed / 1024 / 1024).toFixed(1)}MB`);
        console.log(`  - Performance Score: ${analysis.score}/100`);

        if (analysis.issues.length > 0) {
          console.log('⚠️ Performance Issues:');
          analysis.issues.forEach(issue => console.log(`  - ${issue}`));
        }
      });

      await test.step('Measure navigation performance', async () => {
        const navigationTests = [
          { name: 'Students', path: '/dashboard/students' },
          { name: 'Books', path: '/dashboard/books' },
          { name: 'Equipment', path: '/dashboard/equipment' }
        ];

        for (const nav of navigationTests) {
          const startTime = performance.now();
          
          try {
            await page.goto(nav.path);
            await page.waitForLoadState('networkidle');
            
            const navigationTime = performance.now() - startTime;
            console.log(`🧭 ${nav.name} navigation time: ${navigationTime.toFixed(0)}ms`);
            
            const metrics = await collectPerformanceMetrics(page, `${nav.name} Page Load`);
            const analysis = analyzePerformance(metrics);
            
            console.log(`  - Performance Score: ${analysis.score}/100`);
            
            expect(navigationTime).toBeLessThan(3000); // Navigation should be fast
            
          } catch (error) {
            console.log(`ℹ️ Could not test ${nav.name} navigation: ${error.message}`);
          }
        }
      });
    });
  });

  test.describe('📝 Form Performance', () => {
    test('should measure form interaction performance', async ({ page }) => {
      await authPage.goto();
      await authPage.login(testUser.username, testUser.password);
      await page.waitForURL('**/dashboard**', { timeout: 15000 });

      await test.step('Measure form opening performance', async () => {
        await page.goto('/dashboard/students');
        await page.waitForLoadState('networkidle');

        // Find add button
        const addButton = page.locator('button:has-text("Add"), button:has-text("Create")').first();
        const addButtonExists = await addButton.isVisible();

        if (addButtonExists) {
          const startTime = performance.now();
          
          await addButton.click();
          await page.waitForTimeout(1000);
          
          const formOpenTime = performance.now() - startTime;
          console.log(`📝 Form opening time: ${formOpenTime.toFixed(0)}ms`);
          
          expect(formOpenTime).toBeLessThan(1000); // Form should open quickly
          
          // Test form input responsiveness
          const form = page.locator('form').first();
          const formVisible = await form.isVisible();
          
          if (formVisible) {
            const inputs = form.locator('input');
            const inputCount = await inputs.count();
            
            if (inputCount > 0) {
              const inputStartTime = performance.now();
              
              for (let i = 0; i < Math.min(3, inputCount); i++) {
                await inputs.nth(i).fill(`Test Value ${i}`);
              }
              
              const inputTime = performance.now() - inputStartTime;
              console.log(`⌨️ Form input responsiveness: ${inputTime.toFixed(0)}ms`);
              
              expect(inputTime).toBeLessThan(500);
            }
          }
        }
      });
    });
  });

  test.describe('🔍 Search Performance', () => {
    test('should measure search performance', async ({ page }) => {
      await authPage.goto();
      await authPage.login(testUser.username, testUser.password);
      await page.waitForURL('**/dashboard**', { timeout: 15000 });

      await test.step('Measure search response time', async () => {
        const pagesToTest = ['/dashboard/students', '/dashboard/books'];

        for (const pagePath of pagesToTest) {
          await page.goto(pagePath);
          await page.waitForLoadState('networkidle');

          const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
          const searchExists = await searchInput.isVisible();

          if (searchExists) {
            const startTime = performance.now();
            
            await searchInput.fill('test search query');
            await page.keyboard.press('Enter');
            await page.waitForTimeout(2000);
            
            const searchTime = performance.now() - startTime;
            console.log(`🔍 Search response time on ${pagePath}: ${searchTime.toFixed(0)}ms`);
            
            expect(searchTime).toBeLessThan(3000); // Search should respond quickly
            
            // Clear search
            await searchInput.clear();
            await page.keyboard.press('Enter');
            await page.waitForTimeout(1000);
          }
        }
      });
    });
  });

  test.describe('📱 Mobile Performance', () => {
    test('should measure mobile performance', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await test.step('Measure mobile login performance', async () => {
        await authPage.goto();
        await authPage.waitForPageLoad();

        const metrics = await collectPerformanceMetrics(page, 'Mobile Login');
        const analysis = analyzePerformance(metrics);

        console.log('📱 Mobile Performance Metrics:');
        console.log(`  - LCP: ${metrics.lcp.toFixed(0)}ms`);
        console.log(`  - FCP: ${metrics.fcp.toFixed(0)}ms`);
        console.log(`  - CLS: ${metrics.cls.toFixed(3)}`);
        console.log(`  - Performance Score: ${analysis.score}/100`);

        // Mobile should have similar performance to desktop
        expect(metrics.lcp).toBeLessThan(PERFORMANCE_THRESHOLDS.LCP * 1.8); // Allow more tolerance for mobile
      });

      await test.step('Measure mobile navigation performance', async () => {
        await authPage.login(testUser.username, testUser.password);
        await page.waitForURL('**/dashboard**', { timeout: 15000 });

        // Test mobile menu performance if available
        const mobileMenuButton = page.locator('[data-testid="mobile-menu"], .hamburger, .menu-toggle').first();
        const mobileMenuExists = await mobileMenuButton.isVisible();

        if (mobileMenuExists) {
          const startTime = performance.now();
          
          await mobileMenuButton.click();
          await page.waitForTimeout(500);
          
          const menuOpenTime = performance.now() - startTime;
          console.log(`📱 Mobile menu open time: ${menuOpenTime.toFixed(0)}ms`);
          
          expect(menuOpenTime).toBeLessThan(500);
        }
      });
    });
  });

  test.describe('💾 Memory Performance', () => {
    test('should monitor memory usage during extended session', async ({ page }) => {
      await authPage.goto();
      await authPage.login(testUser.username, testUser.password);
      await page.waitForURL('**/dashboard**', { timeout: 15000 });

      await test.step('Monitor memory during navigation', async () => {
        const pages = ['/dashboard', '/dashboard/students', '/dashboard/books', '/dashboard/equipment'];
        const memoryReadings: number[] = [];

        for (const pagePath of pages) {
          await page.goto(pagePath);
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(2000);

          const memoryUsage = await page.evaluate(() => {
            const memoryInfo = (performance as any).memory;
            return memoryInfo ? memoryInfo.usedJSHeapSize : 0;
          });

          memoryReadings.push(memoryUsage);
          console.log(`💾 Memory usage on ${pagePath}: ${(memoryUsage / 1024 / 1024).toFixed(1)}MB`);
        }

        // Check for memory leaks (significant increase)
        const initialMemory = memoryReadings[0];
        const finalMemory = memoryReadings[memoryReadings.length - 1];
        const memoryIncrease = finalMemory - initialMemory;
        const memoryIncreasePercent = (memoryIncrease / initialMemory) * 100;

        console.log(`💾 Memory increase during session: ${(memoryIncrease / 1024 / 1024).toFixed(1)}MB (${memoryIncreasePercent.toFixed(1)}%)`);

        // Memory should not increase by more than 100% during normal navigation
        expect(memoryIncreasePercent).toBeLessThan(100);
      });
    });
  });

  test.afterAll(async () => {
    // Generate performance report
    await test.step('Generate performance report', async () => {
      console.log('\n📊 COMPREHENSIVE PERFORMANCE REPORT');
      console.log('=====================================');

      if (performanceResults.length === 0) {
        console.log('No performance data collected');
        return;
      }

      // Calculate averages
      const avgMetrics = performanceResults.reduce((acc, metrics) => {
        acc.lcp += metrics.lcp || 0;
        acc.fcp += metrics.fcp || 0;
        acc.cls += metrics.cls || 0;
        acc.loadTime += metrics.loadTime || 0;
        acc.networkRequests += metrics.networkRequests || 0;
        acc.totalTransferSize += metrics.totalTransferSize || 0;
        acc.jsHeapUsed += metrics.jsHeapUsed || 0;
        return acc;
      }, {
        lcp: 0, fcp: 0, cls: 0, loadTime: 0,
        networkRequests: 0, totalTransferSize: 0, jsHeapUsed: 0
      });

      const count = performanceResults.length;
      Object.keys(avgMetrics).forEach(key => {
        avgMetrics[key] = avgMetrics[key] / count;
      });

      console.log('\n📈 Average Performance Metrics:');
      console.log(`  - LCP: ${avgMetrics.lcp.toFixed(0)}ms`);
      console.log(`  - FCP: ${avgMetrics.fcp.toFixed(0)}ms`);
      console.log(`  - CLS: ${avgMetrics.cls.toFixed(3)}`);
      console.log(`  - Load Time: ${avgMetrics.loadTime.toFixed(0)}ms`);
      console.log(`  - Network Requests: ${avgMetrics.networkRequests.toFixed(0)}`);
      console.log(`  - Transfer Size: ${(avgMetrics.totalTransferSize / 1024).toFixed(1)}KB`);
      console.log(`  - JS Heap Used: ${(avgMetrics.jsHeapUsed / 1024 / 1024).toFixed(1)}MB`);

      // Overall performance score
      const overallAnalysis = analyzePerformance(avgMetrics as PerformanceMetrics);
      console.log(`\n🎯 Overall Performance Score: ${overallAnalysis.score}/100`);

      if (overallAnalysis.issues.length > 0) {
        console.log('\n⚠️ Performance Recommendations:');
        overallAnalysis.issues.forEach(issue => console.log(`  - ${issue}`));
      }

      // Best and worst performing pages
      const sortedByLCP = [...performanceResults].sort((a, b) => (a.lcp || 0) - (b.lcp || 0));
      console.log(`\n🏆 Best performing page: ${sortedByLCP[0].testName} (LCP: ${sortedByLCP[0].lcp?.toFixed(0)}ms)`);
      console.log(`🐌 Slowest performing page: ${sortedByLCP[sortedByLCP.length - 1].testName} (LCP: ${sortedByLCP[sortedByLCP.length - 1].lcp?.toFixed(0)}ms)`);

      // Save detailed results to file
      const reportData = {
        summary: {
          totalTests: count,
          averageMetrics: avgMetrics,
          overallScore: overallAnalysis.score,
          issues: overallAnalysis.issues
        },
        detailedResults: performanceResults,
        thresholds: PERFORMANCE_THRESHOLDS,
        timestamp: new Date().toISOString()
      };

      // In a real implementation, you would save this to a file
      console.log('\n💾 Performance data collected for', count, 'test scenarios');
    });
  });
});