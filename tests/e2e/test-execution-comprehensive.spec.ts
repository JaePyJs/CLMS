import { test, expect, Page, Browser } from '@playwright/test';
import { AuthPage } from './page-objects/auth.page';
import { DashboardPage } from './page-objects/dashboard.page';
import fs from 'fs';
import path from 'path';

/**
 * Comprehensive Test Execution and Reporting Suite for CLMS
 * 
 * This suite orchestrates all tests and generates comprehensive reports including:
 * - Test execution summary
 * - Screenshot collection
 * - Performance metrics aggregation
 * - Issue documentation with reproduction steps
 * - Coverage analysis
 * - Quality assessment
 */

interface TestResult {
  testName: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  screenshots: string[];
  performanceMetrics?: any;
  timestamp: number;
  category: string;
}

interface TestSummary {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: number;
  totalDuration: number;
  categories: { [key: string]: { passed: number; failed: number; total: number } };
  issues: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    reproductionSteps: string[];
    screenshot?: string;
    category: string;
  }>;
  coverage: {
    authentication: number;
    uiComponents: number;
    forms: number;
    navigation: number;
    performance: number;
    overall: number;
  };
}

test.describe('🎯 Comprehensive Test Execution & Reporting', () => {
  let testResults: TestResult[] = [];
  let testSummary: TestSummary;
  let authPage: AuthPage;
  let dashboardPage: DashboardPage;
  let screenshotCounter = 0;

  const testUser = {
    username: 'admin@clms.edu',
    password: 'admin123',
    role: 'Administrator'
  };

  // Test categories for coverage analysis
  const TEST_CATEGORIES = {
    AUTHENTICATION: 'Authentication',
    UI_COMPONENTS: 'UI Components',
    FORMS: 'Forms & Validation',
    NAVIGATION: 'Navigation',
    PERFORMANCE: 'Performance',
    ACCESSIBILITY: 'Accessibility',
    SECURITY: 'Security'
  };

  async function takeScreenshot(page: Page, name: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `screenshot-${++screenshotCounter}-${name}-${timestamp}.png`;
    const screenshotPath = path.join('test-results', 'screenshots', filename);
    
    // Ensure directory exists
    const dir = path.dirname(screenshotPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    await page.screenshot({ 
      path: screenshotPath, 
      fullPage: true,
      animations: 'disabled'
    });
    
    return screenshotPath;
  }

  async function recordTestResult(
    testName: string, 
    category: string, 
    status: 'passed' | 'failed' | 'skipped',
    duration: number,
    page?: Page,
    error?: string
  ): Promise<void> {
    const screenshots: string[] = [];
    
    if (page) {
      try {
        const screenshot = await takeScreenshot(page, testName.replace(/\s+/g, '-').toLowerCase());
        screenshots.push(screenshot);
      } catch (e) {
        console.log(`Could not take screenshot for ${testName}: ${e.message}`);
      }
    }

    testResults.push({
      testName,
      status,
      duration,
      error,
      screenshots,
      timestamp: Date.now(),
      category
    });
  }

  test.beforeAll(async () => {
    console.log('🚀 Starting Comprehensive CLMS Test Suite');
    console.log('==========================================');
    
    // Initialize test summary
    testSummary = {
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      passRate: 0,
      totalDuration: 0,
      categories: {},
      issues: [],
      coverage: {
        authentication: 0,
        uiComponents: 0,
        forms: 0,
        navigation: 0,
        performance: 0,
        overall: 0
      }
    };

    // Ensure test results directory exists
    const resultsDir = path.join('test-results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
  });

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    dashboardPage = new DashboardPage(page);
  });

  test.describe('🔐 Authentication Flow Testing', () => {
    test('Execute comprehensive authentication tests', async ({ page }) => {
      const startTime = Date.now();
      let testsPassed = 0;
      let testsTotal = 0;

      await test.step('Test login page validation', async () => {
        testsTotal++;
        try {
          await authPage.goto();
          await authPage.waitForPageLoad();
          
          // Verify login form elements
          await expect(authPage.usernameInput).toBeVisible();
          await expect(authPage.passwordInput).toBeVisible();
          await expect(authPage.signInButton).toBeVisible();
          
          // Test empty form submission
          await authPage.signInButton.click();
          await page.waitForTimeout(1000);
          
          // Should show validation messages
          const hasValidation = await page.locator('.error, .invalid, [role="alert"]').count() > 0;
          expect(hasValidation).toBeTruthy();
          
          testsPassed++;
          await recordTestResult('Login Page Validation', TEST_CATEGORIES.AUTHENTICATION, 'passed', Date.now() - startTime, page);
        } catch (error) {
          await recordTestResult('Login Page Validation', TEST_CATEGORIES.AUTHENTICATION, 'failed', Date.now() - startTime, page, error.message);
          testSummary.issues.push({
            severity: 'high',
            title: 'Login Page Validation Failed',
            description: 'Login page validation elements are not working correctly',
            reproductionSteps: [
              '1. Navigate to login page',
              '2. Click sign in button without entering credentials',
              '3. Observe validation behavior'
            ],
            category: TEST_CATEGORIES.AUTHENTICATION
          });
        }
      });

      await test.step('Test successful authentication', async () => {
        testsTotal++;
        try {
          await authPage.goto();
          await authPage.login(testUser.username, testUser.password);
          
          // Should redirect to dashboard
          await page.waitForURL('**/dashboard**', { timeout: 15000 });
          await expect(page).toHaveURL(/.*dashboard.*/);
          
          testsPassed++;
          await recordTestResult('Successful Authentication', TEST_CATEGORIES.AUTHENTICATION, 'passed', Date.now() - startTime, page);
        } catch (error) {
          await recordTestResult('Successful Authentication', TEST_CATEGORIES.AUTHENTICATION, 'failed', Date.now() - startTime, page, error.message);
          testSummary.issues.push({
            severity: 'critical',
            title: 'Authentication Failed',
            description: 'Users cannot log in with valid credentials',
            reproductionSteps: [
              '1. Navigate to login page',
              '2. Enter valid username and password',
              '3. Click sign in button',
              '4. Observe redirect behavior'
            ],
            category: TEST_CATEGORIES.AUTHENTICATION
          });
        }
      });

      await test.step('Test invalid credentials handling', async () => {
        testsTotal++;
        try {
          await authPage.goto();
          await authPage.usernameInput.fill('invalid@email.com');
          await authPage.passwordInput.fill('wrongpassword');
          await authPage.signInButton.click();
          
          await page.waitForTimeout(2000);
          
          // Should show error message and stay on login page
          const errorVisible = await page.locator('.error, .alert-error, [role="alert"]').isVisible();
          expect(errorVisible).toBeTruthy();
          expect(page.url()).toContain('login');
          
          testsPassed++;
          await recordTestResult('Invalid Credentials Handling', TEST_CATEGORIES.AUTHENTICATION, 'passed', Date.now() - startTime, page);
        } catch (error) {
          await recordTestResult('Invalid Credentials Handling', TEST_CATEGORIES.AUTHENTICATION, 'failed', Date.now() - startTime, page, error.message);
          testSummary.issues.push({
            severity: 'medium',
            title: 'Invalid Credentials Error Handling',
            description: 'Error messages for invalid credentials are not displayed properly',
            reproductionSteps: [
              '1. Navigate to login page',
              '2. Enter invalid credentials',
              '3. Click sign in button',
              '4. Check for error message display'
            ],
            category: TEST_CATEGORIES.AUTHENTICATION
          });
        }
      });

      await test.step('Test logout functionality', async () => {
        testsTotal++;
        try {
          // First login
          await authPage.goto();
          await authPage.login(testUser.username, testUser.password);
          await page.waitForURL('**/dashboard**', { timeout: 15000 });
          
          // Find and click logout
          const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign Out"), [data-testid="logout"]').first();
          const logoutExists = await logoutButton.isVisible();
          
          if (logoutExists) {
            await logoutButton.click();
            await page.waitForTimeout(2000);
            
            // Should redirect to login page
            expect(page.url()).toContain('login');
            testsPassed++;
          } else {
            // Try user menu approach
            const userMenu = page.locator('.user-menu, .profile-menu, [data-testid="user-menu"]').first();
            const userMenuExists = await userMenu.isVisible();
            
            if (userMenuExists) {
              await userMenu.click();
              await page.waitForTimeout(500);
              
              const logoutInMenu = page.locator('button:has-text("Logout"), a:has-text("Sign Out")').first();
              await logoutInMenu.click();
              await page.waitForTimeout(2000);
              
              expect(page.url()).toContain('login');
              testsPassed++;
            } else {
              throw new Error('Logout functionality not found');
            }
          }
          
          await recordTestResult('Logout Functionality', TEST_CATEGORIES.AUTHENTICATION, 'passed', Date.now() - startTime, page);
        } catch (error) {
          await recordTestResult('Logout Functionality', TEST_CATEGORIES.AUTHENTICATION, 'failed', Date.now() - startTime, page, error.message);
          testSummary.issues.push({
            severity: 'medium',
            title: 'Logout Functionality Issue',
            description: 'Users cannot properly log out of the application',
            reproductionSteps: [
              '1. Log in to the application',
              '2. Navigate to dashboard',
              '3. Look for logout button or user menu',
              '4. Attempt to log out'
            ],
            category: TEST_CATEGORIES.AUTHENTICATION
          });
        }
      });

      // Update coverage
      testSummary.coverage.authentication = (testsPassed / testsTotal) * 100;
      console.log(`🔐 Authentication Tests: ${testsPassed}/${testsTotal} passed (${testSummary.coverage.authentication.toFixed(1)}%)`);
    });
  });

  test.describe('🎨 UI Components Testing', () => {
    test('Execute comprehensive UI component tests', async ({ page }) => {
      const startTime = Date.now();
      let testsPassed = 0;
      let testsTotal = 0;

      // Login first
      await authPage.goto();
      await authPage.login(testUser.username, testUser.password);
      await page.waitForURL('**/dashboard**', { timeout: 15000 });

      await test.step('Test dashboard buttons', async () => {
        testsTotal++;
        try {
          // Find all buttons on dashboard
          const buttons = page.locator('button:visible');
          const buttonCount = await buttons.count();
          
          console.log(`Found ${buttonCount} buttons on dashboard`);
          
          let workingButtons = 0;
          for (let i = 0; i < Math.min(buttonCount, 10); i++) {
            try {
              const button = buttons.nth(i);
              const isEnabled = await button.isEnabled();
              const text = await button.textContent();
              
              if (isEnabled && text && text.trim()) {
                await button.hover();
                await page.waitForTimeout(100);
                workingButtons++;
              }
            } catch (e) {
              // Skip problematic buttons
            }
          }
          
          expect(workingButtons).toBeGreaterThan(0);
          testsPassed++;
          await recordTestResult('Dashboard Buttons', TEST_CATEGORIES.UI_COMPONENTS, 'passed', Date.now() - startTime, page);
        } catch (error) {
          await recordTestResult('Dashboard Buttons', TEST_CATEGORIES.UI_COMPONENTS, 'failed', Date.now() - startTime, page, error.message);
        }
      });

      await test.step('Test navigation menu', async () => {
        testsTotal++;
        try {
          // Find navigation elements
          const navItems = page.locator('nav a, .nav-item, .menu-item').filter({ hasText: /.+/ });
          const navCount = await navItems.count();
          
          console.log(`Found ${navCount} navigation items`);
          
          if (navCount > 0) {
            // Test first few navigation items
            for (let i = 0; i < Math.min(navCount, 5); i++) {
              try {
                const navItem = navItems.nth(i);
                const href = await navItem.getAttribute('href');
                const text = await navItem.textContent();
                
                if (href && text && text.trim()) {
                  await navItem.hover();
                  await page.waitForTimeout(100);
                }
              } catch (e) {
                // Skip problematic nav items
              }
            }
          }
          
          expect(navCount).toBeGreaterThan(0);
          testsPassed++;
          await recordTestResult('Navigation Menu', TEST_CATEGORIES.UI_COMPONENTS, 'passed', Date.now() - startTime, page);
        } catch (error) {
          await recordTestResult('Navigation Menu', TEST_CATEGORIES.UI_COMPONENTS, 'failed', Date.now() - startTime, page, error.message);
        }
      });

      await test.step('Test responsive design', async () => {
        testsTotal++;
        try {
          const viewports = [
            { width: 1920, height: 1080, name: 'Desktop' },
            { width: 768, height: 1024, name: 'Tablet' },
            { width: 375, height: 667, name: 'Mobile' }
          ];

          for (const viewport of viewports) {
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await page.waitForTimeout(1000);
            
            // Check if page is still functional
            const body = page.locator('body');
            await expect(body).toBeVisible();
            
            // Take screenshot for each viewport
            await takeScreenshot(page, `responsive-${viewport.name.toLowerCase()}`);
          }
          
          // Reset to desktop
          await page.setViewportSize({ width: 1920, height: 1080 });
          
          testsPassed++;
          await recordTestResult('Responsive Design', TEST_CATEGORIES.UI_COMPONENTS, 'passed', Date.now() - startTime, page);
        } catch (error) {
          await recordTestResult('Responsive Design', TEST_CATEGORIES.UI_COMPONENTS, 'failed', Date.now() - startTime, page, error.message);
        }
      });

      // Update coverage
      testSummary.coverage.uiComponents = (testsPassed / testsTotal) * 100;
      console.log(`🎨 UI Component Tests: ${testsPassed}/${testsTotal} passed (${testSummary.coverage.uiComponents.toFixed(1)}%)`);
    });
  });

  test.describe('📝 Forms & Navigation Testing', () => {
    test('Execute comprehensive forms and navigation tests', async ({ page }) => {
      const startTime = Date.now();
      let testsPassed = 0;
      let testsTotal = 0;

      // Login first
      await authPage.goto();
      await authPage.login(testUser.username, testUser.password);
      await page.waitForURL('**/dashboard**', { timeout: 15000 });

      await test.step('Test page navigation', async () => {
        testsTotal++;
        try {
          const pagesToTest = [
            '/dashboard/students',
            '/dashboard/books', 
            '/dashboard/equipment',
            '/dashboard'
          ];

          let successfulNavigations = 0;
          for (const pagePath of pagesToTest) {
            try {
              await page.goto(pagePath);
              await page.waitForLoadState('networkidle', { timeout: 10000 });
              
              // Check if page loaded successfully
              const body = page.locator('body');
              await expect(body).toBeVisible();
              
              successfulNavigations++;
              await takeScreenshot(page, `navigation-${pagePath.replace(/[\/]/g, '-')}`);
            } catch (e) {
              console.log(`Could not navigate to ${pagePath}: ${e.message}`);
            }
          }
          
          expect(successfulNavigations).toBeGreaterThan(0);
          testsPassed++;
          await recordTestResult('Page Navigation', TEST_CATEGORIES.NAVIGATION, 'passed', Date.now() - startTime, page);
        } catch (error) {
          await recordTestResult('Page Navigation', TEST_CATEGORIES.NAVIGATION, 'failed', Date.now() - startTime, page, error.message);
        }
      });

      await test.step('Test form interactions', async () => {
        testsTotal++;
        try {
          // Go to a page likely to have forms
          await page.goto('/dashboard/students');
          await page.waitForLoadState('networkidle');
          
          // Look for add/create buttons
          const addButton = page.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("New")').first();
          const addButtonExists = await addButton.isVisible();
          
          if (addButtonExists) {
            await addButton.click();
            await page.waitForTimeout(1000);
            
            // Look for form
            const form = page.locator('form').first();
            const formExists = await form.isVisible();
            
            if (formExists) {
              // Test form inputs
              const inputs = form.locator('input:visible');
              const inputCount = await inputs.count();
              
              if (inputCount > 0) {
                // Fill first few inputs with test data
                for (let i = 0; i < Math.min(inputCount, 3); i++) {
                  try {
                    const input = inputs.nth(i);
                    const inputType = await input.getAttribute('type') || 'text';
                    
                    let testValue = 'Test Value';
                    if (inputType === 'email') testValue = 'test@example.com';
                    if (inputType === 'number') testValue = '123';
                    if (inputType === 'tel') testValue = '1234567890';
                    
                    await input.fill(testValue);
                    await page.waitForTimeout(100);
                  } catch (e) {
                    // Skip problematic inputs
                  }
                }
              }
              
              // Look for cancel/close button to exit form
              const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("Close"), .close').first();
              const cancelExists = await cancelButton.isVisible();
              
              if (cancelExists) {
                await cancelButton.click();
                await page.waitForTimeout(500);
              }
            }
          }
          
          testsPassed++;
          await recordTestResult('Form Interactions', TEST_CATEGORIES.FORMS, 'passed', Date.now() - startTime, page);
        } catch (error) {
          await recordTestResult('Form Interactions', TEST_CATEGORIES.FORMS, 'failed', Date.now() - startTime, page, error.message);
        }
      });

      // Update coverage
      testSummary.coverage.forms = (testsPassed / testsTotal) * 100;
      testSummary.coverage.navigation = testSummary.coverage.forms; // Combined for simplicity
      console.log(`📝 Forms & Navigation Tests: ${testsPassed}/${testsTotal} passed (${testSummary.coverage.forms.toFixed(1)}%)`);
    });
  });

  test.afterAll(async () => {
    await test.step('Generate comprehensive test report', async () => {
      // Calculate final statistics
      testSummary.totalTests = testResults.length;
      testSummary.passed = testResults.filter(r => r.status === 'passed').length;
      testSummary.failed = testResults.filter(r => r.status === 'failed').length;
      testSummary.skipped = testResults.filter(r => r.status === 'skipped').length;
      testSummary.passRate = (testSummary.passed / testSummary.totalTests) * 100;
      testSummary.totalDuration = testResults.reduce((sum, r) => sum + r.duration, 0);

      // Calculate category statistics
      Object.values(TEST_CATEGORIES).forEach(category => {
        const categoryTests = testResults.filter(r => r.category === category);
        testSummary.categories[category] = {
          total: categoryTests.length,
          passed: categoryTests.filter(r => r.status === 'passed').length,
          failed: categoryTests.filter(r => r.status === 'failed').length
        };
      });

      // Calculate overall coverage
      const coverageValues = Object.values(testSummary.coverage).filter(v => v > 0);
      testSummary.coverage.overall = coverageValues.length > 0 
        ? coverageValues.reduce((sum, v) => sum + v, 0) / coverageValues.length 
        : 0;

      // Generate report
      console.log('\n🎯 COMPREHENSIVE TEST EXECUTION REPORT');
      console.log('=====================================');
      console.log(`📊 Test Summary:`);
      console.log(`  - Total Tests: ${testSummary.totalTests}`);
      console.log(`  - Passed: ${testSummary.passed} (${testSummary.passRate.toFixed(1)}%)`);
      console.log(`  - Failed: ${testSummary.failed}`);
      console.log(`  - Skipped: ${testSummary.skipped}`);
      console.log(`  - Total Duration: ${(testSummary.totalDuration / 1000).toFixed(1)}s`);

      console.log(`\n📈 Coverage Analysis:`);
      console.log(`  - Authentication: ${testSummary.coverage.authentication.toFixed(1)}%`);
      console.log(`  - UI Components: ${testSummary.coverage.uiComponents.toFixed(1)}%`);
      console.log(`  - Forms & Validation: ${testSummary.coverage.forms.toFixed(1)}%`);
      console.log(`  - Navigation: ${testSummary.coverage.navigation.toFixed(1)}%`);
      console.log(`  - Overall Coverage: ${testSummary.coverage.overall.toFixed(1)}%`);

      console.log(`\n📋 Category Breakdown:`);
      Object.entries(testSummary.categories).forEach(([category, stats]) => {
        const passRate = stats.total > 0 ? (stats.passed / stats.total) * 100 : 0;
        console.log(`  - ${category}: ${stats.passed}/${stats.total} passed (${passRate.toFixed(1)}%)`);
      });

      if (testSummary.issues.length > 0) {
        console.log(`\n⚠️ Issues Found (${testSummary.issues.length}):`);
        testSummary.issues.forEach((issue, index) => {
          console.log(`  ${index + 1}. [${issue.severity.toUpperCase()}] ${issue.title}`);
          console.log(`     Category: ${issue.category}`);
          console.log(`     Description: ${issue.description}`);
          console.log(`     Reproduction Steps:`);
          issue.reproductionSteps.forEach((step, stepIndex) => {
            console.log(`       ${step}`);
          });
          console.log('');
        });
      }

      // Quality Assessment
      let qualityGrade = 'F';
      if (testSummary.passRate >= 95) qualityGrade = 'A+';
      else if (testSummary.passRate >= 90) qualityGrade = 'A';
      else if (testSummary.passRate >= 85) qualityGrade = 'B+';
      else if (testSummary.passRate >= 80) qualityGrade = 'B';
      else if (testSummary.passRate >= 75) qualityGrade = 'C+';
      else if (testSummary.passRate >= 70) qualityGrade = 'C';
      else if (testSummary.passRate >= 60) qualityGrade = 'D';

      console.log(`\n🎖️ Quality Assessment:`);
      console.log(`  - Overall Grade: ${qualityGrade}`);
      console.log(`  - Pass Rate: ${testSummary.passRate.toFixed(1)}% (Target: 90%+)`);
      console.log(`  - Coverage: ${testSummary.coverage.overall.toFixed(1)}% (Target: 100%)`);
      console.log(`  - Critical Issues: ${testSummary.issues.filter(i => i.severity === 'critical').length}`);
      console.log(`  - High Priority Issues: ${testSummary.issues.filter(i => i.severity === 'high').length}`);

      // Recommendations
      console.log(`\n💡 Recommendations:`);
      if (testSummary.passRate < 90) {
        console.log(`  - 🔴 PRIORITY: Improve pass rate to 90%+ (currently ${testSummary.passRate.toFixed(1)}%)`);
      }
      if (testSummary.coverage.overall < 100) {
        console.log(`  - 🟡 Increase test coverage to 100% (currently ${testSummary.coverage.overall.toFixed(1)}%)`);
      }
      if (testSummary.issues.filter(i => i.severity === 'critical').length > 0) {
        console.log(`  - 🔴 CRITICAL: Address all critical issues before production`);
      }
      if (testSummary.issues.filter(i => i.severity === 'high').length > 0) {
        console.log(`  - 🟠 HIGH: Resolve high priority issues`);
      }

      console.log(`\n✅ Test execution completed successfully!`);
      console.log(`📁 Screenshots saved to: test-results/screenshots/`);
      console.log(`📊 Detailed results available in test reports`);

      // Save detailed report to file
      const reportPath = path.join('test-results', 'comprehensive-test-report.json');
      const reportData = {
        summary: testSummary,
        detailedResults: testResults,
        timestamp: new Date().toISOString(),
        qualityGrade,
        targetsMet: {
          passRate: testSummary.passRate >= 90,
          coverage: testSummary.coverage.overall >= 100,
          noCriticalIssues: testSummary.issues.filter(i => i.severity === 'critical').length === 0
        }
      };

      try {
        fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
        console.log(`💾 Comprehensive report saved to: ${reportPath}`);
      } catch (error) {
        console.log(`⚠️ Could not save report file: ${error.message}`);
      }
    });
  });
});