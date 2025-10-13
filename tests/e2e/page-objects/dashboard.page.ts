import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Dashboard Page Object Model
 *
 * Covers all 13 dashboard tabs and their functionality:
 * 1. Dashboard Overview
 * 2. Student Management
 * 3. Book Catalog
 * 4. Book Checkout
 * 5. Equipment Dashboard
 * 6. Scan Workspace
 * 7. Analytics Dashboard
 * 8. Automation Dashboard
 * 9. Reports Builder
 * 10. Barcode Manager
 * 11. QR Code Manager
 * 12. Notification Center
 * 13. Settings
 */
export class DashboardPage extends BasePage {
  constructor(page: Page) {
    super(page, '/');
  }

  // ========== Tab Navigation ==========

  /**
   * Navigate to a specific tab by name or index
   */
  async navigateToTab(tabIdentifier: string | number): Promise<void> {
    if (typeof tabIdentifier === 'number') {
      // Use keyboard shortcut (Alt + number)
      await this.page.keyboard.press(`Alt+${tabIdentifier}`);
    } else {
      // Click on tab by name
      const tab = this.page.getByRole('tab', { name: new RegExp(tabIdentifier, 'i') });
      await tab.click();
    }
    await this.waitForPageLoad();
  }

  /**
   * Get all available tabs
   */
  async getAvailableTabs(): Promise<string[]> {
    const tabs = this.page.locator('[role="tab"]');
    const count = await tabs.count();
    const tabNames: string[] = [];

    for (let i = 0; i < count; i++) {
      const tabName = await tabs.nth(i).textContent();
      if (tabName) tabNames.push(tabName.trim());
    }

    return tabNames;
  }

  /**
   * Get the currently active tab
   */
  async getActiveTab(): Promise<string> {
    const activeTab = this.page.locator('[role="tab"][aria-selected="true"]');
    return await activeTab.textContent() || '';
  }

  // ========== Tab 1: Dashboard Overview ==========

  async verifyDashboardOverview(): Promise<void> {
    // Check for overview statistics
    await expect(this.page.locator('[data-testid="overview-stats"]')).toBeVisible();

    // Check for recent activities
    await expect(this.page.locator('[data-testid="recent-activities"]')).toBeVisible();

    // Check for quick actions
    await expect(this.page.locator('[data-testid="quick-actions"]')).toBeVisible();
  }

  async getOverviewStats(): Promise<{
    totalStudents: number;
    totalBooks: number;
    activeLoans: number;
    overdueItems: number;
  }> {
    const stats = {
      totalStudents: await this.getStatValue('total-students'),
      totalBooks: await this.getStatValue('total-books'),
      activeLoans: await this.getStatValue('active-loans'),
      overdueItems: await this.getStatValue('overdue-items')
    };

    return stats;
  }

  private async getStatValue(dataTestId: string): Promise<number> {
    const element = this.page.locator(`[data-testid="${dataTestId}"]`);
    const text = await element.textContent();
    return parseInt(text?.replace(/[^0-9]/g, '') || '0');
  }

  // ========== Tab 2: Student Management ==========

  async navigateToStudentManagement(): Promise<void> {
    await this.navigateToTab('students');
  }

  async verifyStudentManagement(): Promise<void> {
    await expect(this.page.locator('[data-testid="student-list"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="add-student-button"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="student-search"]')).toBeVisible();
  }

  async addStudent(studentData: {
    firstName: string;
    lastName: string;
    grade: string;
    studentId: string;
  }): Promise<void> {
    await this.page.getByTestId('add-student-button').click();

    // Fill student form
    await this.page.getByLabel(/first name/i).fill(studentData.firstName);
    await this.page.getByLabel(/last name/i).fill(studentData.lastName);
    await this.page.getByLabel(/grade/i).selectOption(studentData.grade);
    await this.page.getByLabel(/student id/i).fill(studentData.studentId);

    // Submit form
    await this.page.getByRole('button', { name: /save|create/i }).click();

    // Wait for success
    await this.waitForSuccessNotification();
  }

