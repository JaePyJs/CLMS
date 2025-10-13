import { Page, Locator, expect } from '@playwright/test';

/**
 * Base Page Object Model
 *
 * Provides common functionality for all page objects in the CLMS application.
 * Includes shared elements like navigation, theme, authentication state, etc.
 */
export class BasePage {
  readonly page: Page;
  readonly url: string;

  // Common locators
  readonly header: Locator;
  readonly mainNavigation: Locator;
  readonly themeToggle: Locator;
  readonly userMenu: Locator;
  readonly logoutButton: Locator;
  readonly searchInput: Locator;
  readonly breadcrumbs: Locator;
  readonly footer: Locator;

  // Dashboard tab locators
  readonly dashboardTabs: Locator;
  readonly tabDashboard: Locator;
  readonly tabStudents: Locator;
  readonly tabBooks: Locator;
  readonly tabCheckout: Locator;
  readonly tabEquipment: Locator;
  readonly tabScan: Locator;
  readonly tabAnalytics: Locator;
  readonly tabAutomation: Locator;
  readonly tabReports: Locator;
  readonly tabBarcode: Locator;
  readonly tabQR: Locator;
  readonly tabNotifications: Locator;
  readonly tabSettings: Locator;

  constructor(page: Page, url: string = '/') {
    this.page = page;
    this.url = url;

    // Initialize common locators
    this.header = page.locator('header');
    this.mainNavigation = page.locator('nav[role="navigation"]');
    this.themeToggle = page.getByRole('button', { name: /toggle theme/i });
    this.userMenu = page.getByTestId('user-menu');
    this.logoutButton = page.getByRole('menuitem', { name: /logout|sign out/i });
    this.searchInput = page.getByPlaceholder(/search/i);
    this.breadcrumbs = page.locator('[aria-label="breadcrumb"]');
    this.footer = page.locator('footer');

    // Dashboard tabs
    this.dashboardTabs = page.locator('[data-testid="dashboard-tabs"]');
    this.tabDashboard = page.getByRole('tab', { name: /dashboard|overview/i });
    this.tabStudents = page.getByRole('tab', { name: /students/i });
    this.tabBooks = page.getByRole('tab', { name: /books/i });
    this.tabCheckout = page.getByRole('tab', { name: /checkout/i });
    this.tabEquipment = page.getByRole('tab', { name: /equipment/i });
    this.tabScan = page.getByRole('tab', { name: /scan/i });
    this.tabAnalytics = page.getByRole('tab', { name: /analytics/i });
    this.tabAutomation = page.getByRole('tab', { name: /automation/i });
    this.tabReports = page.getByRole('tab', { name: /reports/i });
    this.tabBarcode = page.getByRole('tab', { name: /barcode/i });
    this.tabQR = page.getByRole('tab', { name: /qr/i });
    this.tabNotifications = page.getByRole('tab', { name: /notifications/i });
    this.tabSettings = page.getByRole('tab', { name: /settings/i });
  }

  /**
   * Navigate to the page with proper waits
   */
  async goto(waitUntil: 'networkidle' | 'domcontentloaded' = 'networkidle'): Promise<void> {
    await this.page.goto(this.url, { waitUntil });
    await this.waitForPageLoad();
  }

  /**
   * Wait for page to fully load
   */
  async waitForPageLoad(): Promise<void> {
    // Wait for React to hydrate and page to be stable
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(500); // Give React time to render

    // Check for loading indicators and wait for them to disappear
    const loadingIndicators = [
      this.page.locator('[data-testid="loading"]'),
      this.page.locator('.loading'),
      this.page.locator('[aria-busy="true"]')
    ];

    for (const indicator of loadingIndicators) {
      try {
        await indicator.waitFor({ state: 'hidden', timeout: 5000 });
      } catch {
        // Ignore if indicator doesn't exist or doesn't disappear
      }
    }
  }

  /**
   * Wait for and verify the page title
   */
  async expectPageTitle(expectedTitle: string | RegExp): Promise<void> {
    await expect(this.page).toHaveTitle(expectedTitle);
  }

  /**
   * Wait for and verify a specific element is visible
   */
  async expectVisible(locator: Locator, timeout?: number): Promise<void> {
    await expect(locator).toBeVisible({ timeout });
  }

  /**
   * Wait for and verify a specific element is hidden
   */
  async expectHidden(locator: Locator, timeout?: number): Promise<void> {
    await expect(locator).toBeHidden({ timeout });
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      // Check for token in localStorage
      const token = await this.page.evaluate(() => localStorage.getItem('token'));
      return !!token;
    } catch {
      return false;
    }
  }

  /**
   * Logout the current user
   */
  async logout(): Promise<void> {
    await this.userMenu.click();
    await this.logoutButton.waitFor({ state: 'visible' });
    await this.logoutButton.click();

    // Wait for redirect to login page
    await this.page.waitForURL('**/login');
  }

  /**
   * Navigate to a specific dashboard tab
   */
  async navigateToTab(tabName: string): Promise<void> {
    const tab = this.page.getByRole('tab', { name: new RegExp(tabName, 'i') });
    await tab.click();
    await this.waitForPageLoad();
  }

  /**
   * Get the currently active tab
   */
  async getActiveTab(): Promise<string> {
    const activeTab = this.page.locator('[role="tab"][aria-selected="true"]');
    return await activeTab.textContent() || '';
  }

  /**
   * Toggle theme (light/dark)
   */
  async toggleTheme(): Promise<void> {
    await this.themeToggle.click();
    // Wait for theme to change
    await this.page.waitForTimeout(300);
  }

  /**
   * Check if dark theme is active
   */
  async isDarkTheme(): Promise<boolean> {
    return await this.page.locator('html').getAttribute('class').then(cls => cls?.includes('dark') || false);
  }

  /**
   * Search for items using the global search
   */
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.page.keyboard.press('Enter');
    await this.waitForPageLoad();
  }

  /**
   * Wait for a success notification
   */
  async waitForSuccessNotification(): Promise<Locator> {
    const notification = this.page.locator('[data-testid="notification"][data-type="success"]');
    await notification.waitFor({ state: 'visible' });
    return notification;
  }

  /**
   * Wait for an error notification
   */
  async waitForErrorNotification(): Promise<Locator> {
    const notification = this.page.locator('[data-testid="notification"][data-type="error"]');
    await notification.waitFor({ state: 'visible' });
    return notification;
  }

  /**
   * Take a screenshot for debugging
   */
  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `test-results/screenshots/${name}-${Date.now()}.png`, fullPage: true });
  }

  /**
   * Wait for API call to complete
   */
  async waitForApiCall(urlPattern: string): Promise<void> {
    const response = await this.page.waitForResponse(response =>
      response.url().includes(urlPattern)
    );
    return response;
  }

  /**
   * Check if element has correct accessibility attributes
   */
  async checkAccessibility(locator: Locator): Promise<void> {
    await expect(locator).toHaveAttribute('role');
    // Additional accessibility checks can be added here
  }

  /**
   * Simulate keyboard shortcut
   */
  async pressKeyboardShortcut(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.page.keyboard.press(key);
      await this.page.waitForTimeout(100);
    }
  }

  /**
   * Check responsive design at specific viewport
   */
  async checkResponsiveDesign(width: number, height: number): Promise<void> {
    await this.page.setViewportSize({ width, height });
    await this.waitForPageLoad();

    // Verify layout adjusts properly
    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;

    if (isMobile) {
      await expect(this.page.locator('[data-testid="mobile-menu"]')).toBeVisible();
    } else {
      await expect(this.mainNavigation).toBeVisible();
    }
  }
}