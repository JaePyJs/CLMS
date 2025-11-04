#!/usr/bin/env node
/**
 * Real-time debugging script to test CLMS and identify the "Objects are not valid as a React child" error
 * Uses Playwright to control the browser with DevTools-like capabilities
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function debugApplication() {
  console.log('🚀 Starting CLMS Real-time Debug...\n');

  // Launch browser with DevTools capabilities
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--start-maximized',
      '--auto-open-devtools-for-tabs',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordHar: { path: './tests/har/debug-session.har' }
  });

  const page = await context.newPage();

  // Collect console messages and errors
  const consoleMessages = [];
  const errors = [];
  const networkRequests = [];

  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    consoleMessages.push({ type, text, location: msg.location() });

    if (type === 'error') {
      errors.push({ text, location: msg.location() });
      console.log(`❌ [Console Error] ${text}`);
    } else if (type === 'warning') {
      console.log(`⚠️  [Console Warning] ${text}`);
    }
  });

  // Track network requests
  page.on('request', request => {
    networkRequests.push({
      url: request.url(),
      method: request.method(),
      status: 'PENDING'
    });
  });

  page.on('response', response => {
    const request = networkRequests.find(r => r.url === response.url());
    if (request) {
      request.status = response.status();
      request.headers = response.headers();
    }

    if (response.status() >= 400) {
      console.log(`❌ [Network Error] ${response.status()} - ${response.url()}`);
    }
  });

  // Track page errors
  page.on('pageerror', error => {
    errors.push({ text: error.message, stack: error.stack });
    console.log(`❌ [Page Error] ${error.message}`);
  });

  try {
    console.log('📍 Step 1: Navigate to application...');
    await page.goto('http://localhost:3000', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for React to render
    await page.waitForTimeout(2000);

    console.log('\n📸 Taking screenshot of initial state...');
    await page.screenshot({ path: './tests/screenshots/01-initial-load.png' });

    // Check if login form is visible
    const loginForm = await page.$('form[data-testid="login-form"]');
    console.log(`Login form visible: ${loginForm ? 'Yes' : 'No'}`);

    if (!loginForm) {
      // Take a screenshot to see what's actually rendered
      const bodyText = await page.textContent('body');
      console.log('\n🔍 Current page content (first 500 chars):');
      console.log(bodyText.substring(0, 500) + '...\n');
    }

    console.log('\n📍 Step 2: Fill in login credentials...');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');

    console.log('\n📸 Taking screenshot of filled form...');
    await page.screenshot({ path: './tests/screenshots/02-filled-form.png' });

    // Test password visibility toggle
    const toggleButton = await page.$('button[aria-label="Toggle password visibility"], button:has-text("👁"), button:has-text("Show")');
    if (toggleButton) {
      console.log('\n👁 Testing password visibility toggle...');
      await toggleButton.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: './tests/screenshots/03-password-visible.png' });
    }

    console.log('\n📍 Step 3: Submit login form...');
    await page.click('button[type="submit"], button:has-text("Sign In")');

    console.log('\n⏳ Waiting for dashboard to load...');
    await page.waitForTimeout(8000);

    // Take screenshot after login
    console.log('\n📸 Taking screenshot after login...');
    await page.screenshot({ path: './tests/screenshots/04-after-login.png', fullPage: true });

    // Check for error boundary or error messages
    const errorElements = await page.$$('.error-boundary, [data-testid="error-boundary"], .error-message, .alert-error');
    if (errorElements.length > 0) {
      console.log(`\n❌ Found ${errorElements.length} error element(s) on page`);
      for (const elem of errorElements) {
        const text = await elem.textContent();
        console.log(`   Error text: ${text?.substring(0, 200)}...\n`);
      }
    }

    // Check if dashboard is visible
    const dashboardVisible = await page.$('.dashboard, [data-testid="dashboard"], .sidebar, nav');
    console.log(`\nDashboard visible: ${dashboardVisible ? 'Yes' : 'No'}`);

    // Get current URL
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    // Check localStorage for auth data
    const localStorage = await page.evaluate(() => {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        data[key] = localStorage.getItem(key);
      }
      return data;
    });
    console.log('\n🔑 localStorage keys:', Object.keys(localStorage));

    // Check for React error boundary
    const hasReactError = await page.evaluate(() => {
      const errorDivs = Array.from(document.querySelectorAll('*')).filter(el => {
        const text = el.textContent || '';
        return text.includes('Objects are not valid as a React child') ||
               text.includes('ErrorBoundary') ||
               text.includes('Something went wrong');
      });
      return errorDivs.length > 0 ? errorDivs.map(el => el.textContent) : null;
    });

    if (hasReactError) {
      console.log('\n❌ REACT ERROR DETECTED:');
      console.log(hasReactError);
    }

    // Get page source to see what's actually rendered
    const pageContent = await page.content();
    const hasErrorInSource = pageContent.includes('Objects are not valid as a React child') ||
                             pageContent.includes('ErrorBoundary') ||
                             pageContent.includes('Something went wrong');

    console.log(`\nError in page source: ${hasErrorInSource ? 'YES' : 'NO'}`);

    // List all console messages
    console.log('\n📊 CONSOLE MESSAGES SUMMARY:');
    console.log(`Total messages: ${consoleMessages.length}`);
    console.log(`Errors: ${errors.length}`);
    console.log(`Warnings: ${consoleMessages.filter(m => m.type === 'warning').length}`);

    if (errors.length > 0) {
      console.log('\n❌ All Errors:');
      errors.forEach((err, i) => {
        console.log(`   ${i + 1}. ${err.text}`);
        if (err.location) {
          console.log(`      Location: ${err.location}`);
        }
      });
    }

    // Network requests summary
    console.log('\n🌐 Network Requests Summary:');
    console.log(`Total requests: ${networkRequests.length}`);
    const failedRequests = networkRequests.filter(r => r.status >= 400);
    if (failedRequests.length > 0) {
      console.log('Failed requests:');
      failedRequests.forEach(req => {
        console.log(`   ${req.status} - ${req.url}`);
      });
    }

    // Take a final screenshot
    await page.screenshot({ path: './tests/screenshots/05-final-state.png', fullPage: true });

    // Wait a bit to capture any delayed errors
    await page.waitForTimeout(3000);

    console.log('\n✅ Debug session complete!');
    console.log(`Screenshots saved to: ./tests/screenshots/`);
    console.log(`HAR file saved to: ./tests/har/debug-session.har`);

  } catch (error) {
    console.log('\n❌ ERROR during debug session:');
    console.log(error);

    await page.screenshot({ path: './tests/screenshots/error-state.png', fullPage: true });
  } finally {
    await context.close();
    await browser.close();
  }
}

// Create directories
const screenshotsDir = path.join(__dirname, 'screenshots');
const harDir = path.join(__dirname, 'har');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}
if (!fs.existsSync(harDir)) {
  fs.mkdirSync(harDir, { recursive: true });
}

// Run the debug script
debugApplication().catch(console.error);
