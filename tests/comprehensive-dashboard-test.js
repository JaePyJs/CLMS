#!/usr/bin/env node
/**
 * Comprehensive Dashboard Functionality Test
 * Tests all features, screens, and workflows
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function runComprehensiveTests() {
  console.log('🚀 Starting Comprehensive CLMS Dashboard Test...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  // Test results tracker
  const testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    tests: []
  };

  // Helper function to log test results
  function logTest(testName, passed, details = '') {
    testResults.total++;
    if (passed) {
      testResults.passed++;
      console.log(`✅ PASS: ${testName}`);
    } else {
      testResults.failed++;
      console.log(`❌ FAIL: ${testName}`);
      if (details) console.log(`   Details: ${details}`);
    }
    testResults.tests.push({ name: testName, passed, details });
  }

  // Take screenshot helper
  async function takeScreenshot(name) {
    const screenshotPath = `./tests/screenshots/${name}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    return screenshotPath;
  }

  try {
    console.log('📍 Step 1: Login to Application\n');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Take screenshot before login
    await takeScreenshot('01-before-login');

    // Login
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(10000);
    await takeScreenshot('01-after-login');

    // Verify dashboard is loaded
    const dashboardVisible = await page.$('.dashboard, [data-testid="dashboard"], .sidebar, nav');
    const bodyText = await page.textContent('body');
    const currentUrl = page.url();

    console.log('Current URL:', currentUrl);
    console.log('Dashboard elements found:', dashboardVisible !== null);
    console.log('Page contains "dashboard":', bodyText.toLowerCase().includes('dashboard'));

    logTest('Login and Dashboard Load', dashboardVisible !== null);

    if (!dashboardVisible) {
      console.log('Page content preview:', bodyText.substring(0, 500));
      // Don't throw, continue with tests
    }

    console.log('\n📍 Step 2: Test Dashboard Navigation\n');

    // Test navigation menu items
    const navItems = [
      { selector: 'nav a[href="/dashboard"], nav a:has-text("Dashboard")', name: 'Dashboard' },
      { selector: 'nav a[href="/students"], nav a:has-text("Students")', name: 'Students' },
      { selector: 'nav a[href="/books"], nav a:has-text("Books")', name: 'Books' },
      { selector: 'nav a[href="/equipment"], nav a:has-text("Equipment")', name: 'Equipment' },
      { selector: 'nav a[href="/scan"], nav a:has-text("Scan")', name: 'Scan Workspace' },
      { selector: 'nav a[href="/reports"], nav a:has-text("Reports")', name: 'Reports' },
      { selector: 'nav a[href="/settings"], nav a:has-text("Settings")', name: 'Settings' }
    ];

    for (const item of navItems) {
      const navElement = await page.$(item.selector);
      logTest(`Navigation: ${item.name} exists`, navElement !== null);
    }

    console.log('\n📍 Step 3: Test Student Management\n');

    // Navigate to Students
    const studentsLink = await page.$('nav a:has-text("Students")');
    if (studentsLink) {
      await studentsLink.click();
      await page.waitForTimeout(3000);
      await takeScreenshot('02-students-page');

      // Check if students page loaded
      const studentsPageTitle = await page.$('h1, h2, [data-testid="page-title"]');
      const studentsPageLoaded = studentsPageTitle !== null;
      logTest('Students Page Navigation', studentsPageLoaded);

      // Test Add Student button
      const addStudentBtn = await page.$('button:has-text("Add"), button:has-text("New"), [data-testid="add-student"]');
      logTest('Add Student Button Present', addStudentBtn !== null);

      // Test Student List/Table
      const studentTable = await page.$('table, .student-list, [data-testid="student-list"]');
      logTest('Student List/Table Present', studentTable !== null);

      // Test Search functionality
      const searchInput = await page.$('input[type="search"], input[placeholder*="search" i], [data-testid="search"]');
      logTest('Student Search Input Present', searchInput !== null);

      // Test Import Students button
      const importBtn = await page.$('button:has-text("Import")');
      logTest('Import Students Button Present', importBtn !== null);
    }

    console.log('\n📍 Step 4: Test Book Management\n');

    // Navigate to Books
    const booksLink = await page.$('nav a:has-text("Books")');
    if (booksLink) {
      await booksLink.click();
      await page.waitForTimeout(3000);
      await takeScreenshot('03-books-page');

      const booksPageTitle = await page.$('h1, h2, [data-testid="page-title"]');
      logTest('Books Page Navigation', booksPageTitle !== null);

      // Test Add Book button
      const addBookBtn = await page.$('button:has-text("Add"), button:has-text("New"), [data-testid="add-book"]');
      logTest('Add Book Button Present', addBookBtn !== null);

      // Test Book List
      const bookList = await page.$('table, .book-list, [data-testid="book-list"]');
      logTest('Book List Present', bookList !== null);

      // Test Book Search
      const bookSearch = await page.$('input[type="search"], input[placeholder*="search" i]');
      logTest('Book Search Input Present', bookSearch !== null);
    }

    console.log('\n📍 Step 5: Test Equipment Management\n');

    // Navigate to Equipment
    const equipmentLink = await page.$('nav a:has-text("Equipment")');
    if (equipmentLink) {
      await equipmentLink.click();
      await page.waitForTimeout(3000);
      await takeScreenshot('04-equipment-page');

      const equipmentPageTitle = await page.$('h1, h2, [data-testid="page-title"]');
      logTest('Equipment Page Navigation', equipmentPageTitle !== null);

      // Test Add Equipment button
      const addEquipmentBtn = await page.$('button:has-text("Add"), button:has-text("New")');
      logTest('Add Equipment Button Present', addEquipmentBtn !== null);

      // Test Equipment List
      const equipmentList = await page.$('table, .equipment-list');
      logTest('Equipment List Present', equipmentList !== null);
    }

    console.log('\n📍 Step 6: Test Scan Workspace\n');

    // Navigate to Scan Workspace
    const scanLink = await page.$('nav a:has-text("Scan")');
    if (scanLink) {
      await scanLink.click();
      await page.waitForTimeout(3000);
      await takeScreenshot('05-scan-workspace');

      const scanPageTitle = await page.$('h1, h2, [data-testid="page-title"]');
      logTest('Scan Workspace Navigation', scanPageTitle !== null);

      // Test Barcode input
      const barcodeInput = await page.$('input[type="text"], input[placeholder*="barcode" i], input[placeholder*="scan" i]');
      logTest('Barcode Input Present', barcodeInput !== null);

      // Test Scan buttons
      const scanButtons = await page.$$('button');
      logTest('Scan Buttons Present', scanButtons.length > 0);
    }

    console.log('\n📍 Step 7: Test Reports Page\n');

    // Navigate to Reports
    const reportsLink = await page.$('nav a:has-text("Reports")');
    if (reportsLink) {
      await reportsLink.click();
      await page.waitForTimeout(3000);
      await takeScreenshot('06-reports-page');

      const reportsPageTitle = await page.$('h1, h2, [data-testid="page-title"]');
      logTest('Reports Page Navigation', reportsPageTitle !== null);

      // Test Report filters/options
      const reportFilters = await page.$('select, .filter, .date-picker');
      logTest('Report Filters Present', reportFilters !== null);

      // Test Generate Report button
      const generateBtn = await page.$('button:has-text("Generate"), button:has-text("Export")');
      logTest('Generate Report Button Present', generateBtn !== null);
    }

    console.log('\n📍 Step 8: Test Settings Page\n');

    // Navigate to Settings
    const settingsLink = await page.$('nav a:has-text("Settings")');
    if (settingsLink) {
      await settingsLink.click();
      await page.waitForTimeout(3000);
      await takeScreenshot('07-settings-page');

      const settingsPageTitle = await page.$('h1, h2, [data-testid="page-title"]');
      logTest('Settings Page Navigation', settingsPageTitle !== null);

      // Test Settings tabs/sections
      const settingsTabs = await page.$$('nav[role="tablist"] a, .settings-section');
      logTest('Settings Tabs/Sections Present', settingsTabs.length > 0);
    }

    console.log('\n📍 Step 9: Test User Profile/Menu\n');

    // Test user profile menu
    const userMenu = await page.$('button:has-text("Admin"), .user-menu, [data-testid="user-menu"]');
    logTest('User Menu Present', userMenu !== null);

    if (userMenu) {
      await userMenu.click();
      await page.waitForTimeout(1000);
      await takeScreenshot('08-user-menu');

      // Test logout option
      const logoutBtn = await page.$('a:has-text("Logout"), button:has-text("Logout")');
      logTest('Logout Option Present', logoutBtn !== null);
    }

    console.log('\n📍 Step 10: Test Notification Center\n');

    // Test notification bell
    const notificationBell = await page.$('button:has-text("🔔"), [data-testid="notification-center"]');
    logTest('Notification Bell Present', notificationBell !== null);

    if (notificationBell) {
      await notificationBell.click();
      await page.waitForTimeout(1000);
      await takeScreenshot('09-notification-center');
    }

    console.log('\n📍 Step 11: Test Password Visibility Toggle\n');

    // Navigate back to login to test password toggle
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(2000);

    // Check if redirected to dashboard (already logged in)
    const isOnDashboard = await page.$('nav, .dashboard');
    if (isOnDashboard) {
      console.log('Already logged in, skipping password toggle test');
    } else {
      // Test password visibility toggle
      const passwordInput = await page.$('input[type="password"]');
      if (passwordInput) {
        logTest('Password Input Present on Login', true);

        const eyeButton = await page.$('button:has-text("👁"), button[aria-label*="password" i]');
        logTest('Password Visibility Toggle Present', eyeButton !== null);

        if (eyeButton) {
          await eyeButton.click();
          await page.waitForTimeout(500);

          const passwordType = await passwordInput.getAttribute('type');
          logTest('Password Toggle Works', passwordType === 'text');
        }
      }
    }

    console.log('\n📍 Step 12: Test QR Code Manager\n');

    // Navigate to utilities/qr-codes
    await page.goto('http://localhost:3000/utilities/qr-codes');
    await page.waitForTimeout(3000);
    await takeScreenshot('10-qr-code-manager');

    const qrPageTitle = await page.$('h1, h2');
    logTest('QR Code Manager Page', qrPageTitle !== null);

    const generateQRBtn = await page.$('button:has-text("Generate")');
    logTest('Generate QR Codes Button Present', generateQRBtn !== null);

    console.log('\n📍 Step 13: Test Barcode Manager\n');

    // Navigate to utilities/barcodes
    await page.goto('http://localhost:3000/utilities/barcodes');
    await page.waitForTimeout(3000);
    await takeScreenshot('11-barcode-manager');

    const barcodePageTitle = await page.$('h1, h2');
    logTest('Barcode Manager Page', barcodePageTitle !== null);

    const generateBarcodeBtn = await page.$('button:has-text("Generate")');
    logTest('Generate Barcodes Button Present', generateBarcodeBtn !== null);

    // Final screenshot
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForTimeout(2000);
    await takeScreenshot('12-final-dashboard');

    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${testResults.total}`);
    console.log(`Passed: ${testResults.passed} ✅`);
    console.log(`Failed: ${testResults.failed} ❌`);
    console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
    console.log('='.repeat(60));

    // Save test results to file
    const resultsPath = './tests/comprehensive-test-results.json';
    fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));
    console.log(`\n📄 Test results saved to: ${resultsPath}`);

    if (testResults.failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      testResults.tests.filter(t => !t.passed).forEach(test => {
        console.log(`  - ${test.name}: ${test.details}`);
      });
    }

  } catch (error) {
    console.log('\n❌ CRITICAL ERROR during test execution:');
    console.log(error);

    await page.screenshot({ path: './tests/screenshots/error-state.png', fullPage: true });
  } finally {
    await context.close();
    await browser.close();
  }
}

// Create directories
const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Run the comprehensive test
runComprehensiveTests().catch(console.error);
