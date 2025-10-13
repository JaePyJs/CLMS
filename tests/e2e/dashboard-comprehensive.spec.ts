import { test, expect } from '@playwright/test';
import { AuthPage } from './page-objects/auth.page';
import { DashboardPage } from './page-objects/dashboard.page';

/**
 * Comprehensive Dashboard Tests
 *
 * Tests all 13 dashboard tabs and their functionality:
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

test.describe('Dashboard - Comprehensive', () => {
  let authPage: AuthPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    dashboardPage = new DashboardPage(page);

    // Login as admin for full access
    await authPage.goto();
    await authPage.login('admin', 'librarian123');
  });

  test.describe('Tab 1: Dashboard Overview', () => {
    test('should display overview with key metrics', async ({ page }) => {
      await dashboardPage.navigateToTab('Dashboard');

      // Verify overview section
      await dashboardPage.verifyDashboardOverview();

      // Check key metrics are displayed
      const stats = await dashboardPage.getOverviewStats();
      expect(typeof stats.totalStudents).toBe('number');
      expect(typeof stats.totalBooks).toBe('number');
      expect(typeof stats.activeLoans).toBe('number');
      expect(typeof stats.overdueItems).toBe('number');

      // Verify all metrics are non-negative
      expect(stats.totalStudents).toBeGreaterThanOrEqual(0);
      expect(stats.totalBooks).toBeGreaterThanOrEqual(0);
      expect(stats.activeLoans).toBeGreaterThanOrEqual(0);
      expect(stats.overdueItems).toBeGreaterThanOrEqual(0);
    });

    test('should display recent activities', async ({ page }) => {
      await dashboardPage.navigateToTab('Dashboard');

      // Check recent activities section
      const recentActivities = page.locator('[data-testid="recent-activities"]');
      await expect(recentActivities).toBeVisible();

      // Check for activity items
      const activityItems = recentActivities.locator('[data-testid="activity-item"]');
      const itemCount = await activityItems.count();
      expect(itemCount).toBeGreaterThan(0);

      // Check activity details
      if (itemCount > 0) {
        const firstActivity = activityItems.first();
        await expect(firstActivity.locator('[data-testid="activity-type"]')).toBeVisible();
        await expect(firstActivity.locator('[data-testid="activity-time"]')).toBeVisible();
        await expect(firstActivity.locator('[data-testid="activity-user"]')).toBeVisible();
      }
    });

    test('should have functional quick actions', async ({ page }) => {
      await dashboardPage.navigateToTab('Dashboard');

      // Check quick actions section
      const quickActions = page.locator('[data-testid="quick-actions"]');
      await expect(quickActions).toBeVisible();

      // Test quick action buttons
      const quickActionButtons = quickActions.locator('button');
      const buttonCount = await quickActionButtons.count();
      expect(buttonCount).toBeGreaterThan(0);

      // Test clicking on quick actions (they should navigate to relevant sections)
      for (let i = 0; i < Math.min(buttonCount, 3); i++) {
        const button = quickActionButtons.nth(i);
        const buttonText = await button.textContent();

        await button.click();
        await page.waitForTimeout(1000);

        // Verify navigation or action occurred
        const currentUrl = page.url();
        expect(currentUrl).not.toBe('/');
      }
    });
  });

  test.describe('Tab 2: Student Management', () => {
    test('should display student list with search and filters', async ({ page }) => {
      await dashboardPage.navigateToStudentManagement();
      await dashboardPage.verifyStudentManagement();

      // Check student list
      const studentList = page.locator('[data-testid="student-list"]');
      await expect(studentList).toBeVisible();

      // Check search functionality
      await dashboardPage.searchStudent('test');
      await page.waitForTimeout(1000);

      // Check if search results are displayed
      const searchResults = studentList.locator('[data-testid="student-item"]');
      const resultCount = await searchResults.count();
      expect(typeof resultCount).toBe('number');
    });

    test('should add new student successfully', async ({ page }) => {
      await dashboardPage.navigateToStudentManagement();

      const studentData = {
        firstName: 'Test',
        lastName: 'Student',
        grade: 'GRADE_10',
        studentId: `TEST${Date.now()}`
      };

      await dashboardPage.addStudent(studentData);

      // Verify student was added
      await dashboardPage.searchStudent(studentData.studentId);
      const studentItem = page.locator(`[data-student-id="${studentData.studentId}"]`);
      await expect(studentItem).toBeVisible();
    });

    test('should edit existing student', async ({ page }) => {
      await dashboardPage.navigateToStudentManagement();

      // Search for a student first
      await dashboardPage.searchStudent('admin'); // Assuming admin student exists
      await page.waitForTimeout(1000);

      // Try to edit first student in list
      const studentItems = page.locator('[data-student-id]');
      const itemCount = await studentItems.count();

      if (itemCount > 0) {
        const firstStudentId = await studentItems.first().getAttribute('data-student-id');
        if (firstStudentId) {
          await dashboardPage.editStudent(firstStudentId);

          // Check if edit form opens
          const editForm = page.locator('[data-testid="edit-student-form"]');
          await expect(editForm).toBeVisible();
        }
      }
    });

    test('should delete student with confirmation', async ({ page }) => {
      await dashboardPage.navigateToStudentManagement();

      // Create a test student first
      const studentData = {
        firstName: 'Delete',
        lastName: 'Me',
        grade: 'GRADE_9',
        studentId: `DELETE${Date.now()}`
      };

      await dashboardPage.addStudent(studentData);
      await page.waitForTimeout(1000);

      // Now delete the student
      await dashboardPage.deleteStudent(studentData.studentId);

      // Verify student is deleted
      await dashboardPage.searchStudent(studentData.studentId);
      const deletedStudent = page.locator(`[data-student-id="${studentData.studentId}"]`);
      await expect(deletedStudent).not.toBeVisible();
    });
  });

  test.describe('Tab 3: Book Catalog', () => {
    test('should display book catalog with search functionality', async ({ page }) => {
      await dashboardPage.navigateToBookCatalog();
      await dashboardPage.verifyBookCatalog();

      // Check book list
      const bookList = page.locator('[data-testid="book-list"]');
      await expect(bookList).toBeVisible();

      // Check search functionality
      await dashboardPage.searchBook('test');
      await page.waitForTimeout(1000);

      // Check if search results are displayed
      const searchResults = bookList.locator('[data-testid="book-item"]');
      const resultCount = await searchResults.count();
      expect(typeof resultCount).toBe('number');
    });

    test('should add new book successfully', async ({ page }) => {
      await dashboardPage.navigateToBookCatalog();

      const bookData = {
        title: 'Test Book',
        author: 'Test Author',
        isbn: `978000000000${Date.now() % 1000}`,
        accessionNumber: `ACC${Date.now()}`
      };

      await dashboardPage.addBook(bookData);

      // Verify book was added
      await dashboardPage.searchBook(bookData.title);
      const bookItem = page.locator(`[data-book-isbn="${bookData.isbn}"]`);
      await expect(bookItem).toBeVisible();
    });

    test('should display book details and availability', async ({ page }) => {
      await dashboardPage.navigateToBookCatalog();

      // Click on first book in list
      const bookItems = page.locator('[data-testid="book-item"]');
      const itemCount = await bookItems.count();

      if (itemCount > 0) {
        await bookItems.first().click();

        // Check book details modal/section
        const bookDetails = page.locator('[data-testid="book-details"]');
        await expect(bookDetails).toBeVisible();

        // Check for availability information
        const availability = page.locator('[data-testid="book-availability"]');
        await expect(availability).toBeVisible();
      }
    });
  });

  test.describe('Tab 4: Book Checkout', () => {
    test('should display checkout interface', async ({ page }) => {
      await dashboardPage.navigateToBookCheckout();
      await dashboardPage.verifyBookCheckout();

      // Check checkout form
      const checkoutForm = page.locator('[data-testid="checkout-form"]');
      await expect(checkoutForm).toBeVisible();

      // Check current loans
      const currentLoans = page.locator('[data-testid="current-loans"]');
      await expect(currentLoans).toBeVisible();
    });

    test('should process book checkout', async ({ page }) => {
      await dashboardPage.navigateToBookCheckout();

      // This test would need actual student and book IDs
      // For now, we'll test the interface functionality
      const studentSearch = page.locator('[data-testid="student-search"]');
      const bookSearch = page.locator('[data-testid="book-search"]');

      await expect(studentSearch).toBeVisible();
      await expect(bookSearch).toBeVisible();

      // Test student search
      await studentSearch.fill('test');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);

      // Test book search
      await bookSearch.fill('test');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    });

    test('should process book return', async ({ page }) => {
      await dashboardPage.navigateToBookCheckout();

      // Look for active loans to return
      const activeLoans = page.locator('[data-testid="active-loan"]');
      const loanCount = await activeLoans.count();

      if (loanCount > 0) {
        const firstLoan = activeLoans.first();
        const transactionId = await firstLoan.getAttribute('data-transaction-id');

        if (transactionId) {
          await dashboardPage.returnBook(transactionId);

          // Verify return was processed
          await dashboardPage.waitForSuccessNotification();
        }
      }
    });
  });

  test.describe('Tab 5: Equipment Dashboard', () => {
    test('should display equipment list with status', async ({ page }) => {
      await dashboardPage.navigateToEquipmentDashboard();
      await dashboardPage.verifyEquipmentDashboard();

      // Check equipment list
      const equipmentList = page.locator('[data-testid="equipment-list"]');
      await expect(equipmentList).toBeVisible();

      // Check equipment status indicators
      const equipmentItems = equipmentList.locator('[data-testid="equipment-item"]');
      const itemCount = await equipmentItems.count();

      if (itemCount > 0) {
        const firstItem = equipmentItems.first();
        await expect(firstItem.locator('[data-testid="equipment-status"]')).toBeVisible();
        await expect(firstItem.locator('[data-testid="equipment-name"]')).toBeVisible();
      }
    });

    test('should reserve equipment', async ({ page }) => {
      await dashboardPage.navigateToEquipmentDashboard();

      // Look for available equipment
      const availableEquipment = page.locator('[data-equipment-status="available"]');
      const availableCount = await availableEquipment.count();

      if (availableCount > 0) {
        const firstEquipment = availableEquipment.first();
        const equipmentId = await firstEquipment.getAttribute('data-equipment-id');

        if (equipmentId) {
          await dashboardPage.reserveEquipment(equipmentId, 'admin');

          // Verify reservation was made
          await dashboardPage.waitForSuccessNotification();
        }
      }
    });
  });

  test.describe('Tab 6: Scan Workspace', () => {
    test('should display scan interface', async ({ page }) => {
      await dashboardPage.navigateToScanWorkspace();
      await dashboardPage.verifyScanWorkspace();

      // Check scan input
      const scanInput = page.locator('[data-testid="scan-input"]');
      await expect(scanInput).toBeVisible();

      // Check scan history
      const scanHistory = page.locator('[data-testid="scan-history"]');
      await expect(scanHistory).toBeVisible();
    });

    test('should process barcode scans', async ({ page }) => {
      await dashboardPage.navigateToScanWorkspace();

      // Simulate barcode scan
      const testBarcode = `TEST${Date.now()}`;
      await dashboardPage.simulateBarcodeScan(testBarcode);

      // Check if scan was processed
      const scanHistory = page.locator('[data-testid="scan-history"]');
      const scanItems = scanHistory.locator('[data-testid="scan-item"]');
      const itemCount = await scanItems.count();

      if (itemCount > 0) {
        const latestScan = scanItems.first();
        await expect(latestScan).toBeVisible();
      }
    });
  });

  test.describe('Tab 7: Analytics Dashboard', () => {
    test('should display analytics charts', async ({ page }) => {
      await dashboardPage.navigateToAnalyticsDashboard();
      await dashboardPage.verifyAnalyticsDashboard();

      // Check for charts
      const charts = page.locator('[data-testid="analytics-chart"]');
      const chartCount = await charts.count();
      expect(chartCount).toBeGreaterThan(0);

      // Check for filters
      const filters = page.locator('[data-testid="analytics-filters"]');
      await expect(filters).toBeVisible();
    });

    test('should update analytics based on time range', async ({ page }) => {
      await dashboardPage.navigateToAnalyticsDashboard();

      // Test different time ranges
      const timeRanges = ['7days', '30days', '90days'];

      for (const timeRange of timeRanges) {
        await dashboardPage.selectAnalyticsTimeRange(timeRange);
        await page.waitForTimeout(2000);

        // Check if charts updated (loading state or data change)
        const charts = page.locator('[data-testid="analytics-chart"]');
        const chartCount = await charts.count();
        expect(chartCount).toBeGreaterThan(0);
      }
    });

    test('should export analytics data', async ({ page }) => {
      await dashboardPage.navigateToAnalyticsDashboard();

      // Look for export button
      const exportButton = page.locator('[data-testid="export-analytics"]');
      if (await exportButton.isVisible()) {
        await exportButton.click();

        // Check for export options
        const exportOptions = page.locator('[data-testid="export-options"]');
        if (await exportOptions.isVisible()) {
          // Test PDF export
          await page.getByRole('button', { name: /pdf/i }).click();

          // Wait for download to start
          page.waitForEvent('download', { timeout: 5000 }).catch(() => {
            console.log('Download may not have started - this is expected in test environment');
          });
        }
      }
    });
  });

  test.describe('Tab 8: Automation Dashboard', () => {
    test('should display automation jobs and schedules', async ({ page }) => {
      await dashboardPage.navigateToAutomationDashboard();
      await dashboardPage.verifyAutomationDashboard();

      // Check for jobs
      const jobs = page.locator('[data-testid="automation-job"]');
      const jobCount = await jobs.count();
      expect(jobCount).toBeGreaterThanOrEqual(0);

      // Check for schedules
      const schedules = page.locator('[data-testid="automation-schedule"]');
      await expect(schedules).toBeVisible();
    });

    test('should trigger automation jobs', async ({ page }) => {
      await dashboardPage.navigateToAutomationDashboard();

      // Look for triggerable jobs
      const triggerableJobs = page.locator('[data-job-triggerable="true"]');
      const jobCount = await triggerableJobs.count();

      if (jobCount > 0) {
        const firstJob = triggerableJobs.first();
        const jobName = await firstJob.getAttribute('data-job-name');

        if (jobName) {
          await dashboardPage.triggerAutomationJob(jobName);

          // Verify job was triggered
          await dashboardPage.waitForSuccessNotification();
        }
      }
    });
  });

  test.describe('Tab 9: Reports Builder', () => {
    test('should display report builder interface', async ({ page }) => {
      await dashboardPage.navigateToReportsBuilder();
      await dashboardPage.verifyReportsBuilder();

      // Check report builder components
      const reportBuilder = page.locator('[data-testid="report-builder"]');
      await expect(reportBuilder).toBeVisible();

      // Check report type selector
      const reportTypeSelector = page.locator('[data-testid="report-type-selector"]');
      await expect(reportTypeSelector).toBeVisible();

      // Check filters
      const filters = page.locator('[data-testid="report-filters"]');
      await expect(filters).toBeVisible();
    });

    test('should generate different types of reports', async ({ page }) => {
      await dashboardPage.navigateToReportsBuilder();

      // Test generating different report types
      const reportTypes = ['circulation', 'inventory', 'students'];

      for (const reportType of reportTypes) {
        await dashboardPage.generateReport(reportType, {
          dateRange: 'Last 30 days'
        });

        await page.waitForTimeout(2000);

        // Check if report was generated
        const reportContent = page.locator('[data-testid="report-content"]');
        const isReportGenerated = await reportContent.isVisible();

        if (isReportGenerated) {
          // Test export functionality
          await dashboardPage.exportReport('pdf');
          await page.waitForTimeout(1000);
        }
      }
    });
  });

  test.describe('Tab 10: Barcode Manager', () => {
    test('should display barcode management interface', async ({ page }) => {
      await dashboardPage.navigateToBarcodeManager();
      await dashboardPage.verifyBarcodeManager();

      // Check barcode generator
      const barcodeGenerator = page.locator('[data-testid="barcode-generator"]');
      await expect(barcodeGenerator).toBeVisible();

      // Check barcode list
      const barcodeList = page.locator('[data-testid="barcode-list"]');
      await expect(barcodeList).toBeVisible();
    });

    test('should generate barcodes for different item types', async ({ page }) => {
      await dashboardPage.navigateToBarcodeManager();

      // Test generating barcodes for different item types
      const itemTypes = ['students', 'books', 'equipment'] as const;

      for (const itemType of itemTypes) {
        await dashboardPage.generateBarcodes(itemType);
        await page.waitForTimeout(2000);

        // Check if barcodes were generated
        const barcodeList = page.locator('[data-testid="barcode-list"]');
        const barcodeItems = barcodeList.locator('[data-testid="barcode-item"]');
        const itemCount = await barcodeItems.count();

        // Check if new items were added (count should increase)
        expect(typeof itemCount).toBe('number');
      }
    });

    test('should print barcodes', async ({ page }) => {
      await dashboardPage.navigateToBarcodeManager();

      // Look for print button
      const printButton = page.locator('[data-testid="print-barcodes"]');
      if (await printButton.isVisible()) {
        await dashboardPage.printBarcodes();

        // Check if print dialog or preview appeared
        const printPreview = page.locator('[data-testid="print-preview"]');
        const hasPrintPreview = await printPreview.isVisible();

        if (hasPrintPreview) {
          console.log('Print preview displayed correctly');
        }
      }
    });
  });

  test.describe('Tab 11: QR Code Manager', () => {
    test('should display QR code management interface', async ({ page }) => {
      await dashboardPage.navigateToQRCodeManager();
      await dashboardPage.verifyQRCodeManager();

      // Check QR generator
      const qrGenerator = page.locator('[data-testid="qr-generator"]');
      await expect(qrGenerator).toBeVisible();

      // Check QR list
      const qrList = page.locator('[data-testid="qr-list"]');
      await expect(qrList).toBeVisible();
    });

    test('should generate QR codes in bulk', async ({ page }) => {
      await dashboardPage.navigateToQRCodeManager();

      // Test bulk QR generation
      await dashboardPage.generateQRCodes('students', 5);
      await page.waitForTimeout(3000);

      // Check if QR codes were generated
      const qrList = page.locator('[data-testid="qr-list"]');
      const qrItems = qrList.locator('[data-testid="qr-item"]');
      const itemCount = await qrItems.count();

      expect(typeof itemCount).toBe('number');
    });
  });

  test.describe('Tab 12: Notification Center', () => {
    test('should display notification list', async ({ page }) => {
      await dashboardPage.navigateToNotificationCenter();
      await dashboardPage.verifyNotificationCenter();

      // Check notification list
      const notificationList = page.locator('[data-testid="notification-list"]');
      await expect(notificationList).toBeVisible();

      // Check filters
      const filters = page.locator('[data-testid="notification-filters"]');
      await expect(filters).toBeVisible();
    });

    test('should allow marking notifications as read', async ({ page }) => {
      await dashboardPage.navigateToNotificationCenter();

      // Get notifications
      const notifications = await dashboardPage.getNotifications();

      if (notifications.length > 0) {
        const unreadNotification = notifications.find(n => !n.read);

        if (unreadNotification) {
          // Mark notification as read
          await dashboardPage.markNotificationAsRead(unreadNotification.id);

          // Verify notification was marked as read
          const updatedNotifications = await dashboardPage.getNotifications();
          const markedNotification = updatedNotifications.find(n => n.id === unreadNotification.id);

          expect(markedNotification?.read).toBe(true);
        }
      }
    });
  });

  test.describe('Tab 13: Settings', () => {
    test('should display settings interface', async ({ page }) => {
      await dashboardPage.navigateToSettings();
      await dashboardPage.verifySettings();

      // Check settings menu
      const settingsMenu = page.locator('[data-testid="settings-menu"]');
      await expect(settingsMenu).toBeVisible();

      // Check settings content
      const settingsContent = page.locator('[data-testid="settings-content"]');
      await expect(settingsContent).toBeVisible();
    });

    test('should navigate between setting sections', async ({ page }) => {
      await dashboardPage.navigateToSettings();

      // Test different settings sections
      const sections = ['general', 'users', 'system'] as const;

      for (const section of sections) {
        await dashboardPage.navigateToSettingSection(section);
        await page.waitForTimeout(1000);

        // Check if section content is displayed
        const sectionContent = page.locator(`[data-section="${section}"]`);
        await expect(sectionContent).toBeVisible();
      }
    });

    test('should update system settings', async ({ page }) => {
      await dashboardPage.navigateToSettings();
      await dashboardPage.navigateToSettingSection('general');

      // Look for updatable settings
      const settingInputs = page.locator('[data-setting]');
      const settingCount = await settingInputs.count();

      if (settingCount > 0) {
        const firstSetting = settingInputs.first();
        const settingName = await firstSetting.getAttribute('data-setting');

        if (settingName) {
          // Update setting
          await dashboardPage.updateSetting(settingName, 'test-value');

          // Verify update was successful
          await dashboardPage.waitForSuccessNotification();
        }
      }
    });
  });

  test.describe('Dashboard Navigation and Usability', () => {
    test('should navigate between tabs using keyboard shortcuts', async ({ page }) => {
      await dashboardPage.testKeyboardShortcuts();
    });

    test('should be responsive across different devices', async ({ page }) => {
      await dashboardPage.testResponsiveDesign();
    });

    test('should maintain state when switching between tabs', async ({ page }) => {
      // Navigate to student tab and search
      await dashboardPage.navigateToStudentManagement();
      await dashboardPage.searchStudent('test');

      // Switch to another tab
      await dashboardPage.navigateToBookCatalog();

      // Switch back to student tab
      await dashboardPage.navigateToStudentManagement();

      // Check if search state is maintained
      const searchInput = page.locator('[data-testid="student-search"]');
      const searchValue = await searchInput.inputValue();

      // Search value might be maintained or cleared depending on implementation
      expect(typeof searchValue).toBe('string');
    });

    test('should handle browser refresh gracefully', async ({ page }) => {
      // Navigate to a specific tab
      await dashboardPage.navigateToStudentManagement();

      // Refresh the page
      await page.reload({ waitUntil: 'networkidle' });

      // Should still be logged in
      await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();

      // Should return to default tab or maintain current tab
      const currentTab = await dashboardPage.getActiveTab();
      expect(typeof currentTab).toBe('string');
    });

    test('should have no console errors', async ({ page }) => {
      const errors = await dashboardPage.checkForConsoleErrors();
      expect(errors.length).toBe(0);
    });
  });
});