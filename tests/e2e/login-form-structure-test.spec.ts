import { test, expect } from '@playwright/test';

test.describe('🐛 Login Form Structure Test', () => {
  test('analyze login form structure', async ({ page }) => {
    console.log('🔍 Analyzing login form structure...');
    
    // Navigate to the application
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(3000);
    
    // Get all input elements
    const inputs = await page.locator('input').all();
    console.log(`📋 Found ${inputs.length} input elements:`);
    
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const type = await input.getAttribute('type');
      const placeholder = await input.getAttribute('placeholder');
      const id = await input.getAttribute('id');
      const name = await input.getAttribute('name');
      
      console.log(`  Input ${i + 1}: type="${type}", placeholder="${placeholder}", id="${id}", name="${name}"`);
    }
    
    // Get all button elements
    const buttons = await page.locator('button').all();
    console.log(`🔘 Found ${buttons.length} button elements:`);
    
    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];
      const text = await button.textContent();
      const type = await button.getAttribute('type');
      
      console.log(`  Button ${i + 1}: text="${text?.trim()}", type="${type}"`);
    }
    
    // Check for form elements
    const forms = await page.locator('form').all();
    console.log(`📄 Found ${forms.length} form elements`);
    
    // Check for specific text content
    const bodyText = await page.textContent('body');
    const hasUsername = bodyText?.toLowerCase().includes('username') || false;
    const hasPassword = bodyText?.toLowerCase().includes('password') || false;
    const hasSignIn = bodyText?.toLowerCase().includes('sign in') || false;
    const hasLogin = bodyText?.toLowerCase().includes('login') || false;
    
    console.log('🔍 Text content analysis:');
    console.log('  Contains "username":', hasUsername);
    console.log('  Contains "password":', hasPassword);
    console.log('  Contains "sign in":', hasSignIn);
    console.log('  Contains "login":', hasLogin);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/login-form-structure.png' });
    
    console.log('✅ Login form analysis completed');
  });
});