  async searchStudent(query: string): Promise<void> {
    await this.page.getByTestId('student-search').fill(query);
    await this.page.keyboard.press('Enter');
    await this.waitForPageLoad();
  }

  async editStudent(studentId: string): Promise<void> {
    const studentRow = this.page.locator(`[data-student-id="${studentId}"]`);
    await studentRow.getByRole('button', { name: /edit/i }).click();
  }

  async deleteStudent(studentId: string): Promise<void> {
    const studentRow = this.page.locator(`[data-student-id="${studentId}"]`);
    await studentRow.getByRole('button', { name: /delete/i }).click();

    // Confirm deletion
    await this.page.getByRole('button', { name: /confirm|delete/i }).click();
    await this.waitForSuccessNotification();
  }

  // ========== Tab 3: Book Catalog ==========

  async navigateToBookCatalog(): Promise<void> {
    await this.navigateToTab('books');
  }

  async verifyBookCatalog(): Promise<void> {
    await expect(this.page.locator('[data-testid="book-list"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="book-search"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="add-book-button"]')).toBeVisible();
  }

  async searchBook(query: string): Promise<void> {
    await this.page.getByTestId('book-search').fill(query);
    await this.page.keyboard.press('Enter');
    await this.waitForPageLoad();
  }

  async addBook(bookData: {
    title: string;
    author: string;
    isbn: string;
    accessionNumber: string;
  }): Promise<void> {
    await this.page.getByTestId('add-book-button').click();

    // Fill book form
    await this.page.getByLabel(/title/i).fill(bookData.title);
    await this.page.getByLabel(/author/i).fill(bookData.author);
    await this.page.getByLabel(/isbn/i).fill(bookData.isbn);
    await this.page.getByLabel(/accession number/i).fill(bookData.accessionNumber);

    // Submit form
    await this.page.getByRole('button', { name: /save|create/i }).click();
    await this.waitForSuccessNotification();
  }

  // ========== Tab 4: Book Checkout ==========

  async navigateToBookCheckout(): Promise<void> {
    await this.navigateToTab('checkout');
  }

  async verifyBookCheckout(): Promise<void> {
    await expect(this.page.locator('[data-testid="checkout-form"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="student-search"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="book-search"]')).toBeVisible();
  }

  async checkoutBook(studentId: string, bookId: string): Promise<void> {
    // Search and select student
    await this.page.getByTestId('student-search').fill(studentId);
    await this.page.keyboard.press('Enter');

    // Search and select book
    await this.page.getByTestId('book-search').fill(bookId);
    await this.page.keyboard.press('Enter');

    // Process checkout
    await this.page.getByRole('button', { name: /checkout|borrow/i }).click();
    await this.waitForSuccessNotification();
  }

  async returnBook(transactionId: string): Promise<void> {
    const transactionRow = this.page.locator(`[data-transaction-id="${transactionId}"]`);
    await transactionRow.getByRole('button', { name: /return/i }).click();
    await this.waitForSuccessNotification();
  }

  // ========== Tab 5: Equipment Dashboard ==========

  async navigateToEquipmentDashboard(): Promise<void> {
    await this.navigateToTab('equipment');
  }

  async verifyEquipmentDashboard(): Promise<void> {
    await expect(this.page.locator('[data-testid="equipment-list"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="equipment-status"]')).toBeVisible();
  }

  async reserveEquipment(equipmentId: string, userId: string): Promise<void> {
    const equipmentRow = this.page.locator(`[data-equipment-id="${equipmentId}"]`);
    await equipmentRow.getByRole('button', { name: /reserve/i }).click();

    // Select user
    await this.page.getByLabel(/user/i).fill(userId);
    await this.page.keyboard.press('Enter');

    // Confirm reservation
    await this.page.getByRole('button', { name: /confirm/i }).click();
    await this.waitForSuccessNotification();
  }

