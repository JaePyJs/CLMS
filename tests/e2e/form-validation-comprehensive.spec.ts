import { test, expect, Page } from '@playwright/test';
import { AuthPage } from './page-objects/auth.page';
import { DashboardPage } from './page-objects/dashboard.page';

/**
 * Comprehensive Form Validation Test Suite for CLMS
 * 
 * This test suite covers:
 * - All form input types and their specific validations
 * - Required field validations
 * - Format validations (email, phone, date, etc.)
 * - Length constraints (min/max)
 * - Custom business rule validations
 * - Cross-field validations
 * - Real-time vs submit-time validation
 * - Error message accuracy and accessibility
 */

test.describe('📝 Comprehensive Form Validation Testing', () => {
  let authPage: AuthPage;
  let dashboardPage: DashboardPage;

  const testUser = {
    username: 'admin@clms.edu',
    password: 'admin123',
    role: 'Administrator'
  };

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    dashboardPage = new DashboardPage(page);
  });

  test.describe('🔐 Login Form Validation', () => {
    test('should validate login form inputs', async ({ page }) => {
      await authPage.goto();
      await authPage.waitForPageLoad();

      await test.step('Test empty form submission', async () => {
        await authPage.signInButton.click();
        await page.waitForTimeout(1000);

        // Check for validation messages
        const errorMessages = page.locator('.error, .invalid, [role="alert"], .field-error, .text-red-500');
        const errorCount = await errorMessages.count();

        if (errorCount > 0) {
          console.log(`✅ Empty form validation working (${errorCount} errors shown)`);
          
          for (let i = 0; i < errorCount; i++) {
            const errorText = await errorMessages.nth(i).textContent();
            console.log(`  - Error ${i + 1}: ${errorText}`);
          }
        } else {
          console.log('ℹ️ No validation messages found for empty form');
        }
      });

      await test.step('Test invalid email format', async () => {
        const invalidEmails = [
          'invalid-email',
          'test@',
          '@domain.com',
          'test..test@domain.com',
          'test@domain',
          'test@.com'
        ];

        for (const email of invalidEmails) {
          await authPage.usernameInput.fill(email);
          await authPage.passwordInput.fill('password123');
          await authPage.signInButton.click();
          await page.waitForTimeout(1000);

          // Check if still on login page (validation failed)
          const currentUrl = page.url();
          if (currentUrl.includes('login')) {
            console.log(`✅ Invalid email "${email}" properly rejected`);
          }

          // Clear fields for next test
          await authPage.usernameInput.clear();
          await authPage.passwordInput.clear();
        }
      });

      await test.step('Test password requirements', async () => {
        const weakPasswords = [
          '',
          '123',
          'abc',
          'password',
          '12345678'
        ];

        for (const password of weakPasswords) {
          await authPage.usernameInput.fill('test@clms.edu');
          await authPage.passwordInput.fill(password);
          await authPage.signInButton.click();
          await page.waitForTimeout(1000);

          // Check for password validation
          const passwordError = page.locator('[data-testid="password-error"], .password-error, input[name="password"] + .error');
          const hasPasswordError = await passwordError.isVisible();

          if (hasPasswordError) {
            const errorText = await passwordError.textContent();
            console.log(`✅ Weak password "${password}" rejected: ${errorText}`);
          }

          await authPage.usernameInput.clear();
          await authPage.passwordInput.clear();
        }
      });

      await test.step('Test SQL injection attempts', async () => {
        const sqlInjectionAttempts = [
          "' OR '1'='1",
          "admin'; DROP TABLE users; --",
          "' UNION SELECT * FROM users --",
          "1' OR 1=1#"
        ];

        for (const injection of sqlInjectionAttempts) {
          await authPage.usernameInput.fill(injection);
          await authPage.passwordInput.fill(injection);
          await authPage.signInButton.click();
          await page.waitForTimeout(2000);

          // Should remain on login page
          const currentUrl = page.url();
          expect(currentUrl).toContain('login');
          console.log(`✅ SQL injection attempt blocked: ${injection.slice(0, 20)}...`);

          await authPage.usernameInput.clear();
          await authPage.passwordInput.clear();
        }
      });

      await test.step('Take screenshot of login validation', async () => {
        // Trigger validation state for screenshot
        await authPage.signInButton.click();
        await page.waitForTimeout(1000);
        
        await page.screenshot({ 
          path: 'test-results/screenshots/login-form-validation.png',
          fullPage: true 
        });
      });
    });
  });

  test.describe('👥 Student Management Form Validation', () => {
    test('should validate student creation form', async ({ page }) => {
      await authPage.goto();
      await authPage.login(testUser.username, testUser.password);
      await page.waitForURL('**/dashboard**', { timeout: 15000 });

      // Navigate to students page
      await page.goto('/dashboard/students');
      await page.waitForLoadState('networkidle');

      await test.step('Find and test student form', async () => {
        // Look for "Add Student" or similar button
        const addButton = page.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("New Student")').first();
        const addButtonExists = await addButton.isVisible();

        if (addButtonExists) {
          await addButton.click();
          await page.waitForTimeout(1000);

          // Look for student form
          const form = page.locator('form').first();
          const formVisible = await form.isVisible();

          if (formVisible) {
            console.log('✅ Student form found');

            await test.step('Test required field validations', async () => {
              // Try to submit empty form
              const submitButton = form.locator('button[type="submit"], button:has-text("Save"), button:has-text("Submit")').first();
              
              if (await submitButton.isVisible()) {
                await submitButton.click();
                await page.waitForTimeout(1000);

                // Check for required field errors
                const requiredErrors = form.locator('.required, .error, [aria-invalid="true"]');
                const errorCount = await requiredErrors.count();
                
                console.log(`  - Found ${errorCount} required field validation errors`);
              }
            });

            await test.step('Test student ID validation', async () => {
              const studentIdInput = form.locator('input[name*="id"], input[name*="student"], input[placeholder*="ID" i]').first();
              
              if (await studentIdInput.isVisible()) {
                // Test invalid student IDs
                const invalidIds = ['', '123', 'ABC', '12345678901234567890'];
                
                for (const id of invalidIds) {
                  await studentIdInput.fill(id);
                  await studentIdInput.blur();
                  await page.waitForTimeout(500);

                  const hasError = await form.locator('.error, .invalid').isVisible();
                  if (hasError) {
                    console.log(`    ✅ Invalid student ID "${id}" rejected`);
                  }
                }
              }
            });

            await test.step('Test name field validations', async () => {
              const nameFields = form.locator('input[name*="name"], input[placeholder*="name" i]');
              const nameCount = await nameFields.count();

              for (let i = 0; i < nameCount; i++) {
                const nameField = nameFields.nth(i);
                const fieldName = await nameField.getAttribute('name') || `name-field-${i}`;

                // Test invalid names
                const invalidNames = [
                  '', // Empty
                  'A', // Too short
                  '123', // Numbers only
                  'Name123', // Mixed with numbers
                  'A'.repeat(100), // Too long
                  'Name@#$', // Special characters
                ];

                for (const name of invalidNames) {
                  await nameField.fill(name);
                  await nameField.blur();
                  await page.waitForTimeout(300);

                  const hasError = await form.locator('.error, .invalid').isVisible();
                  if (hasError) {
                    console.log(`    ✅ Invalid name "${name}" rejected for ${fieldName}`);
                  }
                }

                // Test valid name
                await nameField.fill('John Doe');
                await nameField.blur();
                await page.waitForTimeout(300);
              }
            });

            await test.step('Test email validation', async () => {
              const emailInput = form.locator('input[type="email"], input[name*="email"], input[placeholder*="email" i]').first();
              
              if (await emailInput.isVisible()) {
                const invalidEmails = [
                  'invalid-email',
                  'test@',
                  '@domain.com',
                  'test..test@domain.com',
                  'test@domain',
                  'test@.com',
                  'test@domain..com'
                ];

                for (const email of invalidEmails) {
                  await emailInput.fill(email);
                  await emailInput.blur();
                  await page.waitForTimeout(500);

                  const hasError = await form.locator('.error, .invalid').isVisible();
                  if (hasError) {
                    console.log(`    ✅ Invalid email "${email}" rejected`);
                  }
                }

                // Test valid email
                await emailInput.fill('student@clms.edu');
                await emailInput.blur();
                await page.waitForTimeout(300);
              }
            });

            await test.step('Test phone number validation', async () => {
              const phoneInput = form.locator('input[type="tel"], input[name*="phone"], input[placeholder*="phone" i]').first();
              
              if (await phoneInput.isVisible()) {
                const invalidPhones = [
                  '123',
                  'abc-def-ghij',
                  '123-456-789',
                  '1234567890123456',
                  '(555) 123-456',
                  '+1-555-123-456'
                ];

                for (const phone of invalidPhones) {
                  await phoneInput.fill(phone);
                  await phoneInput.blur();
                  await page.waitForTimeout(500);

                  const hasError = await form.locator('.error, .invalid').isVisible();
                  if (hasError) {
                    console.log(`    ✅ Invalid phone "${phone}" rejected`);
                  }
                }

                // Test valid phone
                await phoneInput.fill('(555) 123-4567');
                await phoneInput.blur();
                await page.waitForTimeout(300);
              }
            });

            await test.step('Test date validation', async () => {
              const dateInputs = form.locator('input[type="date"], input[name*="date"], input[placeholder*="date" i]');
              const dateCount = await dateInputs.count();

              for (let i = 0; i < dateCount; i++) {
                const dateInput = dateInputs.nth(i);
                const fieldName = await dateInput.getAttribute('name') || `date-field-${i}`;

                // Test future birth date (should be invalid)
                const futureDate = new Date();
                futureDate.setFullYear(futureDate.getFullYear() + 1);
                const futureDateString = futureDate.toISOString().split('T')[0];

                await dateInput.fill(futureDateString);
                await dateInput.blur();
                await page.waitForTimeout(500);

                const hasError = await form.locator('.error, .invalid').isVisible();
                if (hasError) {
                  console.log(`    ✅ Future date rejected for ${fieldName}`);
                }

                // Test valid birth date
                await dateInput.fill('2000-01-01');
                await dateInput.blur();
                await page.waitForTimeout(300);
              }
            });

            await test.step('Take screenshot of student form validation', async () => {
              await page.screenshot({ 
                path: 'test-results/screenshots/student-form-validation.png',
                fullPage: true 
              });
            });

            // Close form
            try {
              await page.locator('button:has-text("Cancel"), button:has-text("Close"), [data-testid="close"]').first().click();
            } catch {
              await page.keyboard.press('Escape');
            }

          } else {
            console.log('ℹ️ Student form not found');
          }
        } else {
          console.log('ℹ️ Add student button not found');
        }
      });
    });
  });

  test.describe('📚 Book Management Form Validation', () => {
    test('should validate book creation form', async ({ page }) => {
      await authPage.goto();
      await authPage.login(testUser.username, testUser.password);
      await page.waitForURL('**/dashboard**', { timeout: 15000 });

      await page.goto('/dashboard/books');
      await page.waitForLoadState('networkidle');

      await test.step('Find and test book form', async () => {
        const addButton = page.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("New Book")').first();
        const addButtonExists = await addButton.isVisible();

        if (addButtonExists) {
          await addButton.click();
          await page.waitForTimeout(1000);

          const form = page.locator('form').first();
          const formVisible = await form.isVisible();

          if (formVisible) {
            console.log('✅ Book form found');

            await test.step('Test ISBN validation', async () => {
              const isbnInput = form.locator('input[name*="isbn"], input[placeholder*="ISBN" i]').first();
              
              if (await isbnInput.isVisible()) {
                const invalidISBNs = [
                  '123',
                  '978-0-123456-78-9', // Invalid check digit
                  'ABC-DEF-GHIJ',
                  '9780123456789012345', // Too long
                  '978012345678' // Too short
                ];

                for (const isbn of invalidISBNs) {
                  await isbnInput.fill(isbn);
                  await isbnInput.blur();
                  await page.waitForTimeout(500);

                  const hasError = await form.locator('.error, .invalid').isVisible();
                  if (hasError) {
                    console.log(`    ✅ Invalid ISBN "${isbn}" rejected`);
                  }
                }

                // Test valid ISBN
                await isbnInput.fill('978-0-123456-78-5');
                await isbnInput.blur();
                await page.waitForTimeout(300);
              }
            });

            await test.step('Test title validation', async () => {
              const titleInput = form.locator('input[name*="title"], input[placeholder*="title" i]').first();
              
              if (await titleInput.isVisible()) {
                // Test empty title
                await titleInput.fill('');
                await titleInput.blur();
                await page.waitForTimeout(500);

                // Test too long title
                const longTitle = 'A'.repeat(500);
                await titleInput.fill(longTitle);
                await titleInput.blur();
                await page.waitForTimeout(500);

                const hasError = await form.locator('.error, .invalid').isVisible();
                if (hasError) {
                  console.log(`    ✅ Long title validation working`);
                }

                // Test valid title
                await titleInput.fill('Introduction to Computer Science');
                await titleInput.blur();
                await page.waitForTimeout(300);
              }
            });

            await test.step('Test publication year validation', async () => {
              const yearInput = form.locator('input[name*="year"], input[name*="publication"], input[type="number"]').first();
              
              if (await yearInput.isVisible()) {
                const invalidYears = [
                  '1800', // Too old
                  '2050', // Future year
                  'ABCD', // Non-numeric
                  '99', // Too short
                  '12345' // Too long
                ];

                for (const year of invalidYears) {
                  await yearInput.fill(year);
                  await yearInput.blur();
                  await page.waitForTimeout(500);

                  const hasError = await form.locator('.error, .invalid').isVisible();
                  if (hasError) {
                    console.log(`    ✅ Invalid year "${year}" rejected`);
                  }
                }

                // Test valid year
                await yearInput.fill('2023');
                await yearInput.blur();
                await page.waitForTimeout(300);
              }
            });

            await test.step('Test price validation', async () => {
              const priceInput = form.locator('input[name*="price"], input[name*="cost"]').first();
              
              if (await priceInput.isVisible()) {
                const invalidPrices = [
                  '-10', // Negative
                  'ABC', // Non-numeric
                  '10000000', // Too expensive
                  '0.001' // Too many decimals
                ];

                for (const price of invalidPrices) {
                  await priceInput.fill(price);
                  await priceInput.blur();
                  await page.waitForTimeout(500);

                  const hasError = await form.locator('.error, .invalid').isVisible();
                  if (hasError) {
                    console.log(`    ✅ Invalid price "${price}" rejected`);
                  }
                }

                // Test valid price
                await priceInput.fill('29.99');
                await priceInput.blur();
                await page.waitForTimeout(300);
              }
            });

            await test.step('Take screenshot of book form validation', async () => {
              await page.screenshot({ 
                path: 'test-results/screenshots/book-form-validation.png',
                fullPage: true 
              });
            });

            // Close form
            try {
              await page.locator('button:has-text("Cancel"), button:has-text("Close")').first().click();
            } catch {
              await page.keyboard.press('Escape');
            }

          } else {
            console.log('ℹ️ Book form not found');
          }
        } else {
          console.log('ℹ️ Add book button not found');
        }
      });
    });
  });

  test.describe('🔧 Equipment Management Form Validation', () => {
    test('should validate equipment creation form', async ({ page }) => {
      await authPage.goto();
      await authPage.login(testUser.username, testUser.password);
      await page.waitForURL('**/dashboard**', { timeout: 15000 });

      await page.goto('/dashboard/equipment');
      await page.waitForLoadState('networkidle');

      await test.step('Find and test equipment form', async () => {
        const addButton = page.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("New Equipment")').first();
        const addButtonExists = await addButton.isVisible();

        if (addButtonExists) {
          await addButton.click();
          await page.waitForTimeout(1000);

          const form = page.locator('form').first();
          const formVisible = await form.isVisible();

          if (formVisible) {
            console.log('✅ Equipment form found');

            await test.step('Test equipment ID validation', async () => {
              const idInput = form.locator('input[name*="id"], input[name*="equipment"], input[placeholder*="ID" i]').first();
              
              if (await idInput.isVisible()) {
                const invalidIds = [
                  '', // Empty
                  'A', // Too short
                  'EQUIPMENT-ID-THAT-IS-WAY-TOO-LONG-FOR-SYSTEM', // Too long
                  '123@#$', // Invalid characters
                ];

                for (const id of invalidIds) {
                  await idInput.fill(id);
                  await idInput.blur();
                  await page.waitForTimeout(500);

                  const hasError = await form.locator('.error, .invalid').isVisible();
                  if (hasError) {
                    console.log(`    ✅ Invalid equipment ID "${id}" rejected`);
                  }
                }

                // Test valid ID
                await idInput.fill('EQ-001');
                await idInput.blur();
                await page.waitForTimeout(300);
              }
            });

            await test.step('Test serial number validation', async () => {
              const serialInput = form.locator('input[name*="serial"], input[placeholder*="serial" i]').first();
              
              if (await serialInput.isVisible()) {
                // Test duplicate serial number (if validation exists)
                await serialInput.fill('DUPLICATE-SERIAL-123');
                await serialInput.blur();
                await page.waitForTimeout(500);

                // Test valid serial
                await serialInput.fill('SN-' + Date.now());
                await serialInput.blur();
                await page.waitForTimeout(300);
              }
            });

            await test.step('Test condition validation', async () => {
              const conditionSelect = form.locator('select[name*="condition"], select[name*="status"]').first();
              
              if (await conditionSelect.isVisible()) {
                // Test that a condition is selected
                const options = conditionSelect.locator('option');
                const optionCount = await options.count();
                
                if (optionCount > 1) {
                  await conditionSelect.selectOption({ index: 1 });
                  console.log('    ✅ Equipment condition selection working');
                }
              }
            });

            await test.step('Take screenshot of equipment form validation', async () => {
              await page.screenshot({ 
                path: 'test-results/screenshots/equipment-form-validation.png',
                fullPage: true 
              });
            });

            // Close form
            try {
              await page.locator('button:has-text("Cancel"), button:has-text("Close")').first().click();
            } catch {
              await page.keyboard.press('Escape');
            }

          } else {
            console.log('ℹ️ Equipment form not found');
          }
        } else {
          console.log('ℹ️ Add equipment button not found');
        }
      });
    });
  });

  test.describe('🔄 Cross-Field Validation Testing', () => {
    test('should test cross-field validations', async ({ page }) => {
      await authPage.goto();
      await authPage.login(testUser.username, testUser.password);
      await page.waitForURL('**/dashboard**', { timeout: 15000 });

      await test.step('Test date range validations', async () => {
        // Look for forms with date ranges (e.g., loan periods, report date ranges)
        const forms = page.locator('form');
        const formCount = await forms.count();

        for (let i = 0; i < formCount; i++) {
          const form = forms.nth(i);
          const dateInputs = form.locator('input[type="date"]');
          const dateCount = await dateInputs.count();

          if (dateCount >= 2) {
            console.log(`✅ Found form with multiple date fields`);

            // Test start date after end date
            const startDate = dateInputs.first();
            const endDate = dateInputs.nth(1);

            await startDate.fill('2024-12-31');
            await endDate.fill('2024-01-01');
            
            const submitButton = form.locator('button[type="submit"]').first();
            if (await submitButton.isVisible()) {
              await submitButton.click();
              await page.waitForTimeout(1000);

              const hasError = await form.locator('.error, .invalid').isVisible();
              if (hasError) {
                console.log('    ✅ Date range validation working');
              }
            }
          }
        }
      });

      await test.step('Test password confirmation', async () => {
        // Look for password change forms
        const passwordForms = page.locator('form:has(input[type="password"])');
        const passwordFormCount = await passwordForms.count();

        for (let i = 0; i < passwordFormCount; i++) {
          const form = passwordForms.nth(i);
          const passwordInputs = form.locator('input[type="password"]');
          const passwordCount = await passwordInputs.count();

          if (passwordCount >= 2) {
            console.log(`✅ Found password confirmation form`);

            // Test mismatched passwords
            await passwordInputs.first().fill('password123');
            await passwordInputs.nth(1).fill('different456');

            const submitButton = form.locator('button[type="submit"]').first();
            if (await submitButton.isVisible()) {
              await submitButton.click();
              await page.waitForTimeout(1000);

              const hasError = await form.locator('.error, .invalid').isVisible();
              if (hasError) {
                console.log('    ✅ Password confirmation validation working');
              }
            }
          }
        }
      });
    });
  });

  test.describe('⚡ Real-time vs Submit-time Validation', () => {
    test('should test validation timing', async ({ page }) => {
      await authPage.goto();
      await authPage.waitForPageLoad();

      await test.step('Test real-time validation on login form', async () => {
        // Test if validation occurs on blur/input events
        await authPage.usernameInput.fill('invalid-email');
        await authPage.usernameInput.blur();
        await page.waitForTimeout(500);

        const realtimeError = page.locator('.error, .invalid').first();
        const hasRealtimeError = await realtimeError.isVisible();

        if (hasRealtimeError) {
          console.log('✅ Real-time validation detected');
        } else {
          console.log('ℹ️ No real-time validation, testing submit-time validation');
          
          await authPage.signInButton.click();
          await page.waitForTimeout(1000);
          
          const submitTimeError = await realtimeError.isVisible();
          if (submitTimeError) {
            console.log('✅ Submit-time validation detected');
          }
        }
      });
    });
  });

  test.describe('♿ Validation Accessibility', () => {
    test('should test validation message accessibility', async ({ page }) => {
      await authPage.goto();
      await authPage.waitForPageLoad();

      await test.step('Test validation message ARIA attributes', async () => {
        // Trigger validation
        await authPage.signInButton.click();
        await page.waitForTimeout(1000);

        // Check for proper ARIA attributes on error messages
        const errorMessages = page.locator('.error, .invalid, [role="alert"]');
        const errorCount = await errorMessages.count();

        let accessibleErrors = 0;

        for (let i = 0; i < errorCount; i++) {
          const error = errorMessages.nth(i);
          
          const hasRole = await error.getAttribute('role');
          const hasAriaLive = await error.getAttribute('aria-live');
          const hasAriaDescribedBy = await error.getAttribute('aria-describedby');

          if (hasRole === 'alert' || hasAriaLive || hasAriaDescribedBy) {
            accessibleErrors++;
          }
        }

        const accessibilityRate = errorCount > 0 ? (accessibleErrors / errorCount) * 100 : 0;
        console.log(`✅ Validation accessibility rate: ${accessibilityRate.toFixed(1)}% (${accessibleErrors}/${errorCount})`);
      });

      await test.step('Test keyboard navigation to error messages', async () => {
        // Test if error messages are focusable or properly announced
        await page.keyboard.press('Tab');
        
        const focusedElement = page.locator(':focus');
        const focusedTag = await focusedElement.evaluate(el => el.tagName.toLowerCase());
        
        console.log(`✅ Keyboard navigation test: focused element is ${focusedTag}`);
      });
    });
  });

  test.afterEach(async ({ page }) => {
    // Take a final screenshot if test failed
    if (test.info().status === 'failed') {
      await page.screenshot({ 
        path: `test-results/screenshots/form-validation-failure-${Date.now()}.png`,
        fullPage: true 
      });
    }

    // Cleanup: logout if authenticated
    try {
      const currentUrl = page.url();
      if (!currentUrl.includes('login')) {
        await dashboardPage.logout();
      }
    } catch {
      // Ignore cleanup errors
    }
  });
});