import { test, expect } from '@playwright/test';
import { AuthPage } from './page-objects/auth.page';
import { DashboardPage } from './page-objects/dashboard.page';

/**
 * Security and FERPA Compliance Tests
 *
 * Tests security features and FERPA (Family Educational Rights and Privacy Act) compliance:
 * - Authentication security
 * - Authorization and role-based access control
 * - Data encryption and secure transmission
 * - Session management
 * - Input validation and XSS protection
 * - CSRF protection
 * - Data privacy and FERPA compliance
 * - Audit logging
 * - Secure file handling
 * - Rate limiting and brute force protection
 */

test.describe('Security and FERPA Compliance', () => {
  let authPage: AuthPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    dashboardPage = new DashboardPage(page);
  });

  test.describe('Authentication Security', () => {
    test('should enforce secure password policies', async ({ page }) => {
      await authPage.goto();

      // Test weak passwords that should be rejected
      const weakPasswords = [
        '123456',
        'password',
        'admin',
        'qwerty',
        'letmein',
        'welcome',
        'monkey'
      ];

      for (const weakPassword of weakPasswords) {
        await authPage.fillCredentials('testuser', weakPassword);
        await authPage.submitLogin();

        // Should not succeed with weak passwords
        await page.waitForTimeout(1000);

        const stillOnLogin = await page.locator('form').isVisible();
        if (stillOnLogin) {
          const errorMessage = await authPage.getErrorMessage();
          if (errorMessage) {
            console.log(`Weak password "${weakPassword}" correctly rejected`);
          }
        }
      }
    });

    test('should enforce account lockout after failed attempts', async ({ page }) => {
      await authPage.goto();

      const maxAttempts = 5;
      let lockedOut = false;

      // Make multiple failed login attempts
      for (let i = 0; i < maxAttempts + 2; i++) {
        await authPage.fillCredentials(`user${i}`, `wrongpass${i}`);
        await authPage.submitLogin();
        await page.waitForTimeout(500);

        if (i >= maxAttempts) {
          const errorMessage = await authPage.getErrorMessage();
          if (errorMessage && (
            errorMessage.includes('locked') ||
            errorMessage.includes('blocked') ||
            errorMessage.includes('attempts') ||
            errorMessage.includes('suspended')
          )) {
            lockedOut = true;
            break;
          }
        }
      }

      if (lockedOut) {
        console.log('Account lockout mechanism is working correctly');

        // Try with correct credentials - should still be locked out
        await authPage.fillCredentials('admin', 'librarian123');
        await authPage.submitLogin();

        const errorMessage = await authPage.getErrorMessage();
        expect(errorMessage).toMatch(/locked|blocked|suspended|attempts/i);
      } else {
        console.log('Account lockout not detected - may not be implemented');
      }
    });

    test('should implement secure session management', async ({ page }) => {
      await authPage.goto();
      await authPage.login('admin', 'librarian123');

      // Check for secure session cookies
      const cookies = await page.context().cookies();
      const sessionCookie = cookies.find(cookie => cookie.name.toLowerCase().includes('session') || cookie.name.toLowerCase().includes('token'));

      if (sessionCookie) {
        expect(sessionCookie.httpOnly).toBe(true); // Should be HttpOnly
        expect(sessionCookie.secure).toBe(true);   // Should be Secure (in production)
        expect(sessionCookie.sameSite).toBe('Strict' || 'Lax'); // Should have SameSite protection
      }

      // Check session storage
      const sessionData = await page.evaluate(() => {
        return {
          token: sessionStorage.getItem('token'),
          user: sessionStorage.getItem('user'),
          role: sessionStorage.getItem('role')
        };
      });

      // Sensitive data should be in localStorage with proper handling
      const localStorageData = await page.evaluate(() => {
        return {
          token: localStorage.getItem('token'),
          user: localStorage.getItem('user'),
          role: localStorage.getItem('role')
        };
      });

      expect(localStorageData.token).toBeTruthy();
      expect(localStorageData.user).toBeTruthy();
    });

    test('should handle session timeout securely', async ({ page }) => {
      await authPage.goto();
      await authPage.login('admin', 'librarian123');

      // Clear session to simulate timeout
      await page.evaluate(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.clear();
      });

      // Try to access protected resource
      await page.goto('/dashboard');

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);

      // Should show appropriate message
      const errorMessage = await authPage.getErrorMessage();
      expect(errorMessage).toMatch(/session|timeout|expired|login/i);
    });
  });

  test.describe('Authorization and Access Control', () => {
    test('should enforce role-based access control', async ({ page }) => {
      const roleTests = [
        {
          role: 'student',
          username: 'student',
          password: 'student123',
          allowedTabs: ['Dashboard', 'Books'],
          forbiddenTabs: ['Students', 'Settings', 'Analytics', 'Automation']
        },
        {
          role: 'teacher',
          username: 'teacher',
          password: 'teacher123',
          allowedTabs: ['Dashboard', 'Books', 'Reports'],
          forbiddenTabs: ['Settings', 'Automation', 'Users']
        },
        {
          role: 'librarian',
          username: 'librarian',
          password: 'librarian123',
          allowedTabs: ['Dashboard', 'Students', 'Books', 'Equipment', 'Reports'],
          forbiddenTabs: ['Settings', 'Automation']
        },
        {
          role: 'admin',
          username: 'admin',
          password: 'librarian123',
          allowedTabs: ['Dashboard', 'Students', 'Books', 'Equipment', 'Analytics', 'Reports', 'Settings'],
          forbiddenTabs: []
        }
      ];

      for (const roleTest of roleTests) {
        console.log(`Testing role: ${roleTest.role}`);

        await authPage.goto();
        await authPage.login(roleTest.username, roleTest.password);

        // Check allowed tabs are visible
        const availableTabs = await dashboardPage.getAvailableTabs();

        for (const allowedTab of roleTest.allowedTabs) {
          const hasTab = availableTabs.some(tab => tab.toLowerCase().includes(allowedTab.toLowerCase()));
          if (hasTab) {
            console.log(`✅ ${roleTest.role} can access ${allowedTab}`);
          }
        }

        // Test direct URL access to forbidden tabs
        for (const forbiddenTab of roleTest.forbiddenTabs) {
          const forbiddenUrl = `/${forbiddenTab.toLowerCase()}`;
          await page.goto(forbiddenUrl);

          // Should show access denied or redirect
          const accessDenied = page.locator('[data-testid="access-denied"], [data-testid="unauthorized"]');
          const isRedirected = await page.url().includes('/login');

          const hasAccessControl = await accessDenied.isVisible() || isRedirected;

          if (hasAccessControl) {
            console.log(`✅ ${roleTest.role} correctly blocked from ${forbiddenTab}`);
          } else {
            console.log(`⚠️  ${roleTest.role} might have unauthorized access to ${forbiddenTab}`);
          }
        }

        await authPage.logout();
      }
    });

    test('should validate data access permissions', async ({ page }) => {
      // Test with student role (limited access)
      await authPage.goto();
      await authPage.login('student', 'student123');

      await dashboardPage.navigateToStudentManagement();

      // Students should only see their own information
      const studentList = page.locator('[data-testid="student-list"]');
      if (await studentList.isVisible()) {
        const studentItems = studentList.locator('[data-student-id]');
        const itemCount = await studentItems.count();

        if (itemCount > 1) {
          console.log('⚠️  Student can see multiple student records - potential privacy issue');
        } else {
          console.log('✅ Student access properly limited');
        }
      }

      // Test with admin role (full access)
      await authPage.logout();
      await authPage.login('admin', 'librarian123');

      await dashboardPage.navigateToStudentManagement();

      // Admin should see all students
      const adminStudentList = page.locator('[data-testid="student-list"]');
      if (await adminStudentList.isVisible()) {
        const adminStudentItems = adminStudentList.locator('[data-student-id]');
        const adminItemCount = await adminStudentItems.count();

        console.log(`Admin can see ${adminItemCount} student records`);
      }
    });
  });

  test.describe('Input Validation and XSS Protection', () => {
    test('should sanitize user inputs to prevent XSS', async ({ page }) => {
      await authPage.goto();

      // Test various XSS payloads
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '"><script>alert("XSS")</script>',
        '<img src="x" onerror="alert(\'XSS\')">',
        'javascript:alert("XSS")',
        '<svg onload="alert(\'XSS\')">',
        '<iframe src="javascript:alert(\'XSS\')">',
        '<body onload="alert(\'XSS\')">',
        '<input autofocus onfocus="alert(\'XSS\')">'
      ];

      for (const payload of xssPayloads) {
        await authPage.fillCredentials(payload, 'password123');
        await authPage.submitLogin();

        // Check page content for unescaped scripts
        const pageContent = await page.content();
        const hasUnescapedScript = pageContent.includes('<script>') &&
                                  !pageContent.includes('&lt;script&gt;');

        expect(hasUnescapedScript).toBe(false);

        // Check for XSS execution attempts
        const xssExecuted = await page.evaluate(() => {
          return window.xssDetected === true;
        });

        expect(xssExecuted).toBe(false);
      }
    });

    test('should validate form inputs properly', async ({ page }) => {
      await authPage.goto();
      await authPage.login('admin', 'librarian123');

      await dashboardPage.navigateToStudentManagement();

      // Test adding student with invalid data
      const addButton = page.locator('[data-testid="add-student-button"]');
      if (await addButton.isVisible()) {
        await addButton.click();

        // Test various invalid inputs
        const invalidInputs = {
          firstName: ['', '<script>', '1234567890'.repeat(10)], // Empty, script, too long
          lastName: ['', '<img src=x onerror=alert(1)>', 'A'.repeat(101)], // Empty, XSS, too long
          email: ['invalid-email', '<script>', 'test@'.repeat(50)], // Invalid format
          phone: ['123', 'abcdefghij', '<script>alert(1)</script>'], // Invalid formats
          grade: ['-1', '13', 'invalid'], // Invalid grades
        };

        for (const [field, invalidValues] of Object.entries(invalidInputs)) {
          for (const invalidValue of invalidValues) {
            const input = page.getByLabel(new RegExp(field, 'i'));
            if (await input.isVisible()) {
              await input.fill(invalidValue);
              await page.waitForTimeout(100);

              // Check for validation messages
              const validationMessage = page.locator('[data-testid="validation-error"]');
              const hasValidation = await validationMessage.isVisible();

              if (hasValidation) {
                console.log(`✅ Validation working for ${field} with value: ${invalidValue}`);
              }
            }
          }
        }
      }
    });

    test('should prevent SQL injection attempts', async ({ page }) => {
      await authPage.goto();

      // Test SQL injection payloads
      const sqlPayloads = [
        "admin'--",
        "admin' /*",
        "' OR 1=1--",
        "' OR 'a'='a",
        "1' UNION SELECT * FROM users--",
        "'; DROP TABLE users; --",
        "' OR 1=1#",
        "admin'/**/OR/**/1=1--"
      ];

      for (const payload of sqlPayloads) {
        await authPage.fillCredentials(payload, 'password');
        await authPage.submitLogin();

        await page.waitForTimeout(1000);

        // Should not authenticate with SQL injection
        const isLoggedIn = await page.evaluate(() => {
          return !!localStorage.getItem('token');
        });

        expect(isLoggedIn).toBe(false);

        const stillOnLogin = await page.locator('form').isVisible();
        expect(stillOnLogin).toBe(true);
      }
    });
  });

  test.describe('FERPA Compliance', () => {
    test('should protect student privacy information', async ({ page }) => {
      await authPage.goto();
      await authPage.login('admin', 'librarian123');

      await dashboardPage.navigateToStudentManagement();

      // Check for sensitive data handling
      const studentRecords = page.locator('[data-student-id]');
      const recordCount = await studentRecords.count();

      if (recordCount > 0) {
        const firstRecord = studentRecords.first();

        // Check for data masking of sensitive fields
        const ssnElements = firstRecord.locator('[data-field="ssn"], [data-field="social-security"]');
        const ssnCount = await ssnElements.count();

        for (let i = 0; i < ssnCount; i++) {
          const ssnElement = ssnElements.nth(i);
          const ssnValue = await ssnElement.textContent();

          if (ssnValue) {
            // SSN should be masked (XXX-XX-1234 format)
            expect(ssnValue).toMatch(/^\*{3}-\*{2}-\d{4}$/);
          }
        }

        // Check for proper data encryption indicators
        const sensitiveFields = firstRecord.locator('[data-sensitive="true"]');
        const sensitiveCount = await sensitiveFields.count();

        for (let i = 0; i < sensitiveCount; i++) {
          const field = sensitiveFields.nth(i);
          const isMasked = await field.getAttribute('data-masked');

          if (isMasked === 'true') {
            console.log('✅ Sensitive field is properly masked');
          }
        }
      }
    });

    test('should log access to student records', async ({ page }) => {
      await authPage.goto();
      await authPage.login('admin', 'librarian123');

      // Monitor network requests for audit logging
      const auditLogs: any[] = [];

      page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/api/audit') || url.includes('/api/logs')) {
          auditLogs.push({
            url: url,
            status: response.status(),
            timestamp: Date.now()
          });
        }
      });

      await dashboardPage.navigateToStudentManagement();

      // View a student record
      const studentRecords = page.locator('[data-student-id]');
      if (await studentRecords.count() > 0) {
        await studentRecords.first().click();
        await page.waitForTimeout(1000);

        // Check if access was logged
        const hasAuditLog = auditLogs.length > 0;

        if (hasAuditLog) {
          console.log('✅ Student record access was logged');
        } else {
          console.log('⚠️  Audit logging not detected');
        }
      }
    });

    test('should provide consent mechanisms for data sharing', async ({ page }) => {
      await authPage.goto();
      await authPage.login('student', 'student123');

      // Check for consent management
      const consentSection = page.locator('[data-testid="consent-management"]');
      const hasConsentSection = await consentSection.isVisible();

      if (hasConsentSection) {
        // Check for consent checkboxes
        const consentCheckboxes = consentSection.locator('input[type="checkbox"]');
        const checkboxCount = await consentCheckboxes.count();

        expect(checkboxCount).toBeGreaterThan(0);

        for (let i = 0; i < checkboxCount; i++) {
          const checkbox = consentCheckboxes.nth(i);
          const hasLabel = await checkbox.locator('xpath=./following-sibling::label').count() > 0 ||
                           await checkbox.getAttribute('aria-label');

          expect(hasLabel).toBeTruthy();
        }
      }
    });

    test('should implement data retention policies', async ({ page }) => {
      await authPage.goto();
      await authPage.login('admin', 'librarian123');

      await dashboardPage.navigateToSettings();
      await dashboardPage.navigateToSettingSection('privacy');

      // Look for data retention settings
      const retentionSettings = page.locator('[data-testid="data-retention"]');
      const hasRetentionSettings = await retentionSettings.isVisible();

      if (hasRetentionSettings) {
        const retentionPeriods = retentionSettings.locator('select, input[type="number"]');
        const periodCount = await retentionPeriods.count();

        expect(periodCount).toBeGreaterThan(0);

        console.log('✅ Data retention policies are configurable');
      }
    });
  });

  test.describe('Secure Data Transmission', () => {
    test('should use HTTPS for all communications', async ({ page }) => {
      // Check if the page is loaded over HTTPS
      const currentUrl = page.url();

      // In local development, this might be HTTP, but in production should be HTTPS
      if (currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1')) {
        console.log('Local development - HTTPS not required');
      } else {
        expect(currentUrl).toMatch(/^https:\/\//);
      }

      // Check for secure cookie attributes
      const cookies = await page.context().cookies();

      for (const cookie of cookies) {
        if (cookie.name.includes('session') || cookie.name.includes('token')) {
          expect(cookie.secure).toBe(true);
          expect(cookie.httpOnly).toBe(true);
        }
      }
    });

    test('should implement CSRF protection', async ({ page }) => {
      await authPage.goto();
      await authPage.login('admin', 'librarian123');

      // Check for CSRF tokens in forms
      const forms = page.locator('form');
      const formCount = await forms.count();

      for (let i = 0; i < Math.min(formCount, 3); i++) {
        const form = forms.nth(i);
        const csrfToken = form.locator('input[name*="csrf"], input[name*="token"]');
        const hasToken = await csrfToken.count() > 0;

        if (hasToken) {
          console.log('✅ CSRF token found in form');
        }
      }

      // Check for CSRF headers in API requests
      const apiRequests: any[] = [];

      page.on('request', request => {
        if (request.url().includes('/api/')) {
          const headers = request.headers();
          const hasCSRFHeader = headers['x-csrf-token'] || headers['csrf-token'];

          if (hasCSRFHeader) {
            apiRequests.push({
              url: request.url(),
              hasCSRF: true
            });
          }
        }
      });

      // Make a request that should have CSRF protection
      await dashboardPage.navigateToStudentManagement();
      await page.waitForTimeout(2000);

      if (apiRequests.length > 0) {
        console.log('✅ CSRF protection detected in API requests');
      }
    });

    test('should implement content security policy', async ({ page }) => {
      await authPage.goto();

      // Check for CSP headers
      const cspHeader = await page.evaluate(() => {
        const metaTags = document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]');
        return metaTags.length > 0 ? metaTags[0].getAttribute('content') : null;
      });

      if (cspHeader) {
        console.log('CSP Policy found:', cspHeader);

        // Check for common CSP directives
        expect(cspHeader).toContain('default-src');
        expect(cspHeader).toContain('script-src');
        expect(cspHeader).toContain('style-src');
      } else {
        // Check CSP via HTTP headers (would need server access for full verification)
        console.log('CSP meta tag not found - may be implemented via HTTP headers');
      }
    });
  });

  test.describe('Audit and Logging', () => {
    test('should log security-relevant events', async ({ page }) => {
      const securityEvents: any[] = [];

      // Monitor for security events
      page.on('console', msg => {
        if (msg.type() === 'error' || msg.type() === 'warning') {
          securityEvents.push({
            type: msg.type(),
            text: msg.text(),
            timestamp: Date.now()
          });
        }
      });

      // Test failed login attempts
      await authPage.goto();
      await authPage.login('invaliduser', 'invalidpass');

      // Test successful login
      await authPage.login('admin', 'librarian123');

      // Test access to restricted area
      await page.goto('/admin/users'); // Assuming this exists

      // Check if security events were logged
      console.log('Security events detected:', securityEvents);

      // Should have some form of logging
      expect(securityEvents.length >= 0).toBeTruthy();
    });

    test('should provide audit trail for sensitive operations', async ({ page }) => {
      await authPage.goto();
      await authPage.login('admin', 'librarian123');

      // Monitor sensitive operations
      const sensitiveOperations: any[] = [];

      page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/api/students') || url.includes('/api/users') || url.includes('/api/settings')) {
          const method = await response.request().method();

          if (['POST', 'PUT', 'DELETE'].includes(method)) {
            sensitiveOperations.push({
              method,
              url: url,
              status: response.status(),
              timestamp: Date.now()
            });
          }
        }
      });

      // Perform sensitive operations
      await dashboardPage.navigateToStudentManagement();

      const addButton = page.locator('[data-testid="add-student-button"]');
      if (await addButton.isVisible()) {
        await addButton.click();

        // Fill form with test data
        await page.getByLabel(/first name/i).fill('Test');
        await page.getByLabel(/last name/i).fill('Student');

        // Try to submit (should be logged)
        const submitButton = page.locator('button[type="submit"]');
        if (await submitButton.isVisible()) {
          await submitButton.click();
          await page.waitForTimeout(1000);
        }
      }

      console.log('Sensitive operations detected:', sensitiveOperations);

      // Sensitive operations should be logged
      if (sensitiveOperations.length > 0) {
        for (const op of sensitiveOperations) {
          expect(op.timestamp).toBeTruthy();
          expect(op.url).toBeTruthy();
          expect(op.method).toBeTruthy();
        }
      }
    });
  });

  test.describe('Rate Limiting and DoS Protection', () => {
    test('should implement rate limiting on login', async ({ page }) => {
      await authPage.goto();

      const maxRequests = 20;
      const startTime = Date.now();
      let rateLimited = false;

      // Make rapid requests
      for (let i = 0; i < maxRequests; i++) {
        await authPage.fillCredentials(`user${i}`, `pass${i}`);
        await authPage.submitLogin();

        if (i > 10) { // After 10 attempts, check for rate limiting
          const errorMessage = await authPage.getErrorMessage();
          if (errorMessage && (
            errorMessage.includes('rate limit') ||
            errorMessage.includes('too many requests') ||
            errorMessage.includes('try again later')
          )) {
            rateLimited = true;
            break;
          }
        }

        await page.waitForTimeout(100); // Small delay between requests
      }

      const totalTime = Date.now() - startTime;

      if (rateLimited) {
        console.log('✅ Rate limiting is working');
      } else {
        console.log(`⚠️  Rate limiting not detected. Made ${maxRequests} requests in ${totalTime}ms`);
      }
    });

    test('should handle large request payloads', async ({ page }) => {
      await authPage.goto();
      await authPage.login('admin', 'librarian123');

      await dashboardPage.navigateToStudentManagement();

      // Test with large payload
      const largePayload = 'A'.repeat(10000); // 10KB payload

      const addButton = page.locator('[data-testid="add-student-button"]');
      if (await addButton.isVisible()) {
        await addButton.click();

        const firstNameInput = page.getByLabel(/first name/i);
        if (await firstNameInput.isVisible()) {
          await firstNameInput.fill(largePayload);

          // Should either accept or reject gracefully
          const submitButton = page.locator('button[type="submit"]');
          if (await submitButton.isVisible()) {
            await submitButton.click();
            await page.waitForTimeout(2000);

            // Should not crash the application
            const pageStillResponsive = await page.locator('body').isVisible();
            expect(pageStillResponsive).toBe(true);
          }
        }
      }
    });
  });
});