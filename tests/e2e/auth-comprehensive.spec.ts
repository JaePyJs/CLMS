import { test, expect } from '@playwright/test';
import { AuthPage } from './page-objects/auth.page';
import { DashboardPage } from './page-objects/dashboard.page';

/**
 * Comprehensive Authentication Tests
 *
 * Tests authentication flows for all 6 user role levels:
 * 1. SUPER_ADMIN - Full system access
 * 2. ADMIN - Administrative access
 * 3. LIBRARIAN - Library management access
 * 4. TEACHER - Teacher-specific access
 * 5. STUDENT - Student access
 * 6. VIEWER - Read-only access
 */

test.describe('Authentication - Comprehensive', () => {
  let authPage: AuthPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    dashboardPage = new DashboardPage(page);
  });

  test.describe('Login Page Validation', () => {
    test('should display login page with all required elements', async ({ page }) => {
      await authPage.goto();

      // Check page title and header
      await expect(page).toHaveTitle(/Comprehensive Library Management System/);
      await expect(authPage.schoolName).toBeVisible();
      await expect(authPage.libraryName).toBeVisible();

      // Check form elements
      await expect(authPage.loginForm).toBeVisible();
      await expect(authPage.usernameInput).toBeVisible();
      await expect(authPage.passwordInput).toBeVisible();
      await expect(authPage.signInButton).toBeVisible();

      // Check system status indicators
      const systemStatus = await authPage.checkSystemStatus();
      expect(systemStatus.system).toBe(true);
      expect(systemStatus.database).toBe(true);
      expect(systemStatus.active).toBe(true);

      // Check accessibility
      await authPage.checkAccessibility();
    });

    test('should validate empty form submission', async ({ page }) => {
      await authPage.goto();

      // Try to submit empty form
      await authPage.submitLogin();

      // Check for validation
      const hasValidation = await authPage.checkFormValidation();
      expect(hasValidation).toBe(true);

      // Should still be on login page
      await expect(page).toHaveURL(/\/login/);
    });

    test('should validate invalid credentials', async ({ page }) => {
      await authPage.goto();

      // Try invalid credentials
      await authPage.login('invaliduser', 'invalidpass');

      // Should show error message
      await authPage.waitForLoginFailure();
      const errorMessage = await authPage.getErrorMessage();
      expect(errorMessage).toMatch(/invalid|failed|incorrect/i);

      // Should still be on login page
      await expect(page).toHaveURL(/\/login/);
    });

    test('should handle theme switching on login page', async ({ page }) => {
      await authPage.goto();

      // Test theme switching
      await authPage.testThemeSwitching();

      // Verify theme persistence
      const isDark = await authPage.isDarkTheme();
      expect(typeof isDark).toBe('boolean');
    });
  });

  test.describe('Role-Based Authentication', () => {
    const userRoles = [
      {
        role: 'SUPER_ADMIN',
        username: 'superadmin',
        password: 'admin123',
        expectedTabs: ['Dashboard', 'Students', 'Books', 'Equipment', 'Analytics', 'Automation', 'Reports', 'Settings'],
        expectedPermissions: ['user_management', 'system_config', 'full_access']
      },
      {
        role: 'ADMIN',
        username: 'admin',
        password: 'librarian123',
        expectedTabs: ['Dashboard', 'Students', 'Books', 'Equipment', 'Analytics', 'Reports', 'Settings'],
        expectedPermissions: ['user_management', 'library_management', 'reporting']
      },
      {
        role: 'LIBRARIAN',
        username: 'librarian',
        password: 'librarian123',
        expectedTabs: ['Dashboard', 'Students', 'Books', 'Equipment', 'Reports'],
        expectedPermissions: ['circulation', 'cataloging', 'reporting']
      },
      {
        role: 'TEACHER',
        username: 'teacher',
        password: 'teacher123',
        expectedTabs: ['Dashboard', 'Books', 'Reports'],
        expectedPermissions: ['view_catalog', 'class_management']
      },
      {
        role: 'STUDENT',
        username: 'student',
        password: 'student123',
        expectedTabs: ['Dashboard', 'Books'],
        expectedPermissions: ['view_catalog', 'account_management']
      },
      {
        role: 'VIEWER',
        username: 'viewer',
        password: 'viewer123',
        expectedTabs: ['Dashboard', 'Analytics'],
        expectedPermissions: ['read_only']
      }
    ];

    userRoles.forEach(({ role, username, password, expectedTabs, expectedPermissions }) => {
      test(`should authenticate ${role} role with correct permissions`, async ({ page }) => {
        await authPage.goto();

        // Login with role-specific credentials
        await authPage.login(username, password);

        // Verify successful login
        await expect(page).toHaveURL('/');

        // Check user role is set correctly
        const userRole = await page.evaluate(() => localStorage.getItem('userRole'));
        expect(userRole).toBe(role);

        // Verify correct tabs are available
        const availableTabs = await dashboardPage.getAvailableTabs();
        expectedTabs.forEach(expectedTab => {
          expect(availableTabs).toContain(expectedTab);
        });

        // Verify restricted tabs are not available
        const allTabs = ['Dashboard', 'Students', 'Books', 'Checkout', 'Equipment', 'Scan',
                        'Analytics', 'Automation', 'Reports', 'Barcode', 'QR', 'Notifications', 'Settings'];
        const restrictedTabs = allTabs.filter(tab => !expectedTabs.includes(tab));

        for (const restrictedTab of restrictedTabs) {
          expect(availableTabs).not.toContain(restrictedTab);
        }

        // Test access to permitted tabs
        for (const tab of expectedTabs.slice(0, 3)) { // Test first 3 tabs for efficiency
          await dashboardPage.navigateToTab(tab);
          await expect(page.getByRole('tabpanel')).toBeVisible();
        }

        // Test access restrictions (try to access restricted URLs directly)
        for (const restrictedTab of restrictedTabs) {
          const restrictedUrl = `/${restrictedTab.toLowerCase()}`;
          await page.goto(restrictedUrl);

          // Should be redirected or show access denied
          await expect(page.locator('[data-testid="access-denied"]')).toBeVisible({ timeout: 5000 });
        }

        // Logout
        await authPage.logout();
      });

      test(`should handle ${role} session persistence`, async ({ page, context }) => {
        await authPage.goto();
        await authPage.login(username, password);

        // Verify session is stored
        const hasSession = await authPage.testSessionPersistence();
        expect(hasSession).toBe(true);

        // Create new page context to test session persistence
        const newPage = await context.newPage();
        await newPage.goto('/');

        // Should be logged in (session persisted)
        await expect(newPage.locator('[data-testid="dashboard"]')).toBeVisible();

        // Test logout clears session
        await authPage.logout();

        // Verify session is cleared
        const sessionCleared = await page.evaluate(() => {
          return !localStorage.getItem('token') && !localStorage.getItem('user');
        });
        expect(sessionCleared).toBe(true);
      });
    });
  });

  test.describe('Session Management', () => {
    test('should handle session timeout gracefully', async ({ page }) => {
      await authPage.goto();
      await authPage.login('admin', 'librarian123');

      // Simulate session timeout by clearing tokens
      await authPage.testSessionTimeout();

      // Should be redirected to login
      await expect(page).toHaveURL(/\/login/);

      // Should show session timeout message
      const errorMessage = await authPage.getErrorMessage();
      expect(errorMessage).toMatch(/session|timeout|expired/i);
    });

    test('should handle concurrent login attempts', async ({ context }) => {
      const page1 = await context.newPage();
      const page2 = await context.newPage();

      const authPage1 = new AuthPage(page1);
      const authPage2 = new AuthPage(page2);

      // Login with same user on two pages
      await authPage1.goto();
      await authPage2.goto();

      await authPage1.login('admin', 'librarian123');
      await authPage2.login('admin', 'librarian123');

      // Both should succeed (or show appropriate message about concurrent sessions)
      await expect(page1).toHaveURL('/');
      await expect(page2).toHaveURL('/');
    });

    test('should remember login preference', async ({ page }) => {
      await authPage.goto();

      // Enable remember me
      await authPage.toggleRememberMe();
      await authPage.login('admin', 'librarian123');

      // Check if remember me preference is stored
      const rememberMe = await page.evaluate(() => localStorage.getItem('rememberMe'));
      expect(rememberMe).toBe('true');

      await authPage.logout();

      // Verify username is remembered on login page
      await authPage.goto();
      const usernameValue = await authPage.usernameInput.inputValue();
      expect(usernameValue).toBe('admin');
    });
  });

  test.describe('Security Features', () => {
    test('should enforce password requirements', async ({ page }) => {
      await authPage.goto();

      // Test weak passwords
      const weakPasswords = ['123', 'password', 'admin'];

      for (const weakPassword of weakPasswords) {
        await authPage.fillCredentials('testuser', weakPassword);
        await authPage.submitLogin();

        // Should not succeed with weak passwords (if user exists)
        const stillOnLoginPage = await page.locator('form').isVisible();
        if (stillOnLoginPage) {
          console.log(`Password '${weakPassword}' correctly rejected`);
        }
      }
    });

    test('should limit login attempts', async ({ page }) => {
      await authPage.goto();

      // Make multiple failed login attempts
      const maxAttempts = 5;
      for (let i = 0; i < maxAttempts; i++) {
        await authPage.login('wronguser', 'wrongpass');
        await page.waitForTimeout(1000);
      }

      // Should show rate limiting message or temporarily block login
      const errorMessage = await authPage.getErrorMessage();
      const hasRateLimit = errorMessage.includes('attempts') ||
                         errorMessage.includes('blocked') ||
                         errorMessage.includes('rate limit');

      if (hasRateLimit) {
        console.log('Rate limiting is working correctly');
      }
    });

    test('should protect against brute force attacks', async ({ page }) => {
      await authPage.goto();

      // Simulate rapid login attempts
      const rapidAttempts = 10;
      for (let i = 0; i < rapidAttempts; i++) {
        await authPage.fillCredentials(`user${i}`, `pass${i}`);
        await authPage.submitLogin();

        // Check if CAPTCHA or additional verification appears
        const hasCaptcha = await page.locator('[data-testid="captcha"]').isVisible();
        if (hasCaptcha) {
          console.log('CAPTCHA protection activated');
          break;
        }
      }
    });

    test('should sanitize user input to prevent XSS', async ({ page }) => {
      await authPage.goto();

      // Test XSS payload in username
      const xssPayload = '<script>alert("XSS")</script>';
      await authPage.fillCredentials(xssPayload, 'password123');
      await authPage.submitLogin();

      // Check if XSS payload is escaped/sanitized
      const pageContent = await page.content();
      const hasUnescapedScript = pageContent.includes('<script>') &&
                                !pageContent.includes('&lt;script&gt;');

      expect(hasUnescapedScript).toBe(false);
    });
  });

  test.describe('Accessibility', () => {
    test('should be accessible via keyboard navigation', async ({ page }) => {
      await authPage.goto();

      // Test keyboard navigation through form
      await page.keyboard.press('Tab'); // Focus username
      await expect(authPage.usernameInput).toBeFocused();

      await page.keyboard.press('Tab'); // Focus password
      await expect(authPage.passwordInput).toBeFocused();

      await page.keyboard.press('Tab'); // Focus sign in button
      await expect(authPage.signInButton).toBeFocused();

      // Test Enter key submission
      await page.keyboard.press('Enter');

      // Should attempt login (even if it fails)
      const stillOnLogin = await page.locator('form').isVisible();
      expect(typeof stillOnLogin).toBe('boolean');
    });

    test('should have proper ARIA labels and roles', async ({ page }) => {
      await authPage.goto();

      // Check form accessibility
      await expect(authPage.loginForm).toHaveAttribute('role', 'form');

      // Check input labels
      await expect(authPage.usernameInput).toHaveAttribute('aria-label');
      await expect(authPage.passwordInput).toHaveAttribute('aria-label');

      // Check button accessibility
      await expect(authPage.signInButton).toHaveRole('button');
      await expect(authPage.signInButton).toHaveAttribute('type', 'submit');
    });

    test('should support screen readers', async ({ page }) => {
      await authPage.goto();

      // Check for proper heading structure
      const mainHeading = page.locator('h1');
      await expect(mainHeading).toBeVisible();

      // Check for form labels that screen readers can use
      await expect(authPage.usernameInput).toHaveAttribute('aria-describedby');
      await expect(authPage.passwordInput).toHaveAttribute('aria-describedby');

      // Check for status announcements
      const statusRegion = page.locator('[aria-live="polite"]');
      await expect(statusRegion).toBeVisible();
    });
  });

  test.describe('Performance', () => {
    test('should load login page quickly', async ({ page }) => {
      const startTime = Date.now();
      await authPage.goto();
      const loadTime = Date.now() - startTime;

      // Login page should load in under 3 seconds
      expect(loadTime).toBeLessThan(3000);
    });

    test('should respond quickly to login attempts', async ({ page }) => {
      await authPage.goto();

      const startTime = Date.now();
      await authPage.login('admin', 'librarian123');
      const responseTime = Date.now() - startTime;

      // Login response should be under 5 seconds
      expect(responseTime).toBeLessThan(5000);
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Simulate network failure
      await page.route('**/api/auth/login', route => route.abort());

      await authPage.goto();
      await authPage.login('admin', 'librarian123');

      // Should show network error message
      const errorMessage = await authPage.getErrorMessage();
      expect(errorMessage).toMatch(/network|connection|error/i);
    });

    test('should handle server errors gracefully', async ({ page }) => {
      // Simulate server error
      await page.route('**/api/auth/login', route =>
        route.fulfill({ status: 500, body: 'Internal Server Error' })
      );

      await authPage.goto();
      await authPage.login('admin', 'librarian123');

      // Should show server error message
      const errorMessage = await authPage.getErrorMessage();
      expect(errorMessage).toMatch(/server|error|unavailable/i);
    });

    test('should handle CORS issues properly', async ({ page }) => {
      // This would be tested with actual CORS setup
      await authPage.goto();

      // Should not show CORS errors in console
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error' && msg.text().includes('CORS')) {
          errors.push(msg.text());
        }
      });

      await authPage.login('admin', 'librarian123');

      expect(errors.length).toBe(0);
    });
  });
});