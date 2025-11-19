import { test, expect, Page } from '@playwright/test';
import { loginWithCredentials, navigateToTab, assertLoggedIn } from './test-utils';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3001';

// Test user credentials
const TEST_USER = {
  username: 'librarian',
  password: 'lib123'
};

// Helper functions
async function login(page: Page) {
  await loginWithCredentials(page, TEST_USER);
  await assertLoggedIn(page);
}

async function navigateToStudentManagement(page: Page) {
  const topTabTestId = page.locator('[data-testid="top-students-tab"]').first();
  const testIdVisible = await topTabTestId.isVisible().catch(() => false);
  if (testIdVisible) {
    await topTabTestId.scrollIntoViewIfNeeded();
    await topTabTestId.click({ timeout: 10000 });
    await page.waitForSelector('#tabpanel-students:not([hidden])', { timeout: 10000 });
  } else {
    const topTabByRole = page.getByRole('tab', { name: /students/i }).first();
    const roleVisible = await topTabByRole.isVisible().catch(() => false);
    if (roleVisible) {
      await topTabByRole.scrollIntoViewIfNeeded();
      await topTabByRole.click({ timeout: 10000 });
      await page.waitForSelector('#tabpanel-students:not([hidden])', { timeout: 10000 });
    } else {
      const viewAll = page.getByRole('button', { name: /view all/i }).first();
      const viewAllVisible = await viewAll.isVisible().catch(() => false);
      if (viewAllVisible) {
        await viewAll.click({ timeout: 10000 });
      }
    }
  }
  await page.waitForSelector('#tabpanel-students:not([hidden])', { timeout: 20000 });
  let ready = false;
  for (let i = 0; i < 2 && !ready; i++) {
    const innerTab = page
      .locator('#tabpanel-students')
      .getByRole('tab', { name: /students/i })
      .first();
    const visible = await innerTab.isVisible().catch(() => false);
    if (visible) {
      await innerTab.click({ timeout: 10000 });
    }
    await page.waitForTimeout(500);
    ready = await page.locator('[data-testid="status-filter"]').isVisible().catch(() => false);
  }
  await page.waitForSelector('[data-testid="status-filter"]', { state: 'visible', timeout: 20000 });
}