  // ========== Tab 6: Scan Workspace ==========

  async navigateToScanWorkspace(): Promise<void> {
    await this.navigateToTab('scan');
  }

  async verifyScanWorkspace(): Promise<void> {
    await expect(this.page.locator('[data-testid="scan-input"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="scan-history"]')).toBeVisible();
  }

  async simulateBarcodeScan(barcode: string): Promise<void> {
    await this.page.getByTestId('scan-input').fill(barcode);
    await this.page.keyboard.press('Enter');
    await this.waitForPageLoad();
  }

  // ========== Tab 7: Analytics Dashboard ==========

  async navigateToAnalyticsDashboard(): Promise<void> {
    await this.navigateToTab('analytics');
  }

  async verifyAnalyticsDashboard(): Promise<void> {
    await expect(this.page.locator('[data-testid="analytics-charts"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="analytics-filters"]')).toBeVisible();
  }

  async selectAnalyticsTimeRange(timeRange: string): Promise<void> {
    await this.page.getByLabel(/time range/i).selectOption(timeRange);
    await this.waitForPageLoad();
  }

  async getAnalyticsData(): Promise<any> {
    // Return analytics data from charts
    return await this.page.evaluate(() => {
      // Extract data from charts or API responses
      return {};
    });
  }

  // ========== Tab 8: Automation Dashboard ==========

  async navigateToAutomationDashboard(): Promise<void> {
    await this.navigateToTab('automation');
  }

  async verifyAutomationDashboard(): Promise<void> {
    await expect(this.page.locator('[data-testid="automation-jobs"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="automation-schedules"]')).toBeVisible();
  }

  async triggerAutomationJob(jobName: string): Promise<void> {
    const jobRow = this.page.locator(`[data-job-name="${jobName}"]`);
    await jobRow.getByRole('button', { name: /run|trigger/i }).click();
    await this.waitForSuccessNotification();
  }

  // ========== Tab 9: Reports Builder ==========

  async navigateToReportsBuilder(): Promise<void> {
    await this.navigateToTab('reports');
  }

  async verifyReportsBuilder(): Promise<void> {
    await expect(this.page.locator('[data-testid="report-builder"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="report-filters"]')).toBeVisible();
  }

  async generateReport(reportType: string, filters: any): Promise<void> {
    await this.page.getByLabel(/report type/i).selectOption(reportType);

    // Apply filters
    if (filters.dateRange) {
      await this.page.getByLabel(/date range/i).fill(filters.dateRange);
    }

    // Generate report
    await this.page.getByRole('button', { name: /generate|create/i }).click();
    await this.waitForPageLoad();
  }

  async exportReport(format: 'pdf' | 'excel' | 'csv'): Promise<void> {
    await this.page.getByRole('button', { name: new RegExp(format, 'i') }).click();
    // Wait for download to start
    await this.page.waitForEvent('download');
  }

  // ========== Tab 10: Barcode Manager ==========

  async navigateToBarcodeManager(): Promise<void> {
    await this.navigateToTab('barcode');
  }

  async verifyBarcodeManager(): Promise<void> {
    await expect(this.page.locator('[data-testid="barcode-generator"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="barcode-list"]')).toBeVisible();
  }

  async generateBarcodes(itemType: 'students' | 'books' | 'equipment'): Promise<void> {
    await this.page.getByLabel(/item type/i).selectOption(itemType);
    await this.page.getByRole('button', { name: /generate/i }).click();
    await this.waitForPageLoad();
  }

  async printBarcodes(): Promise<void> {
    await this.page.getByRole('button', { name: /print/i }).click();
    // Wait for print dialog or preview
    await this.page.waitForTimeout(1000);
  }

  // ========== Tab 11: QR Code Manager ==========

  async navigateToQRCodeManager(): Promise<void> {
    await this.navigateToTab('qr');
  }

  async verifyQRCodeManager(): Promise<void> {
    await expect(this.page.locator('[data-testid="qr-generator"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="qr-list"]')).toBeVisible();
  }

