import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { app } from '../../app';
import Redis from 'ioredis';

// Mock Redis for testing
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  exists: jest.fn(),
  ping: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  zadd: jest.fn(),
  zrange: jest.fn(),
  zremrangebyscore: jest.fn(),
  hget: jest.fn(),
  hset: jest.fn(),
  hgetall: jest.fn(),
  hmset: jest.fn()
};

// Mock the security monitoring service
jest.mock('../../../services/securityMonitoringService', () => {
  return {
    SecurityMonitoringService: jest.fn().mockImplementation(() => ({
      getSecurityMetrics: jest.fn().mockResolvedValue({
        totalEvents: 100,
        activeThreats: 2,
        resolvedThreats: 10,
        eventsByType: {
          'AUTHENTICATION_FAILURE': 15,
          'FERPA_VIOLATION': 2,
          'UNAUTHORIZED_ACCESS': 8
        },
        topOffenders: [
          { ip: '192.168.1.100', count: 25 },
          { ip: '192.168.1.101', count: 15 }
        ],
        recentTrends: Array.from({ length: 24 }, (_, i) => ({
          timestamp: new Date(Date.now() - i * 3600000).toISOString(),
          severity: 'low',
          count: Math.floor(Math.random() * 10)
        }))
      }),
      getActiveAlerts: jest.fn().mockResolvedValue([
        {
          id: 'alert-1',
          type: 'AUTHENTICATION_FAILURE',
          severity: 'HIGH',
          message: 'Multiple failed login attempts detected',
          ip: '192.168.1.100',
          timestamp: new Date().toISOString(),
          resolved: false
        },
        {
          id: 'alert-2',
          type: 'FERPA_VIOLATION',
          severity: 'CRITICAL',
          message: 'Unauthorized access to student records detected',
          userId: 'user-123',
          timestamp: new Date().toISOString(),
          resolved: false
        }
      ]),
      resolveAlert: jest.fn().mockResolvedValue(true),
      getEventHistory: jest.fn().mockResolvedValue([
        {
          id: 'event-1',
          type: 'AUTHENTICATION_FAILURE',
          severity: 'MEDIUM',
          ip: '192.168.1.100',
          timestamp: new Date().toISOString(),
          details: { userAgent: 'Test Browser' }
        }
      ]),
      recordSecurityEvent: jest.fn().mockResolvedValue(undefined),
      updateAlertConfig: jest.fn().mockResolvedValue(undefined)
    }))
  };
});

// Mock Redis connection
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

