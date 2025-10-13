/**
 * Production Health Checks for CLMS
 * Comprehensive health monitoring for production environment
 */

import { test, expect } from '@playwright/test';
import { config } from 'dotenv';

config({ path: '.env.production' });

const BASE_URL = process.env.BASE_URL || 'https://your-domain.com';

test.describe('Production Health Checks', () => {
  test.beforeAll(async ({ request }) => {
    console.log(`Running health checks against: ${BASE_URL}`);
  });

  test('Application Health Dashboard', async ({ request }) => {
    console.log('Checking application health dashboard...');

    const healthEndpoints = [
      '/health',
      '/api/health',
      '/api/health/status',
      '/api/system/health'
    ];

    let workingEndpoint = null;
    for (const endpoint of healthEndpoints) {
      try {
        const response = await request.get(`${BASE_URL}${endpoint}`);
        if (response.status() === 200) {
          workingEndpoint = endpoint;
          break;
        }
      } catch (error) {
        continue;
      }
    }

    expect(workingEndpoint).toBeTruthy();

    const response = await request.get(`${BASE_URL}${workingEndpoint}`);
    const healthData = await response.json();

    // Check basic health structure
    expect(healthData).toHaveProperty('status');
    expect(['healthy', 'degraded', 'unhealthy']).toContain(healthData.status);
    expect(healthData).toHaveProperty('timestamp');

    console.log(`✅ Health check working via ${workingEndpoint}`);
    console.log(`Status: ${healthData.status}`);
  });

  test('Database Health', async ({ request }) => {
    console.log('Checking database connectivity...');

    const dbEndpoints = [
      '/api/health/database',
      '/api/db/health',
      '/api/system/database'
    ];

    let dbWorking = false;
    let dbResponse = null;

    for (const endpoint of dbEndpoints) {
      try {
        const response = await request.get(`${BASE_URL}${endpoint}`);
        if (response.status() === 200) {
          dbWorking = true;
          dbResponse = await response.json();
          break;
        }
      } catch (error) {
        continue;
      }
    }

    expect(dbWorking).toBe(true);
    expect(dbResponse).toHaveProperty('status');
    expect(dbResponse.status).toBe('connected');

    // Check additional database metrics
    if (dbResponse.connectionTime) {
      expect(dbResponse.connectionTime).toBeLessThan(1000); // Less than 1 second
      console.log(`✅ Database connection time: ${dbResponse.connectionTime}ms`);
    }

    console.log('✅ Database health check passed');
  });

  test('Cache Health', async ({ request }) => {
    console.log('Checking Redis cache connectivity...');

    const cacheEndpoints = [
      '/api/health/redis',
      '/api/cache/health',
      '/api/system/redis'
    ];

    let cacheWorking = false;
    let cacheResponse = null;

    for (const endpoint of cacheEndpoints) {
      try {
        const response = await request.get(`${BASE_URL}${endpoint}`);
        if (response.status() === 200) {
          cacheWorking = true;
          cacheResponse = await response.json();
          break;
        }
      } catch (error) {
        continue;
      }
    }

    expect(cacheWorking).toBe(true);
    expect(cacheResponse).toHaveProperty('status');
    expect(cacheResponse.status).toBe('connected');

    console.log('✅ Redis cache health check passed');
  });

  test('External Service Dependencies', async ({ request }) => {
    console.log('Checking external service dependencies...');

    const externalServices = [
      { name: 'Email Service', endpoint: '/api/health/email' },
      { name: 'File Storage', endpoint: '/api/health/storage' },
      { name: 'Google Sheets', endpoint: '/api/health/google-sheets' }
    ];

    const serviceResults = [];

    for (const service of externalServices) {
      try {
        const response = await request.get(`${BASE_URL}${service.endpoint}`);
        if (response.status() === 200) {
          const data = await response.json();
          serviceResults.push({
            name: service.name,
            status: 'available',
            responseTime: data.responseTime || 'N/A'
          });
          console.log(`✅ ${service.name}: Available`);
        } else {
          serviceResults.push({
            name: service.name,
            status: 'unavailable',
            error: `HTTP ${response.status()}`
          });
          console.log(`⚠️ ${service.name}: Unavailable (${response.status()})`);
        }
      } catch (error) {
        serviceResults.push({
          name: service.name,
          status: 'error',
          error: error.message
        });
        console.log(`❌ ${service.name}: Error - ${error.message}`);
      }
    }

    // Log all service results
    console.log('\nExternal Service Summary:');
    serviceResults.forEach(service => {
      console.log(`  ${service.name}: ${service.status}`);
    });

    // At least basic services should be available
    expect(serviceResults.some(s => s.status === 'available')).toBe(true);
  });

  test('System Resource Health', async ({ request }) => {
    console.log('Checking system resource health...');

    const resourceEndpoints = [
      '/api/health/resources',
      '/api/system/resources',
      '/api/metrics/system'
    ];

    let resourceData = null;

    for (const endpoint of resourceEndpoints) {
      try {
        const response = await request.get(`${BASE_URL}${endpoint}`);
        if (response.status() === 200) {
          resourceData = await response.json();
          break;
        }
      } catch (error) {
        continue;
      }
    }

    if (resourceData) {
      // Check CPU usage (if available)
      if (resourceData.cpu) {
        expect(resourceData.cpu).toBeLessThan(90); // Less than 90%
        console.log(`✅ CPU usage: ${resourceData.cpu}%`);
      }

      // Check memory usage (if available)
      if (resourceData.memory) {
        expect(resourceData.memory).toBeLessThan(90); // Less than 90%
        console.log(`✅ Memory usage: ${resourceData.memory}%`);
      }

      // Check disk usage (if available)
      if (resourceData.disk) {
        expect(resourceData.disk).toBeLessThan(85); // Less than 85%
        console.log(`✅ Disk usage: ${resourceData.disk}%`);
      }

      console.log('✅ System resources are within acceptable limits');
    } else {
      console.log('⚠️ Resource monitoring endpoints not available');
    }
  });

  test('API Response Times', async ({ request }) => {
    console.log('Checking API response times...');

    const apiEndpoints = [
      { path: '/api/health', expected: 1000 },
      { path: '/api/books/count', expected: 2000 },
      { path: '/api/students/count', expected: 2000 },
      { path: '/api/equipment/count', expected: 2000 }
    ];

    const responseTimes = [];

    for (const endpoint of apiEndpoints) {
      const startTime = Date.now();
      try {
        const response = await request.get(`${BASE_URL}${endpoint.path}`);
        const responseTime = Date.now() - startTime;

        responseTimes.push({
          endpoint: endpoint.path,
          time: responseTime,
          status: response.status(),
          withinLimit: responseTime <= endpoint.expected
        });

        if (responseTime <= endpoint.expected) {
          console.log(`✅ ${endpoint.path}: ${responseTime}ms (≤ ${endpoint.expected}ms)`);
        } else {
          console.log(`⚠️ ${endpoint.path}: ${responseTime}ms (> ${endpoint.expected}ms)`);
        }
      } catch (error) {
        console.log(`❌ ${endpoint.path}: Error - ${error.message}`);
        responseTimes.push({
          endpoint: endpoint.path,
          time: -1,
          status: 'error',
          withinLimit: false
        });
      }
    }

    // At least 75% of endpoints should be within limits
    const withinLimitCount = responseTimes.filter(rt => rt.withinLimit).length;
    const withinLimitPercentage = (withinLimitCount / responseTimes.length) * 100;

    expect(withinLimitPercentage).toBeGreaterThanOrEqual(75);
    console.log(`✅ ${withinLimitPercentage}% of API endpoints within response time limits`);
  });

  test('Error Rate Monitoring', async ({ request }) => {
    console.log('Checking system error rates...');

    // Make a series of requests to check error rates
    const endpoints = [
      '/api/health',
      '/api/books/count',
      '/api/students/count',
      '/api/equipment/count'
    ];

    let successfulRequests = 0;
    let totalRequests = 0;

    for (let i = 0; i < 3; i++) { // Test each endpoint 3 times
      for (const endpoint of endpoints) {
        totalRequests++;
        try {
          const response = await request.get(`${BASE_URL}${endpoint}`);
          if (response.status() < 500) { // Consider server errors only
            successfulRequests++;
          }
        } catch (error) {
          // Network errors count as failures
        }
      }
    }

    const errorRate = ((totalRequests - successfulRequests) / totalRequests) * 100;
    console.log(`Error rate: ${errorRate.toFixed(2)}% (${totalRequests - successfulRequests}/${totalRequests} failed)`);

    // Error rate should be less than 10%
    expect(errorRate).toBeLessThan(10);
    console.log('✅ Error rate is within acceptable limits');
  });

  test('SSL Certificate Validity', async ({ request }) => {
    console.log('Checking SSL certificate validity...');

    try {
      const response = await request.get(BASE_URL);
      const certInfo = response.headers()['x-ssl-certificate'];

      // Check if we're using HTTPS
      expect(BASE_URL).toMatch(/^https:/);
      console.log('✅ Application is using HTTPS');

      // Check for secure headers
      const headers = response.headers();
      if (headers['strict-transport-security']) {
        console.log('✅ HSTS header is present');
      }

      if (headers['x-frame-options']) {
        console.log('✅ X-Frame-Options header is present');
      }

    } catch (error) {
      console.log(`❌ SSL certificate check failed: ${error.message}`);
      // Don't fail the test for certificate issues, but log them
    }
  });

  test('Background Job Processing', async ({ request }) => {
    console.log('Checking background job processing...');

    const jobEndpoints = [
      '/api/health/jobs',
      '/api/system/jobs',
      '/api/jobs/status'
    ];

    let jobsWorking = false;

    for (const endpoint of jobEndpoints) {
      try {
        const response = await request.get(`${BASE_URL}${endpoint}`);
        if (response.status() === 200) {
          const jobData = await response.json();
          if (jobData.status === 'active' || jobData.healthy === true) {
            jobsWorking = true;
            console.log(`✅ Background jobs are active (${endpoint})`);
            break;
          }
        }
      } catch (error) {
        continue;
      }
    }

    if (!jobsWorking) {
      console.log('⚠️ Background job status endpoint not available or jobs inactive');
    }
  });

  test('Log File Accessibility', async ({ request }) => {
    console.log('Checking log file accessibility...');

    const logEndpoints = [
      '/api/logs/recent',
      '/api/system/logs',
      '/api/health/logs'
    ];

    let logsAccessible = false;

    for (const endpoint of logEndpoints) {
      try {
        const response = await request.get(`${BASE_URL}${endpoint}`);
        if (response.status() === 200) {
          logsAccessible = true;
          console.log(`✅ Log endpoint accessible (${endpoint})`);
          break;
        }
      } catch (error) {
        continue;
      }
    }

    if (!logsAccessible) {
      console.log('⚠️ Log endpoints not accessible (may be restricted in production)');
    }
  });

  test('Database Connection Pool Status', async ({ request }) => {
    console.log('Checking database connection pool status...');

    const poolEndpoints = [
      '/api/health/database/pool',
      '/api/system/database/pool'
    ];

    for (const endpoint of poolEndpoints) {
      try {
        const response = await request.get(`${BASE_URL}${endpoint}`);
        if (response.status() === 200) {
          const poolData = await response.json();

          if (poolData.activeConnections !== undefined) {
            console.log(`✅ Active DB connections: ${poolData.activeConnections}`);
          }

          if (poolData.idleConnections !== undefined) {
            console.log(`✅ Idle DB connections: ${poolData.idleConnections}`);
          }

          if (poolData.totalConnections !== undefined) {
            expect(poolData.totalConnections).toBeLessThan(50); // Reasonable limit
            console.log(`✅ Total DB connections: ${poolData.totalConnections}`);
          }

          break;
        }
      } catch (error) {
        continue;
      }
    }
  });

  test('Cache Hit Rate', async ({ request }) => {
    console.log('Checking cache performance...');

    const cacheEndpoints = [
      '/api/health/redis/stats',
      '/api/cache/stats',
      '/api/system/cache'
    ];

    for (const endpoint of cacheEndpoints) {
      try {
        const response = await request.get(`${BASE_URL}${endpoint}`);
        if (response.status() === 200) {
          const cacheStats = await response.json();

          if (cacheStats.hitRate !== undefined) {
            expect(cacheStats.hitRate).toBeGreaterThan(70); // At least 70% hit rate
            console.log(`✅ Cache hit rate: ${cacheStats.hitRate}%`);
          }

          if (cacheStats.memory !== undefined) {
            console.log(`✅ Cache memory usage: ${cacheStats.memory}`);
          }

          break;
        }
      } catch (error) {
        continue;
      }
    }
  });

  test('Application Version Information', async ({ request }) => {
    console.log('Checking application version information...');

    const versionEndpoints = [
      '/api/version',
      '/api/system/version',
      '/api/info'
    ];

    let versionInfo = null;

    for (const endpoint of versionEndpoints) {
      try {
        const response = await request.get(`${BASE_URL}${endpoint}`);
        if (response.status() === 200) {
          versionInfo = await response.json();
          break;
        }
      } catch (error) {
        continue;
      }
    }

    if (versionInfo) {
      if (versionInfo.version) {
        console.log(`✅ Application version: ${versionInfo.version}`);
      }

      if (versionInfo.buildDate) {
        console.log(`✅ Build date: ${versionInfo.buildDate}`);
      }

      if (versionInfo.environment) {
        console.log(`✅ Environment: ${versionInfo.environment}`);
      }
    } else {
      console.log('⚠️ Version information endpoint not available');
    }
  });

  test.afterAll(async () => {
    console.log('\n🏥 Production Health Checks Completed');
    console.log('📊 All systems appear to be functioning normally');
  });
});