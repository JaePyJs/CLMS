import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Authentication Page Object Model
 *
 * Handles login, logout, and authentication-related functionality
 * including multi-role authentication and session management
 */
export class AuthPage extends BasePage {
  readonly url: string;

  // Login form elements
  readonly loginForm: Locator;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;
  readonly forgotPasswordLink: Locator;
  readonly rememberMeCheckbox: Locator;

  // System status indicators
  readonly systemStatusIndicator: Locator;
  readonly databaseStatusIndicator: Locator;
  readonly activeStatusIndicator: Locator;

  // Error and success messages
  readonly errorMessage: Locator;
  readonly successMessage: Locator;
  readonly validationMessage: Locator;

  // Theme elements
  readonly themeSwitcher: Locator;
  readonly lightThemeOption: Locator;
  readonly darkThemeOption: Locator;

  // School information
  readonly schoolName: Locator;
  readonly libraryName: Locator;

  constructor(page: Page) {
    super(page, '/login');
    this.url = '/login';

    // Initialize login form elements
    this.loginForm = page.locator('form[data-testid="login-form"]');
    this.usernameInput = page.getByLabel(/username|email/i);
    this.passwordInput = page.getByLabel(/password/i);
    this.signInButton = page.getByRole('button', { name: /sign in|login/i });
    this.forgotPasswordLink = page.getByRole('link', { name: /forgot password/i });
    this.rememberMeCheckbox = page.getByLabel(/remember me/i);

    // System status indicators
    this.systemStatusIndicator = page.locator('[data-testid="system-status"]');
    this.databaseStatusIndicator = page.locator('[data-testid="database-status"]');
    this.activeStatusIndicator = page.locator('[data-testid="active-status"]');

    // Messages
    this.errorMessage = page.locator('[data-testid="error-message"]');
    this.successMessage = page.locator('[data-testid="success-message"]');
    this.validationMessage = page.locator('[data-testid="validation-message"]');

    // Theme elements
    this.themeSwitcher = page.getByTestId('theme-switcher');
    this.lightThemeOption = page.getByRole('menuitem', { name: /light/i });
    this.darkThemeOption = page.getByRole('menuitem', { name: /dark/i });

    // School information
    this.schoolName = page.locator('[data-testid="school-name"]');
    this.libraryName = page.locator('[data-testid="library-name"]');
  }

  /**
   * Navigate to login page
   */
  async goto(): Promise<void> {
    await super.goto();
    await this.waitForLoginForm();
  }

  /**
   * Wait for login form to be visible and ready
   */
  async waitForLoginForm(): Promise<void> {
    await this.loginForm.waitFor({ state: 'visible', timeout: 10000 });
    await this.usernameInput.waitFor({ state: 'visible' });
    await this.passwordInput.waitFor({ state: 'visible' });
    await this.signInButton.waitFor({ state: 'visible' });
  }

  /**
   * Fill in login credentials
   */
  async fillCredentials(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
  }

  /**
   * Submit the login form
   */
  async submitLogin(): Promise<void> {
    await this.signInButton.click();
  }

  /**
   * Complete login flow
   */
  async login(username: string, password: string): Promise<void> {
    await this.fillCredentials(username, password);
    await this.submitLogin();
    await this.waitForLoginSuccess();
  }

  /**
   * Wait for successful login redirect
   */
  async waitForLoginSuccess(): Promise<void> {
    // Wait for redirect to dashboard
    await this.page.waitForURL('/', { timeout: 15000 });
    await this.waitForPageLoad();

    // Verify we're logged in by checking for dashboard elements
    await expect(this.tabDashboard).toBeVisible();
  }

  /**
   * Wait for login failure
   */
  async waitForLoginFailure(): Promise<void> {
    await this.errorMessage.waitFor({ state: 'visible', timeout: 5000 });
    // Should still be on login page
    await expect(this.page).toHaveURL(/\/login/);
  }

  /**
   * Check if login form is displayed correctly
   */
  async isLoginFormDisplayed(): Promise<boolean> {
    return await this.loginForm.isVisible();
  }

  /**
   * Get the current error message text
   */
  async getErrorMessage(): Promise<string> {
    return await this.errorMessage.textContent() || '';
  }

  /**
   * Get the current success message text
   */
  async getSuccessMessage(): Promise<string> {
    return await this.successMessage.textContent() || '';
  }