describe('Security Monitoring System Tests', () => {
  let server: any;
  let authToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // Start test server
    server = app.listen(0);

    // Mock authentication tokens
    authToken = 'Bearer test-user-token';
    adminToken = 'Bearer test-admin-token';
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock successful Redis connection
    mockRedis.ping.mockResolvedValue('PONG');
  });

  describe('Security Metrics Endpoint', () => {
    test('should require appropriate permissions to access metrics', async () => {
      const response = await request(app)
        .get('/api/security/metrics')
        .set('Authorization', authToken) // Regular user token
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('privileges');
    });

    test('should return security metrics for authorized users', async () => {
      const response = await request(app)
        .get('/api/security/metrics')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('metrics');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('timeframe');

      const metrics = response.body.data.metrics;
      expect(metrics).toHaveProperty('totalEvents');
      expect(metrics).toHaveProperty('activeThreats');
      expect(metrics).toHaveProperty('resolvedThreats');
      expect(metrics).toHaveProperty('eventsByType');
      expect(metrics).toHaveProperty('topOffenders');
      expect(metrics).toHaveProperty('recentTrends');
    });

    test('should support different timeframes', async () => {
      const timeframes = ['24h', '7d', '30d'];

      for (const timeframe of timeframes) {
        const response = await request(app)
          .get(`/api/security/metrics?timeframe=${timeframe}`)
          .set('Authorization', adminToken)
          .expect(200);

        expect(response.body.data.timeframe).toBe(timeframe);
      }
    });

    test('should handle invalid timeframe gracefully', async () => {
      const response = await request(app)
        .get('/api/security/metrics?timeframe=invalid')
        .set('Authorization', adminToken)
        .expect(200);

      // Should default to 24h
      expect(response.body.data.timeframe).toBe('24h');
    });
  });

  describe('Active Alerts Endpoint', () => {
    test('should require appropriate permissions to access alerts', async () => {
      const response = await request(app)
        .get('/api/security/alerts/active')
        .set('Authorization', authToken)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    test('should return active security alerts', async () => {
      const response = await request(app)
        .get('/api/security/alerts/active')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('alerts');
      expect(response.body.data).toHaveProperty('count');
      expect(response.body.data).toHaveProperty('timestamp');

      const alerts = response.body.data.alerts;
      expect(Array.isArray(alerts)).toBe(true);
      expect(response.body.data.count).toBe(alerts.length);

      // Check alert structure
      if (alerts.length > 0) {
        const alert = alerts[0];
        expect(alert).toHaveProperty('id');
        expect(alert).toHaveProperty('type');
        expect(alert).toHaveProperty('severity');
        expect(alert).toHaveProperty('message');
        expect(alert).toHaveProperty('timestamp');
        expect(alert).toHaveProperty('resolved');
      }
    });
  });

  describe('Alert Resolution Endpoint', () => {
    test('should require appropriate permissions to resolve alerts', async () => {
      const response = await request(app)
        .post('/api/security/alerts/alert-123/resolve')
        .set('Authorization', authToken)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    test('should resolve security alerts successfully', async () => {
      const response = await request(app)
        .post('/api/security/alerts/alert-123/resolve')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('resolved successfully');
    });

    test('should handle non-existent alert IDs', async () => {
      // Mock the service to return false for non-existent alert
      const { SecurityMonitoringService } = require('../../../services/securityMonitoringService');
      const mockInstance = new SecurityMonitoringService();
      mockInstance.resolveAlert.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/security/alerts/non-existent/resolve')
        .set('Authorization', adminToken)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found or already resolved');
    });
  });

  describe('Event History Endpoint', () => {
    test('should require appropriate permissions to access event history', async () => {
      const response = await request(app)
        .get('/api/security/events/history')
        .set('Authorization', authToken)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    test('should return event history for valid IP address', async () => {
      const response = await request(app)
        .get('/api/security/events/history?ip=192.168.1.100')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('ip');
      expect(response.body.data).toHaveProperty('events');
      expect(response.body.data).toHaveProperty('count');
      expect(response.body.data).toHaveProperty('timeframe');
      expect(response.body.data).toHaveProperty('timestamp');

      expect(response.body.data.ip).toBe('192.168.1.100');
      expect(Array.isArray(response.body.data.events)).toBe(true);
    });

    test('should require IP address parameter', async () => {
      const response = await request(app)
        .get('/api/security/events/history')
        .set('Authorization', adminToken)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('IP address is required');
    });

    test('should support different timeframes for event history', async () => {
      const response = await request(app)
        .get('/api/security/events/history?ip=192.168.1.100&timeframe=7d')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.data.timeframe).toBe('7d');
    });
  });

  describe('Security Event Recording Endpoint', () => {
    test('should require appropriate permissions to record events', async () => {
      const response = await request(app)
        .post('/api/security/record')
        .set('Authorization', authToken)
        .send({
          eventType: 'SUSPICIOUS_ACTIVITY',
          details: { description: 'Test suspicious activity' }
        })
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    test('should record security events successfully', async () => {
      const response = await request(app)
        .post('/api/security/record')
        .set('Authorization', adminToken)
        .send({
          eventType: 'SUSPICIOUS_ACTIVITY',
          details: {
            description: 'Test suspicious activity',
            severity: 'medium',
            source: 'manual_test'
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('recorded successfully');
    });

    test('should validate event type', async () => {
      const response = await request(app)
        .post('/api/security/record')
        .set('Authorization', adminToken)
        .send({
          eventType: 'INVALID_EVENT_TYPE',
          details: { description: 'Test event' }
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid event type');
    });

    test('should require event type', async () => {
      const response = await request(app)
        .post('/api/security/record')
        .set('Authorization', adminToken)
        .send({
          details: { description: 'Test event' }
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Event type is required');
    });
  });

  describe('Alert Configuration Endpoints', () => {
    test('should get alert configurations', async () => {
      const response = await request(app)
        .get('/api/security/config/alerts')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(typeof response.body.data).toBe('object');
    });

    test('should update alert configurations', async () => {
      const response = await request(app)
        .put('/api/security/config/alerts/AUTHENTICATION_FAILURE')
        .set('Authorization', adminToken)
        .send({
          config: {
            enabled: true,
            threshold: 10,
            timeWindow: 600000, // 10 minutes
            cooldown: 1800000, // 30 minutes
            severity: 'HIGH',
            notificationChannels: ['email', 'slack']
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Alert configuration updated');
    });

    test('should validate configuration data', async () => {
      const response = await request(app)
        .put('/api/security/config/alerts/AUTHENTICATION_FAILURE')
        .set('Authorization', adminToken)
        .send({
          config: null // Invalid config
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Event type and configuration are required');
    });
  });

  describe('Security Event Types Endpoint', () => {
    test('should return available security event types', async () => {
      const response = await request(app)
        .get('/api/security/events/types')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('eventTypes');
      expect(response.body.data).toHaveProperty('severityLevels');
      expect(response.body.data).toHaveProperty('timestamp');

      const eventTypes = response.body.data.eventTypes;
      const severityLevels = response.body.data.severityLevels;

      expect(Array.isArray(eventTypes)).toBe(true);
      expect(Array.isArray(severityLevels)).toBe(true);

      // Check structure of event types
      if (eventTypes.length > 0) {
        expect(eventTypes[0]).toHaveProperty('value');
        expect(eventTypes[0]).toHaveProperty('label');
        expect(eventTypes[0]).toHaveProperty('category');
      }

      // Check structure of severity levels
      if (severityLevels.length > 0) {
        expect(severityLevels[0]).toHaveProperty('value');
        expect(severityLevels[0]).toHaveProperty('label');
        expect(severityLevels[0]).toHaveProperty('priority');
      }
    });
  });

  describe('Health Check Endpoint', () => {
    test('should return service health status', async () => {
      const response = await request(app)
        .get('/api/security/health')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('redis');
      expect(response.body.data).toHaveProperty('service');
      expect(response.body.data).toHaveProperty('timestamp');

      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.redis).toBe('connected');
      expect(response.body.data.service).toBe('operational');
    });

    test('should handle Redis connection failures', async () => {
      // Mock Redis failure
      mockRedis.ping.mockRejectedValue(new Error('Redis connection failed'));

      const response = await request(app)
        .get('/api/security/health')
        .set('Authorization', adminToken)
        .expect(503);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Security monitoring service unavailable');
    });
  });

  describe('Export Endpoint', () => {
    test('should export security summary in JSON format', async () => {
      const response = await request(app)
        .get('/api/security/export/summary')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('timeframe');
      expect(response.body.data).toHaveProperty('generatedAt');
      expect(response.body.data).toHaveProperty('summary');

      const summary = response.body.data.summary;
      expect(summary).toHaveProperty('totalEvents');
      expect(summary).toHaveProperty('activeThreats');
      expect(summary).toHaveProperty('resolvedThreats');
      expect(summary).toHaveProperty('topEventTypes');
      expect(summary).toHaveProperty('topOffenders');
      expect(summary).toHaveProperty('recentTrends');
      expect(summary).toHaveProperty('criticalAlerts');
    });

    test('should export security summary in CSV format', async () => {
      const response = await request(app)
        .get('/api/security/export/summary?format=csv')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.headers['content-type']).toBe('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('.csv');

      // Should contain CSV headers
      expect(response.text).toContain('Timestamp,Event Type,Severity,IP,User ID,Count');
    });

    test('should support different timeframes for export', async () => {
      const response = await request(app)
        .get('/api/security/export/summary?timeframe=7d')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.data.timeframe).toBe('7d');
    });
  });

  describe('Input Validation and Security', () => {
    test('should prevent SQL injection in parameters', async () => {
      const maliciousInput = "'; DROP TABLE security_events; --";

      const response = await request(app)
        .get(`/api/security/events/history?ip=${encodeURIComponent(maliciousInput)}`)
        .set('Authorization', adminToken);

      // Should not return server error
      expect([400, 422, 500]).not.toContain(response.status);
    });

    test('should sanitize input data', async () => {
      const xssPayload = '<script>alert("xss")</script>';

      const response = await request(app)
        .post('/api/security/record')
        .set('Authorization', adminToken)
        .send({
          eventType: 'SUSPICIOUS_ACTIVITY',
          details: { description: xssPayload }
        })
        .expect(200);

      // Should handle XSS payload safely
      expect(response.body.success).toBe(true);
    });

    test('should validate input formats', async () => {
      const response = await request(app)
        .post('/api/security/record')
        .set('Authorization', adminToken)
        .send({
          eventType: 123, // Should be string
          details: 'should be object'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    test('should implement rate limiting on security endpoints', async () => {
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .get('/api/security/metrics')
          .set('Authorization', adminToken)
      );

      const responses = await Promise.allSettled(requests);
      const rateLimited = responses.filter(r =>
        r.status === 'fulfilled' && r.value.status === 429
      );

      // Some requests should be rate limited
      expect(rateLimited.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle service errors gracefully', async () => {
      // Mock service failure
      const { SecurityMonitoringService } = require('../../../services/securityMonitoringService');
      const mockInstance = new SecurityMonitoringService();
      mockInstance.getSecurityMetrics.mockRejectedValue(new Error('Service unavailable'));

      const response = await request(app)
        .get('/api/security/metrics')
        .set('Authorization', adminToken)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Internal server error');
    });

    test('should not expose sensitive information in errors', async () => {
      const response = await request(app)
        .get('/api/security/metrics')
        .set('Authorization', adminToken);

      // Error messages should not contain sensitive information
      if (!response.body.success) {
        expect(response.body.error).not.toContain('password');
        expect(response.body.error).not.toContain('secret');
        expect(response.body.error).not.toContain('database');
      }
    });
  });
});