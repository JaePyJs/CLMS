// Simple test script for attendance export API (Node.js 22+)

async function test() {
  try {
    // Step 1: Login
    console.log('Logging in...');
    const loginRes = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });

    if (!loginRes.ok) {
      console.error('Login failed:', await loginRes.text());
      return;
    }

    const loginData = await loginRes.json();

    const token = loginData.data?.accessToken;
    if (!token) {
      console.error('No token in response:', JSON.stringify(loginData, null, 2));
      return;
    }
    console.log('✓ Login successful');
    console.log('Token:', token.substring(0, 30) + '...');

    // Step 2: Test attendance export endpoint
    console.log('\n=== Testing attendance-export/data endpoint ===');
    const exportRes = await fetch('http://localhost:3001/api/attendance-export/data?startDate=2025-01-01&endDate=2025-12-31', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log('Status:', exportRes.status);
    const exportData = await exportRes.json();
    console.log('Response:', JSON.stringify(exportData, null, 2));

    // Step 3: Test CSV export endpoint
    console.log('\n=== Testing CSV export endpoint ===');
    const csvRes = await fetch('http://localhost:3001/api/attendance-export/export/csv?startDate=2025-01-01&endDate=2025-12-31', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log('Status:', csvRes.status);
    if (csvRes.ok) {
      const csvText = await csvRes.text();
      console.log('✓ CSV export successful, length:', csvText.length);
      console.log('First 200 chars:', csvText.substring(0, 200));
    } else {
      console.error('CSV export failed:', await csvRes.text());
    }

    // Step 4: Test Google Sheets endpoint
    console.log('\n=== Testing Google Sheets endpoint ===');
    const sheetsRes = await fetch('http://localhost:3001/api/attendance-export/google-sheets?startDate=2025-01-01&endDate=2025-12-31', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log('Status:', sheetsRes.status);
    const sheetsData = await sheetsRes.json();
    console.log('Response:', JSON.stringify(sheetsData, null, 2));

    console.log('\n✓ All tests completed!');
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

test();