  async generateQRCodes(itemType: string, quantity: number): Promise<void> {
    await this.page.getByLabel(/item type/i).selectOption(itemType);
    await this.page.getByLabel(/quantity/i).fill(quantity.toString());
    await this.page.getByRole('button', { name: /generate/i }).click();
    await this.waitForPageLoad();
  }

  // ========== Tab 12: Notification Center ==========

  async navigateToNotificationCenter(): Promise<void> {
    await this.navigateToTab('notifications');
  }

  async verifyNotificationCenter(): Promise<void> {
    await expect(this.page.locator('[data-testid="notification-list"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="notification-filters"]')).toBeVisible();
  }

  async getNotifications(): Promise<any[]> {
    return await this.page.evaluate(() => {
      const notifications = document.querySelectorAll('[data-testid="notification-item"]');
      return Array.from(notifications).map(notification => ({
        id: notification.getAttribute('data-notification-id'),
        type: notification.getAttribute('data-type'),
        message: notification.textContent,
        read: notification.getAttribute('data-read') === 'true'
      }));
    });
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    const notification = this.page.locator(`[data-notification-id="${notificationId}"]`);
    await notification.click();
    await this.page.waitForTimeout(500);
  }

  // ========== Tab 13: Settings ==========

  async navigateToSettings(): Promise<void> {
    await this.navigateToTab('settings');
  }

  async verifySettings(): Promise<void> {
    await expect(this.page.locator('[data-testid="settings-menu"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="settings-content"]')).toBeVisible();
  }

  async navigateToSettingSection(section: 'general' | 'users' | 'system' | 'integrations'): Promise<void> {
    await this.page.getByRole('link', { name: new RegExp(section, 'i') }).click();
    await this.waitForPageLoad();
  }

  async updateSetting(settingName: string, value: string): Promise<void> {
    const settingInput = this.page.locator(`[data-setting="${settingName}"]`);
    await settingInput.fill(value);
    await this.page.getByRole('button', { name: /save/i }).click();
    await this.waitForSuccessNotification();
  }

  // ========== Utility Methods ==========

  /**
   * Test keyboard shortcuts for tab navigation
   */
  async testKeyboardShortcuts(): Promise<void> {
    const shortcuts = [
      { key: 'Alt+1', expectedTab: 'Dashboard' },
      { key: 'Alt+2', expectedTab: 'Students' },
      { key: 'Alt+3', expectedTab: 'Books' },
      // Add more shortcuts as needed
    ];

    for (const shortcut of shortcuts) {
      await this.page.keyboard.press(shortcut.key);
      await this.waitForPageLoad();

      const activeTab = await this.getActiveTab();
      expect(activeTab).toContain(shortcut.expectedTab);
    }
  }

  /**
   * Test responsive design across different viewports
   */
  async testResponsiveDesign(): Promise<void> {
    const viewports = [
      { width: 1920, height: 1080, name: 'Desktop' },
      { width: 1024, height: 768, name: 'Tablet' },
      { width: 375, height: 667, name: 'Mobile' }
    ];

    for (const viewport of viewports) {
      await this.page.setViewportSize(viewport);
      await this.waitForPageLoad();

      // Verify layout adapts properly
      if (viewport.width < 768) {
        await expect(this.page.locator('[data-testid="mobile-menu"]')).toBeVisible();
      } else {
        await expect(this.mainNavigation).toBeVisible();
      }

      console.log(`✅ Responsive design verified for ${viewport.name} (${viewport.width}x${viewport.height})`);
    }
  }

  /**
   * Take screenshot of current tab
   */
  async takeTabScreenshot(tabName: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await this.page.screenshot({
      path: `test-results/screenshots/${tabName}-${timestamp}.png`,
      fullPage: true
    });
  }

  /**
   * Check for any console errors
   */
  async checkForConsoleErrors(): Promise<string[]> {
    const errors: string[] = [];

    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    return errors;
  }
}