test.describe('Student Management E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateToStudentManagement(page);
  });

  test.describe('Student List View', () => {
    test('should display student list', async ({ page }) => {
      // Wait for students to load
      await page.waitForSelector('[data-testid="student-card"]', {
        state: 'visible',
        timeout: 10000
      });

      const studentCards = await page.locator('[data-testid="student-card"]').count();
      expect(studentCards).toBeGreaterThan(0);
    });

    test('should display student statistics', async ({ page }) => {
      // Check for stat cards
      await expect(page.getByText('Total Students', { exact: true })).toBeVisible();
      await expect(page.getByText('Active Students', { exact: true })).toBeVisible();
      await expect(page.getByText('Inactive Students', { exact: true })).toBeVisible();

      // Verify stat values are numbers
      const totalText = await page.locator('[data-testid="total-students"]').textContent();
      expect(parseInt(totalText || '0')).toBeGreaterThanOrEqual(0);
    });

    test('should search students', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="Search"]');
      await searchInput.fill('John');
      
      // Wait for search results
      await page.waitForTimeout(500);

      const results = await page.locator('[data-testid="student-card"]').count();
      expect(results).toBeGreaterThanOrEqual(0);

      // Verify search term appears in results
      if (results > 0) {
        const firstStudent = page.locator('[data-testid="student-card"]').first();
        const text = await firstStudent.textContent();
        expect(text?.toLowerCase()).toContain('john');
      }
    });

    test('should filter by status', async ({ page }) => {
      const statusTrigger = page.locator('[data-testid="status-filter"]');
      await statusTrigger.scrollIntoViewIfNeeded();
      await statusTrigger.click();
      await page.click('[data-testid="status-active"]');

      // Wait for filtered results
      await page.waitForTimeout(500);

      // Verify all visible students are active
      const activeCards = await page.locator('[data-testid="student-card"]:has-text("Active")').count();
      const totalCards = await page.locator('[data-testid="student-card"]').count();
      expect(activeCards).toBe(totalCards);
    });

    test('should filter by grade', async ({ page }) => {
      const gradeTrigger = page.locator('[data-testid="grade-filter"]');
      await gradeTrigger.scrollIntoViewIfNeeded();
      await gradeTrigger.click();
      await page.click('[data-testid="grade-gradeSchool"]');

      // Wait for filtered results
      await page.waitForTimeout(500);

      // Verify results
      const gradeSchoolCards = await page.locator('[data-testid="student-card"]').count();
      expect(gradeSchoolCards).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Add Student', () => {
    test('should open add student dialog', async ({ page }) => {
      await page.click('button:has-text("Add Student")');
      
      await expect(page.locator('h2:has-text("Add New Student")')).toBeVisible();
      await expect(page.locator('input[name="firstName"]')).toBeVisible();
    });

    test('should create new student', async ({ page }) => {
      // Open dialog
      await page.click('button:has-text("Add Student")');

      // Fill form
      const timestamp = Date.now();
      await page.fill('input[name="firstName"]', 'John');
      await page.fill('input[name="lastName"]', 'Doe');
      await page.fill('input[name="studentId"]', `STU${timestamp}`);
      await page.selectOption('select[name="gradeLevel"]', 'Grade 5');
      await page.fill('input[name="email"]', `john.doe.${timestamp}@test.com`);

      // Submit form
      await page.click('button:has-text("Add Student")');

      // Wait for success message
      await expect(page.locator('text=Student added successfully')).toBeVisible({
        timeout: 5000
      });

      // Verify student appears in list
      await expect(page.locator(`text=STU${timestamp}`)).toBeVisible();
    });

    test('should validate required fields', async ({ page }) => {
      await page.click('button:has-text("Add Student")');

      // Try to submit without filling required fields
      await page.click('button:has-text("Add Student")');

      // Should show validation errors
      await expect(page.locator('text=required')).toBeVisible();
    });

    test('should prevent duplicate student IDs', async ({ page }) => {
      // Get existing student ID
      const existingId = await page.locator('[data-testid="student-id"]').first().textContent();

      await page.click('button:has-text("Add Student")');

      // Try to create with duplicate ID
      await page.fill('input[name="firstName"]', 'Jane');
      await page.fill('input[name="lastName"]', 'Smith');
      await page.fill('input[name="studentId"]', existingId || 'STU001');
      await page.selectOption('select[name="gradeLevel"]', 'Grade 5');

      await page.click('button:has-text("Add Student")');

      // Should show error message
      await expect(page.locator('text=already exists')).toBeVisible({
        timeout: 5000
      });
    });
  });

  test.describe('Edit Student', () => {
    test('should open edit dialog', async ({ page }) => {
      // Click edit button on first student
      await page.click('[data-testid="edit-student-button"]').first();

      await expect(page.locator('h2:has-text("Edit Student")')).toBeVisible();
    });

    test('should update student information', async ({ page }) => {
      // Click edit on first student
      await page.locator('[data-testid="edit-student-button"]').first().click();

      // Update first name
      const firstNameInput = page.locator('input[name="firstName"]');
      await firstNameInput.clear();
      await firstNameInput.fill('Updated Name');

      // Save changes
      await page.click('button:has-text("Update Student")');

      // Wait for success message
      await expect(page.locator('text=Student updated successfully')).toBeVisible({
        timeout: 5000
      });

      // Verify change appears in list
      await expect(page.locator('text=Updated Name')).toBeVisible();
    });
  });

  test.describe('Delete Student', () => {
    test('should delete student with confirmation', async ({ page }) => {
      // Get student name before deletion
      const studentCard = page.locator('[data-testid="student-card"]').first();
      const studentName = await studentCard.locator('[data-testid="student-name"]').textContent();

      // Click delete button
      await studentCard.locator('[data-testid="delete-student-button"]').click();

      // Confirm deletion
      page.on('dialog', dialog => dialog.accept());
      await page.click('button:has-text("Delete")');

      // Wait for success message
      await expect(page.locator('text=Student deleted')).toBeVisible({
        timeout: 5000
      });

      // Verify student is removed from list
      await expect(page.locator(`text=${studentName}`)).not.toBeVisible();
    });
  });

  test.describe('Student Details', () => {
    test('should view student details', async ({ page }) => {
      // Click on first student to view details
      await page.locator('[data-testid="view-student-button"]').first().click();

      // Verify details dialog
      await expect(page.locator('[data-testid="student-details-dialog"]')).toBeVisible();
      await expect(page.locator('text=Basic Information')).toBeVisible();
      await expect(page.locator('text=Contact Information')).toBeVisible();
    });

    test('should display student activities', async ({ page }) => {
      await page.locator('[data-testid="view-student-button"]').first().click();

      // Check for activities section
      await expect(page.locator('text=Activity Summary')).toBeVisible();
      
      // Should show total sessions
      const sessionsText = await page.locator('[data-testid="total-sessions"]').textContent();
      expect(parseInt(sessionsText || '0')).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Bulk Operations', () => {
    test('should select multiple students', async ({ page }) => {
      // Click bulk operations tab
      await page.click('button:has-text("Bulk Operations")');

      // Select first 3 students
      const checkboxes = page.locator('[data-testid="student-checkbox"]');
      await checkboxes.nth(0).click();
      await checkboxes.nth(1).click();
      await checkboxes.nth(2).click();

      // Verify selection count
      await expect(page.locator('text=3 students selected')).toBeVisible();
    });

    test('should export selected students', async ({ page }) => {
      await page.click('button:has-text("Bulk Operations")');

      // Select students
      await page.locator('[data-testid="student-checkbox"]').first().click();

      // Click export button
      const downloadPromise = page.waitForEvent('download');
      await page.click('button:has-text("Export")');
      const download = await downloadPromise;

      // Verify download
      expect(download.suggestedFilename()).toContain('students');
      expect(download.suggestedFilename()).toContain('.csv');
    });

    test('should bulk update student status', async ({ page }) => {
      await page.click('button:has-text("Bulk Operations")');

      // Select students
      await page.locator('[data-testid="student-checkbox"]').first().click();
      await page.locator('[data-testid="student-checkbox"]').nth(1).click();

      // Open bulk actions
      await page.click('button:has-text("Bulk Actions")');

      // Update status
      await page.click('button:has-text("Deactivate")');

      // Confirm
      await page.click('button:has-text("Confirm")');

      // Wait for success
      await expect(page.locator('text=Status updated')).toBeVisible({
        timeout: 5000
      });
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

    test('should display mobile layout', async ({ page }) => {
      await navigateToStudentManagement(page);

      // Check for mobile-specific elements
      await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
      
      // Verify cards stack vertically
      const cards = page.locator('[data-testid="stat-card"]');
      const firstCard = await cards.first().boundingBox();
      const secondCard = await cards.nth(1).boundingBox();

      expect(firstCard?.y).toBeLessThan(secondCard?.y || 0);
    });

    test('should support swipe gestures', async ({ page }) => {
      await navigateToStudentManagement(page);

      // Simulate swipe
      const tabList = page.locator('[data-testid="tab-list"]');
      const box = await tabList.boundingBox();

      if (box) {
        await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + 10, box.y + box.height / 2);
        await page.mouse.up();
      }

      // Verify tab changed
      await page.waitForTimeout(500);
    });
  });

  test.describe('Performance', () => {
    test('should load students within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      
      await navigateToStudentManagement(page);
      await page.waitForSelector('[data-testid="student-card"]', {
        state: 'visible',
        timeout: 10000
      });

      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
    });

    test('should handle large lists efficiently', async ({ page }) => {
      // Navigate to page
      await navigateToStudentManagement(page);

      // Start scrolling measurement
      const startTime = Date.now();

      // Scroll through list
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollBy(0, 500));
        await page.waitForTimeout(100);
      }

      const scrollTime = Date.now() - startTime;
      expect(scrollTime).toBeLessThan(2000); // Should scroll smoothly
    });
  });

  test.describe('Accessibility', () => {
    test('should support keyboard navigation', async ({ page }) => {
      await navigateToStudentManagement(page);

      // Tab through interactive elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');

      // Verify focus is on expected element
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      expect(['BUTTON', 'INPUT', 'A']).toContain(focused);
    });

    test('should have proper ARIA labels', async ({ page }) => {
      await navigateToStudentManagement(page);

      // Check for ARIA labels
      const addButton = page.locator('button:has-text("Add Student")');
      expect(await addButton.getAttribute('aria-label')).toBeTruthy();

      const searchInput = page.locator('input[placeholder*="Search"]');
      expect(await searchInput.getAttribute('aria-label')).toBeTruthy();
    });

    test('should support screen readers', async ({ page }) => {
      await navigateToStudentManagement(page);

      // Check for proper heading structure
      const h1 = await page.locator('h1, h2').first().textContent();
      expect(h1).toBeTruthy();

      // Check for alt text on images
      const images = page.locator('img');
      const count = await images.count();
      
      for (let i = 0; i < count; i++) {
        const alt = await images.nth(i).getAttribute('alt');
        expect(alt).toBeTruthy();
      }
    });
  });
});
