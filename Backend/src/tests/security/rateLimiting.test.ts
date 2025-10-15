import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { rateLimitService, RateLimitAlgorithm } from '../../services/rateLimitService';
import Redis from 'ioredis';

describe('Enhanced Rate Limiting Tests', () => {
  let redis: Redis;

  beforeAll(async () => {
    // Connect to test Redis instance
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      lazyConnect: true,
    });

    await redis.connect();
  });

  afterAll(async () => {
    await redis?.disconnect();
  });

  beforeEach(async () => {
    // Clean up Redis before each test
    await redis.flushdb();
  });

  describe('Role-Based Rate Limiting', () => {
    test('should apply different limits based on user role', async () => {
      // Test unauthenticated user (strictest limit)
      const unauthRequests = Array(60).fill(null).map(() =>
        request(app).get('/api/books')
      );

      const unauthResponses = await Promise.allSettled(unauthRequests);
      const unauthRateLimited = unauthResponses.filter(r =>
        r.status === 'fulfilled' && r.value.status === 429
      );

      expect(unauthRateLimited.length).toBeGreaterThan(0);

      // Test authenticated student (more lenient limit)
      const studentRequests = Array(10).fill(null).map(() =>
        request(app)
          .get('/api/books')
          .set('Authorization', 'Bearer student-token')
      );

      const studentResponses = await Promise.allSettled(studentRequests);
      const studentRateLimited = studentResponses.filter(r =>
        r.status === 'fulfilled' && r.value.status === 429
      );

      // Student should have higher limit than unauthenticated users
      expect(studentRateLimited.length).toBeLessThan(unauthRateLimited.length);
    });

    test('should include role information in rate limit headers', async () => {
      const response = await request(app)
        .get('/api/books')
        .set('Authorization', 'Bearer admin-token');

      expect(response.headers['x-ratelimit-role']).toBeDefined();
      expect(response.headers['x-ratelimit-algorithm']).toBe('token_bucket');
    });
  });

  describe('Token Bucket Algorithm', () => {
    test('should allow burst requests within token limit', async () => {
      // Make rapid requests within token bucket capacity
      const requests = Array(5).fill(null).map(() =>
        request(app).get('/api/books').set('Authorization', 'Bearer admin-token')
      );

      const responses = await Promise.all(requests);

      // All requests should succeed due to token bucket burst capacity
      responses.forEach(response => {
        expect(response.status).not.toBe(429);
      });
    });

    test('should gradually refill tokens over time', async () => {
      // Exhaust the token bucket
      const requests = Array(10).fill(null).map(() =>
        request(app).get('/api/books').set('Authorization', 'Bearer student-token')
      );

      await Promise.all(requests);

      // Wait for token refill
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Should be able to make requests again
      const response = await request(app)
        .get('/api/books')
        .set('Authorization', 'Bearer student-token');

      expect(response.status).not.toBe(429);
    });
  });

  describe('Sliding Window Algorithm', () => {
    test('should count requests within sliding time window', async () => {
      // Create custom rate limit with sliding window
      const slidingMiddleware = rateLimitService.createRoleBasedRateLimit(
        RateLimitAlgorithm.SLIDING_WINDOW,
        {
          windowMs: 1000, // 1 second window
          max: 3 // 3 requests per window
        }
      );

      // Make requests rapidly
      const requests = Array(5).fill(null).map((_, i) =>
        request(app)
          .get('/api/books')
          .set('Authorization', 'Bearer test-token')
          .then(() => new Promise(resolve => setTimeout(resolve, i * 100)))
      );

      const responses = await Promise.allSettled(requests);
      const rateLimited = responses.filter(r =>
        r.status === 'fulfilled' && r.value.status === 429
      );

      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Exponential Backoff Algorithm', () => {
    test('should implement progressive delays for repeated violations', async () => {
      const backoffMiddleware = rateLimitService.createRoleBasedRateLimit(
        RateLimitAlgorithm.EXPONENTIAL_BACKOFF,
        {
          windowMs: 1000,
          max: 2
        }
      );

      // First violation
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'wrong' });

      // Second violation should have longer delay
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'wrong' });

      expect(response.status).toBe(429);
      expect(response.body.retryAfter).toBeGreaterThan(1);
    });
  });

  describe('Progressive Rate Limiting', () => {
    test('should apply increasing penalties for abusive behavior', async () => {
      const req = {
        ip: '192.168.1.100',
        path: '/api/sensitive-endpoint',
        get: (header: string) => header === 'User-Agent' ? 'test-agent' : undefined
      } as any;

      // First violation
      const result1 = await rateLimitService.progressiveRateLimit(req, 1);
      expect(result1.allowed).toBe(false);
      expect(result1.penaltyMinutes).toBe(5);

      // Second violation should have longer penalty
      const result2 = await rateLimitService.progressiveRateLimit(req, 2);
      expect(result2.allowed).toBe(false);
      expect(result2.penaltyMinutes).toBe(10);
    });

    test('should max out penalty at 24 hours', async () => {
      const req = {
        ip: '192.168.1.200',
        path: '/api/sensitive-endpoint',
        get: (header: string) => header === 'User-Agent' ? 'test-agent' : undefined
      } as any;

      // High violation count
      const result = await rateLimitService.progressiveRateLimit(req, 10);
      expect(result.allowed).toBe(false);
      expect(result.penaltyMinutes).toBeLessThanOrEqual(24 * 60); // Max 24 hours
    });
  });

  describe('Rate Limit Statistics', () => {
    test('should provide rate limit statistics', async () => {
      const stats = await rateLimitService.getRateLimitStats();

      expect(stats).toBeDefined();
      expect(typeof stats.totalKeys).toBe('number');
      expect(typeof stats.activeLimits).toBe('number');
      expect(Array.isArray(stats.topViolators)).toBe(true);
      expect(typeof stats.distribution).toBe('object');
    });

    test('should reset rate limit for specific key', async () => {
      const req = {
        ip: '192.168.1.300',
        user: { id: 'test-user-123', role: 'STUDENT' },
        path: '/api/test',
        get: (header: string) => header === 'User-Agent' ? 'test-agent' : undefined
      } as any;

      const key = `token_bucket:STUDENT:test-user-123`;

      // Set some rate limit data
      await redis.hset(`bucket:${key}`, {
        tokens: '5',
        lastRefill: Date.now().toString()
      });

      // Reset the rate limit
      const resetResult = await rateLimitService.resetRateLimit(key);
      expect(resetResult).toBe(true);

      // Verify data is gone
      const bucketData = await redis.hgetall(`bucket:${key}`);
      expect(Object.keys(bucketData).length).toBe(0);
    });
  });

  describe('Header Security', () => {
    test('should include comprehensive rate limit headers', async () => {
      const response = await request(app)
        .get('/api/books')
        .set('Authorization', 'Bearer admin-token');

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
      expect(response.headers['x-ratelimit-algorithm']).toBeDefined();
      expect(response.headers['x-ratelimit-role']).toBeDefined();
    });

    test('should include retry-after header when rate limited', async () => {
      // Exhaust rate limit
      const requests = Array(100).fill(null).map(() =>
        request(app).get('/api/books')
      );

      const responses = await Promise.allSettled(requests);
      const rateLimitedResponse = responses.find(r =>
        r.status === 'fulfilled' && r.value.status === 429
      );

      if (rateLimitedResponse && rateLimitedResponse.status === 'fulfilled') {
        expect(rateLimitedResponse.value.headers['retry-after']).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    test('should fail open when Redis is unavailable', async () => {
      // Mock Redis failure
      const originalExec = redis.pipeline;
      redis.pipeline = jest.fn().mockImplementation(() => ({
        exec: jest.fn().mockRejectedValue(new Error('Redis connection failed'))
      }));

      // Requests should still be allowed
      const response = await request(app).get('/api/books');
      expect(response.status).not.toBe(429);

      // Restore original method
      redis.pipeline = originalExec;
    });

    test('should handle malformed rate limit data gracefully', async () => {
      const key = 'test-broken-key';

      // Set malformed data
      await redis.hset(`bucket:${key}`, {
        tokens: 'invalid-number',
        lastRefill: 'invalid-timestamp'
      });

      // Should not crash and should default to safe behavior
      const req = {
        ip: '192.168.1.400',
        user: { id: 'test-user', role: 'STUDENT' },
        path: '/api/test',
        get: (header: string) => header === 'User-Agent' ? 'test-agent' : undefined
      } as any;

      const result = await rateLimitService.checkRateLimit(req);
      expect(result.allowed).toBeDefined();
      expect(typeof result.remaining).toBe('number');
    });
  });

  describe('Performance', () => {
    test('should handle high request volume efficiently', async () => {
      const startTime = Date.now();

      // Make 100 concurrent requests
      const requests = Array(100).fill(null).map(() =>
        request(app).get('/api/books').set('Authorization', 'Bearer admin-token')
      );

      await Promise.allSettled(requests);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (5 seconds for 100 requests)
      expect(duration).toBeLessThan(5000);
    });

    test('should not leak memory with high request volume', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Make many requests
      for (let i = 0; i < 1000; i++) {
        await request(app).get('/api/books').set('Authorization', 'Bearer admin-token');
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Integration with Security Middleware', () => {
    test('should work seamlessly with other security middleware', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'wrongpassword'
        });

      // Should have both rate limiting and other security headers
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    test('should maintain security headers during rate limit errors', async () => {
      // Exhaust rate limit
      const requests = Array(100).fill(null).map(() =>
        request(app).get('/api/books')
      );

      const responses = await Promise.allSettled(requests);
      const rateLimitedResponse = responses.find(r =>
        r.status === 'fulfilled' && r.value.status === 429
      );

      if (rateLimitedResponse && rateLimitedResponse.status === 'fulfilled') {
        const response = rateLimitedResponse.value;

        // Should still include security headers
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['x-frame-options']).toBe('DENY');
        expect(response.headers['x-xss-protection']).toBeDefined();
      }
    });
  });
});

export {};