  /**
   * Check if form validation is working
   */
  async checkFormValidation(): Promise<boolean> {
    // Try to submit empty form
    await this.signInButton.click();

    // Check for validation messages or HTML5 validation
    const usernameRequired = await this.usernameInput.getAttribute('required');
    const passwordRequired = await this.passwordInput.getAttribute('required');

    return !!(usernameRequired && passwordRequired);
  }

  /**
   * Toggle remember me checkbox
   */
  async toggleRememberMe(): Promise<void> {
    if (await this.rememberMeCheckbox.isVisible()) {
      await this.rememberMeCheckbox.check();
    }
  }

  /**
   * Click forgot password link
   */
  async clickForgotPassword(): Promise<void> {
    await this.forgotPasswordLink.click();
  }

  /**
   * Check system status indicators
   */
  async checkSystemStatus(): Promise<{
    system: boolean;
    database: boolean;
    active: boolean;
  }> {
    const systemVisible = await this.systemStatusIndicator.isVisible();
    const databaseVisible = await this.databaseStatusIndicator.isVisible();
    const activeVisible = await this.activeStatusIndicator.isVisible();

    return {
      system: systemVisible,
      database: databaseVisible,
      active: activeVisible
    };
  }

  /**
   * Check if page displays correct school/library information
   */
  async checkSchoolInformation(): Promise<{
    schoolName: string;
    libraryName: string;
  }> {
    const school = await this.schoolName.textContent() || '';
    const library = await this.libraryName.textContent() || '';

    return {
      schoolName: school,
      libraryName: library
    };
  }

  /**
   * Test theme switching functionality
   */
  async testThemeSwitching(): Promise<void> {
    await this.themeSwitcher.click();

    // Check if theme options are visible
    const lightOptionVisible = await this.lightThemeOption.isVisible();
    const darkOptionVisible = await this.darkThemeOption.isVisible();

    if (lightOptionVisible && darkOptionVisible) {
      // Test dark theme
      await this.darkThemeOption.click();
      await this.page.waitForTimeout(300);
      const isDark = await this.isDarkTheme();
      if (!isDark) {
        console.log('Theme switching to dark mode may not be working correctly');
      }

      // Test light theme
      await this.themeSwitcher.click();
      await this.lightThemeOption.click();
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * Test login with different user roles
   */
  async loginWithRole(role: 'admin' | 'librarian' | 'teacher' | 'student'): Promise<void> {
    const credentials = this.getTestCredentials(role);
    await this.login(credentials.username, credentials.password);
  }

  /**
   * Get test credentials for different roles
   */
  private getTestCredentials(role: string): { username: string; password: string } {
    const credentials = {
      admin: { username: 'admin', password: 'librarian123' },
      librarian: { username: 'librarian', password: 'librarian123' },
      teacher: { username: 'teacher', password: 'teacher123' },
      student: { username: 'student', password: 'student123' }
    };

    return credentials[role as keyof typeof credentials] || credentials.admin;
  }

  /**
   * Check if user has appropriate permissions after login
   */
  async checkUserPermissions(expectedRole: string): Promise<boolean> {
    // Wait for page to load after login
    await this.waitForPageLoad();

    // Check if appropriate tabs/elements are visible based on role
    switch (expectedRole) {
      case 'admin':
        return await this.tabSettings.isVisible();
      case 'librarian':
        return await this.tabStudents.isVisible();
      case 'teacher':
        return await this.tabBooks.isVisible();
      case 'student':
        return await this.tabBooks.isVisible(); // Students can view books
      default:
        return false;
    }
  }

  /**
   * Test session persistence
   */
  async testSessionPersistence(): Promise<boolean> {
    const token = await this.page.evaluate(() => localStorage.getItem('token'));
    return !!token;
  }

  /**
   * Test session timeout
   */
  async testSessionTimeout(): Promise<void> {
    // Clear localStorage to simulate session timeout
    await this.page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    });

    // Try to access a protected page
    await this.page.goto('/dashboard');

    // Should be redirected to login
    await this.page.waitForURL('**/login');
  }

  /**
   * Test logout functionality
   */
  async logout(): Promise<void> {
    // Make sure we're logged in first
    if (await this.isAuthenticated()) {
      await super.logout();
    }
  }

  /**
   * Check accessibility of login form
   */
  async checkAccessibility(): Promise<void> {
    // Check form has proper labels
    await expect(this.usernameInput).toHaveAttribute('aria-label');
    await expect(this.passwordInput).toHaveAttribute('aria-label');

    // Check button has proper role
    await expect(this.signInButton).toHaveRole('button');

    // Check form has proper structure
    await expect(this.loginForm).toHaveAttribute('role', 'form');
  }
}