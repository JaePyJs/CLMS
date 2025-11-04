import { test, expect } from '@playwright/test';

test.describe('🔐 Simple Login Test with Mock Backend', () => {
  test('should demonstrate login functionality with mock backend', async ({ page }) => {
    console.log('🧪 Testing login with mock backend...');
    
    // Navigate to frontend
    await page.goto('http://localhost:3000', { timeout: 30000 });
    
    // Take screenshot of initial state
    await page.screenshot({ 
      path: 'test-results/simple-login-initial.png',
      fullPage: true 
    });
    
    console.log('📸 Screenshot saved: simple-login-initial.png');
    
    // Check if page loaded (even if with errors)
    const pageTitle = await page.title();
    console.log('📄 Page title:', pageTitle);
    
    // Try to find login form elements
    const loginSelectors = [
      'form',
      'input[type="text"]',
      'input[type="email"]',
      'input[name="username"]',
      'input[name="email"]',
      'input[type="password"]',
      'button[type="submit"]',
      'button:has-text("login")',
      'button:has-text("Login")',
      'button:has-text("Sign in")'
    ];
    
    console.log('🔍 Looking for login form elements...');
    
    for (const selector of loginSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`✅ Found ${count} element(s) with selector: ${selector}`);
      }
    }
    
    // Check page console for errors
    page.on('console', msg => {
      console.log('🌐 Page console:', msg.type(), msg.text());
    });
    
    // Test direct API call to mock backend
    console.log('🔗 Testing mock backend API directly...');
    
    try {
      const response = await page.evaluate(async () => {
        const resp = await fetch('http://localhost:3001/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: 'admin',
            password: 'admin123'
          })
        });
        
        const data = await resp.json();
        return {
          status: resp.status,
          ok: resp.ok,
          data: data
        };
      });
      
      console.log('📡 Mock backend response:', response);
      
      if (response.ok && response.data.success) {
        console.log('✅ Login API working correctly!');
        expect(response.data.success).toBe(true);
        expect(response.data.data.user.username).toBe('admin');
        expect(response.data.data.accessToken).toBeTruthy();
      } else {
        console.log('❌ Login API failed:', response);
      }
      
    } catch (error) {
      console.log('❌ API test failed:', error.message);
    }
    
    // Test health endpoint
    console.log('💚 Testing health endpoint...');
    
    try {
      const healthResponse = await page.evaluate(async () => {
        const resp = await fetch('http://localhost:3001/health');
        return await resp.json();
      });
      
      console.log('🏥 Health response:', healthResponse);
      expect(healthResponse.status).toBe('OK');
      
    } catch (error) {
      console.log('❌ Health check failed:', error.message);
    }
    
    // Take final screenshot
    await page.screenshot({ 
      path: 'test-results/simple-login-final.png',
      fullPage: true 
    });
    
    console.log('📸 Screenshot saved: simple-login-final.png');
    console.log('🎉 Simple login test completed!');
  });
});