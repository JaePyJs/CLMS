import { test, expect } from '@playwright/test';

test.describe('🐛 Network Monitor Test', () => {
  test('monitor network requests during login', async ({ page }) => {
    console.log('🔍 Monitoring network requests during login...');
    
    // Set up network monitoring
    const requests: any[] = [];
    const responses: any[] = [];
    
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/')) {
        console.log('📤 API Request:', request.method(), url);
        requests.push({
          method: request.method(),
          url: url,
          headers: request.headers(),
          postData: request.postData()
        });
      }
    });
    
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/api/')) {
        console.log('📥 API Response:', response.status(), url);
        responses.push({
          status: response.status(),
          url: url,
          statusText: response.statusText()
        });
      }
    });
    
    // Navigate to the application
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(3000);
    
    // Test with admin/admin123
    console.log('📝 Testing with admin/admin123...');
    await page.fill('input[id="username"]', 'admin');
    await page.fill('input[id="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    await page.waitForTimeout(5000);
    
    // Check results
    console.log('📊 Network Analysis:');
    console.log('📤 Total API requests:', requests.length);
    console.log('📥 Total API responses:', responses.length);
    
    requests.forEach((req, i) => {
      console.log(`Request ${i + 1}: ${req.method} ${req.url}`);
      if (req.postData) {
        console.log(`  Post data: ${req.postData}`);
      }
    });
    
    responses.forEach((res, i) => {
      console.log(`Response ${i + 1}: ${res.status} ${res.statusText} ${res.url}`);
    });
    
    // Check current state
    const currentUrl = page.url();
    console.log('📍 Current URL:', currentUrl);
    
    const bodyText = await page.textContent('body');
    console.log('📄 Body text preview:', bodyText?.substring(0, 200));
    
    console.log('✅ Network monitoring completed');
  });
});