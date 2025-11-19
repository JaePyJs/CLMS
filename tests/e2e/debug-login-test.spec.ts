import { test, expect } from "@playwright/test";

test.describe("🐛 Debug Login Test", () => {
  test("debug login flow step by step", async ({ page }) => {
    console.log("🚀 Starting debug login test...");

    // Navigate to login page
    console.log("📍 Navigating to login page...");
    await page.goto("http://localhost:3000");

    // Wait for page to load
    await page.waitForLoadState("networkidle");

    // Take screenshot of initial state
    console.log("📸 Taking screenshot of initial state...");
    await page.screenshot({ path: "test-results/debug-01-initial-page.png" });

    // Check if we're on login page
    const loginFormVisible = await page
      .locator('input[type="email"]')
      .isVisible()
      .catch(() => false);
    console.log("🔍 Login form visible:", loginFormVisible);

    if (!loginFormVisible) {
      console.log("❌ Login form not visible, checking current URL...");
      console.log("📍 Current URL:", page.url());

      // Take screenshot of current state
      await page.screenshot({
        path: "test-results/debug-02-no-login-form.png",
      });

      // Check what's on the page
      const pageContent = await page.content();
      console.log("📄 Page content preview:", pageContent.substring(0, 500));

      return;
    }

    // Fill login form
    console.log("📝 Filling login form...");
    await page.fill('input[type="email"]', "librarian@example.com");
    await page.fill('input[type="password"]', "password123");

    // Take screenshot before clicking login
    await page.screenshot({ path: "test-results/debug-03-filled-form.png" });

    // Click login button
    console.log("🎯 Clicking login button...");
    await page.click('button[type="submit"]');

    // Wait for navigation
    console.log("⏳ Waiting for navigation...");
    await page.waitForLoadState("networkidle");

    // Check current URL
    console.log("📍 Current URL after login:", page.url());

    // Take screenshot after login attempt
    await page.screenshot({ path: "test-results/debug-04-after-login.png" });

    // Check for dashboard
    const dashboardVisible = await page
      .locator('h2:has-text("Dashboard")')
      .isVisible()
      .catch(() => false);
    console.log("🔍 Dashboard visible:", dashboardVisible);

    // Check for error messages
    const errorMessage = await page
      .locator("text=Login failed")
      .isVisible()
      .catch(() => false);
    console.log("❌ Error message visible:", errorMessage);

    // Check for any auth-related content
    const authContent = await page
      .locator("text=auth")
      .isVisible()
      .catch(() => false);
    console.log("🔐 Auth content visible:", authContent);

    // Final screenshot
    await page.screenshot({ path: "test-results/debug-05-final-state.png" });

    console.log("✅ Debug test completed");
  });
});
