# CLMS Security Implementation Guide

This guide provides comprehensive instructions for implementing the enhanced security features in the CLMS (Comprehensive Library Management System).

## Table of Contents

1. [Overview](#overview)
2. [Installation & Setup](#installation-setup)
3. [Security Components](#security-components)
4. [Integration Steps](#integration-steps)
5. [Configuration](#configuration)
6. [Testing](#testing)
7. [Monitoring & Maintenance](#monitoring-maintenance)
8. [Troubleshooting](#troubleshooting)

## Overview

The CLMS security hardening implementation includes:

- **Enhanced Authentication**: Redis-based rate limiting, advanced session management with refresh tokens, MFA readiness
- **Real-time Security Monitoring**: Automated threat detection, security event monitoring, incident response
- **Data Protection**: Input validation, SQL injection prevention, XSS protection, CSRF protection
- **Infrastructure Security**: Security headers, API endpoint protection, database security, environment variable security
- **Comprehensive Audit Trail**: Complete audit logging with compliance features

## Installation & Setup

### 1. Install Required Dependencies

```bash
npm install express-rate-limit helmet joi bcryptjs jsonwebtoken speakeasy qrcode isomorphic-dompurify redis ioredis
npm install --save-dev @types/bcryptjs @types/jsonwebtoken @types/qrcode
```

### 2. Update Environment Variables

Add these security-related environment variables to your `.env` file:

```env
# Security Configuration
JWT_SECRET=your_secure_64_character_hex_secret_here
JWT_ACCESS_TOKEN_TTL=900
JWT_REFRESH_TOKEN_TTL=604800
BCRYPT_ROUNDS=12

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_AUTH_ENABLED=true

# MFA Configuration
MFA_MAX_ATTEMPTS=3
MFA_LOCKOUT_DURATION=900
MFA_BACKUP_CODE_COUNT=10

# Security Monitoring
SECURITY_MONITORING_ENABLED=true
THREAT_DETECTION_ENABLED=true
INCIDENT_RESPONSE_ENABLED=true

# Database Security
DB_ENCRYPTION_KEY=your_32_byte_hex_encryption_key
ENABLE_QUERY_LOGGING=true
ENABLE_SENSITIVE_DATA_ENCRYPTION=true

# Environment Security
ENCRYPTION_KEY=your_32_byte_hex_encryption_key
ENV_VALIDATION_ENABLED=true
ENV_AUDIT_ENABLED=true

# API Security
API_SECURITY_ENABLED=true
ENABLE_CSRF_PROTECTION=true
ENABLE_INPUT_VALIDATION=true
MAX_REQUEST_SIZE=10485760
```

### 3. Initialize Security Services

In your main application file (`src/app.ts`), add the security initialization:

```typescript
import Redis from 'ioredis';
import {
  RedisRateLimiter,
  SessionManager,
  MFAService,
  SecurityMonitor,
  AuditTrail,
  IncidentResponse,
  APISecurity,
  DatabaseSecurity,
  EnvSecurity,
} from '@/security';

// Initialize Redis client
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Initialize security services
const rateLimiter = new RedisRateLimiter(redis, rateLimitConfig);
const sessionManager = new SessionManager(redis);
const mfaService = new MFAService(redis);
const securityMonitor = new SecurityMonitor(redis);
const auditTrail = new AuditTrail(redis);
const incidentResponse = new IncidentResponse(redis);
const apiSecurity = new APISecurity(redis);
const databaseSecurity = new DatabaseSecurity(prisma);
const envSecurity = new EnvSecurity();
```

## Security Components

### 1. Enhanced Authentication System

#### Redis-based Rate Limiting

```typescript
import {
  createRateLimiter,
  createAuthRateLimiter,
} from '@/security/redis-rate-limiter';

// Apply to your app
const authLimiter = createAuthRateLimiter(redis);
app.use('/api/auth/login', authLimiter.createMiddleware());

const apiLimiter = createRateLimiter(redis, {
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
});
app.use('/api', apiLimiter.createMiddleware());
```

#### Advanced Session Management

```typescript
import { SessionManager } from '@/security/session-manager';

// In your auth routes
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // Authenticate user
  const authResult = await authService.login(username, password);

  if (authResult.success) {
    // Create session with advanced features
    const session = await sessionManager.createSession(
      authResult.user.id,
      authResult.user.username,
      authResult.user.role,
      req.ip,
      req.get('User-Agent') || 'unknown',
    );

    res.json({
      success: true,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      sessionId: session.sessionId,
    });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  const session = await sessionManager.refreshSession(
    refreshToken,
    req.ip,
    req.get('User-Agent') || 'unknown',
  );

  if (session) {
    res.json({
      success: true,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
  } else {
    res.status(401).json({ success: false, error: 'Invalid refresh token' });
  }
});
```

#### Multi-Factor Authentication (MFA)

```typescript
import { MFAService } from '@/security/mfa-service';

// Setup MFA
router.post('/mfa/setup', async (req, res) => {
  const { userId } = req.body;

  const mfaSetup = await mfaService.setupMFA(userId, 'CLMS');

  if (mfaSetup.success) {
    res.json({
      success: true,
      qrCodeUrl: mfaSetup.qrCodeUrl,
      manualEntryKey: mfaSetup.manualEntryKey,
      backupCodes: mfaSetup.backupCodes,
    });
  }
});

// Verify and enable MFA
router.post('/mfa/verify', async (req, res) => {
  const { userId, token, backupCodes } = req.body;

  const result = await mfaService.verifyAndEnableMFA(
    userId,
    token,
    backupCodes,
  );

  res.json(result);
});

// Login with MFA
router.post('/login-with-mfa', async (req, res) => {
  const { username, password, mfaToken } = req.body;

  // First authenticate normally
  const authResult = await authService.login(username, password);

  if (authResult.success) {
    // Check if MFA is required
    const mfaRequired = await mfaService.isMFAEnabled(authResult.user.id);

    if (mfaRequired) {
      // Verify MFA token
      const mfaResult = await mfaService.verifyMFAToken(
        authResult.user.id,
        'session-id',
        mfaToken,
      );

      if (mfaResult.success) {
        // Create session
        const session = await sessionManager.createSession(
          authResult.user.id,
          authResult.user.username,
          authResult.user.role,
          req.ip,
          req.get('User-Agent') || 'unknown',
        );

        res.json({
          success: true,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
        });
      } else {
        res.status(401).json({ success: false, error: 'Invalid MFA token' });
      }
    }
  }
});
```

### 2. Real-time Security Monitoring

```typescript
import {
  securityMonitor,
  SecurityEventType,
} from '@/security/security-monitor';

// Initialize security monitoring
securityMonitor.on('securityEvent', event => {
  console.log('Security event detected:', event);
});

securityMonitor.on('securityAlert', alert => {
  // Send notifications to admins
  sendAdminNotification(alert);
});

securityMonitor.on('forceLogout', data => {
  // Force logout user session
  sessionManager.destroySession(data.sessionId, 'Security policy violation');
});

// Record security events manually
router.post('/suspicious-activity', async (req, res) => {
  await securityMonitor.recordSecurityEvent({
    type: SecurityEventType.SUSPICIOUS_ACTIVITY,
    severity: 'medium',
    userId: req.user?.id,
    sessionId: req.sessionId,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent') || 'unknown',
    timestamp: new Date(),
    details: req.body.details,
    resolved: false,
  });

  res.json({ success: true });
});
```

### 3. Input Validation & XSS Protection

```typescript
import { validateBody, InputValidator } from '@/security/input-validator';

// Define validation rules
const userCreationRules = [
  {
    field: 'username',
    schema: InputValidator.schemas.username,
    required: true,
    sanitize: true,
  },
  {
    field: 'email',
    schema: InputValidator.schemas.email,
    required: true,
    sanitize: true,
  },
  {
    field: 'password',
    schema: InputValidator.schemas.password,
    required: true,
  },
];

// Apply validation middleware
router.post('/users', validateBody(userCreationRules), async (req, res) => {
  // Request is validated and sanitized
  const validatedData = req.body;

  // Process user creation
  const user = await userService.createUser(validatedData);

  res.json({ success: true, user });
});
```

### 4. CSRF Protection

```typescript
import {
  csrfProtection,
  generateCSRFToken,
  validateCSRFToken,
} from '@/security/csrf-protection';

// Apply CSRF protection to state-changing routes
app.use('/api', [generateCSRFToken(), validateCSRFToken()]);

// For SPA support
app.get('/api/csrf-token', (req, res) => {
  const token = req.cookies?._csrf;
  res.json({ csrfToken: token });
});
```

### 5. Security Headers

```typescript
import { enhancedSecurity, securityHeaders } from '@/security/security-headers';

// Apply enhanced security headers
app.use(enhancedSecurity());

// CSP violation reporting
app.post('/api/security/csp-report', securityHeaders.cspViolationHandler());
```

### 6. API Endpoint Security

```typescript
import {
  apiSecurityMiddleware,
  sensitiveEndpointProtection,
} from '@/security/api-security';

// Apply general API security
app.use('/api', apiSecurityMiddleware());

// Enhanced protection for sensitive endpoints
app.use('/api/users', sensitiveEndpointProtection());
app.use('/api/settings', sensitiveEndpointProtection());
app.use('/api/admin', sensitiveEndpointProtection());
```

### 7. Database Security

```typescript
import { databaseSecurity } from '@/security/database-security';

// Execute secure queries
router.get('/secure-data', async (req, res) => {
  const result = await databaseSecurity.executeSecureQuery(
    'SELECT * FROM users WHERE id = ?',
    [req.user.id],
    {
      userId: req.user.id,
      sessionId: req.sessionId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  );

  res.json({ success: true, data: result });
});

// Check database security health
router.get('/admin/database-security-health', async (req, res) => {
  const health = await databaseSecurity.checkSecurityHealth();
  res.json(health);
});
```

### 8. Environment Variable Security

```typescript
import { envSecurity, getEnv, validateEnv } from '@/security/env-security';

// Validate environment on startup
const validation = validateEnv();
if (!validation.isValid) {
  console.error('Environment validation failed:', validation);
  process.exit(1);
}

// Use secure environment access
const jwtSecret = getEnv('JWT_SECRET');
const dbUrl = getEnv('DATABASE_URL');

// Generate secure configuration
const secureConfig = envSecurity.generateSecureConfig();
console.log('Secure config generated:', secureConfig);
```

## Integration Steps

### Step 1: Update Prisma Schema

Add security-related tables to your `schema.prisma`:

```prisma
model SecurityEvent {
  id        String   @id @default(cuid())
  type      String
  severity  String
  userId    String?
  sessionId String?
  ipAddress String
  userAgent String
  timestamp DateTime @default(now())
  details   Json
  resolved  Boolean  @default(false)

  @@map("security_events")
}

model UserMFA {
  id           String   @id @default(cuid())
  userId       String   @unique
  secret       String
  backupCodes  String
  isActive     Boolean  @default(true)
  enabledAt    DateTime @default(now())
  lastUsed     DateTime?
  disabledAt   DateTime?

  @@map("user_mfa")
}
```

### Step 2: Update Authentication Middleware

```typescript
// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { sessionManager } from '@/security/session-manager';

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access denied' });
    }

    const token = authHeader.substring(7);

    // Verify token and get session
    const decoded = authService.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    // Get session data
    const session = await sessionManager.getSession(decoded.sessionId);
    if (!session || !session.totpVerified) {
      return res
        .status(401)
        .json({ success: false, message: 'Invalid session' });
    }

    req.user = decoded;
    req.sessionId = decoded.sessionId;

    next();
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: 'Authentication error' });
  }
};
```

### Step 3: Add Security Routes

Create `src/routes/security.ts`:

```typescript
import { Router } from 'express';
import { securityMonitor } from '@/security/security-monitor';
import { auditTrail } from '@/security/audit-trail';
import { incidentResponse } from '@/security/incident-response';
import { databaseSecurity } from '@/security/database-security';
import { envSecurity } from '@/security/env-security';

const router = Router();

// Security monitoring endpoints
router.get('/events', async (req, res) => {
  const events = await securityMonitor.getSecurityEvents(req.query);
  res.json({ success: true, events });
});

router.get('/stats', async (req, res) => {
  const stats = await securityMonitor.getSecurityStats();
  res.json({ success: true, stats });
});

// Audit trail endpoints
router.get('/audit', async (req, res) => {
  const events = await auditTrail.queryEvents(req.query);
  res.json({ success: true, events });
});

router.get('/audit/compliance', async (req, res) => {
  const { startDate, endDate } = req.query;
  const report = await auditTrail.generateComplianceReport(
    new Date(startDate as string),
    new Date(endDate as string),
  );
  res.json({ success: true, report });
});

// Incident response endpoints
router.get('/incidents', async (req, res) => {
  const incidents = await incidentResponse.getIncidents(req.query);
  res.json({ success: true, incidents });
});

router.post('/incidents', async (req, res) => {
  const { type, severity, title, description, indicators, affectedAssets } =
    req.body;

  const incidentId = await incidentResponse.createIncident(
    type,
    severity,
    title,
    description,
    req.user.id,
    indicators,
    affectedAssets,
  );

  res.json({ success: true, incidentId });
});

// Database security endpoints
router.get('/database/health', async (req, res) => {
  const health = await databaseSecurity.checkSecurityHealth();
  res.json({ success: true, health });
});

router.post('/database/backup', async (req, res) => {
  const backupPath = await databaseSecurity.createSecureBackup(req.body.path);
  res.json({ success: true, backupPath });
});

// Environment security endpoints
router.get('/environment/security-report', async (req, res) => {
  const report = envSecurity.getSecurityReport();
  res.json({ success: true, report });
});

export default router;
```

### Step 4: Update Main Application

```typescript
// src/app.ts
import express from 'express';
import { enhancedSecurity } from '@/security/security-headers';
import { apiSecurityMiddleware } from '@/security/api-security';
import { auditMiddleware } from '@/security/audit-trail';

// Apply security middleware
app.use(enhancedSecurity());
app.use('/api', apiSecurityMiddleware());
app.use(auditMiddleware());

// Add security routes
app.use('/api/security', authMiddleware, securityRoutes);

// Error handling
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  // Log security incidents
  if (
    error.message.includes('security') ||
    error.message.includes('authentication')
  ) {
    await securityMonitor.recordSecurityEvent({
      type: SecurityEventType.SECURITY_POLICY_VIOLATION,
      severity: SecuritySeverity.HIGH,
      userId: (req as any).user?.id,
      sessionId: (req as any).sessionId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || 'unknown',
      timestamp: new Date(),
      details: { error: error.message, path: req.path },
      resolved: false,
    });
  }

  next(error);
});
```

## Configuration

### Production Security Checklist

- [ ] Set strong JWT_SECRET (64+ characters)
- [ ] Enable Redis for session management
- [ ] Configure rate limiting appropriately
- [ ] Enable MFA for all admin accounts
- [ ] Set up security monitoring alerts
- [ ] Configure backup encryption
- [ ] Enable audit logging
- [ ] Set up log rotation
- [ ] Configure security headers
- [ ] Enable HTTPS only
- [ ] Set up intrusion detection
- [ ] Configure database security

### Environment Variables

```env
# Production Configuration
NODE_ENV=production
JWT_SECRET=your_very_long_and_secure_random_secret_here
ENCRYPTION_KEY=your_32_byte_hex_encryption_key
REDIS_URL=redis://your-production-redis:6379

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_AUTH_ENABLED=true

# Security Monitoring
SECURITY_MONITORING_ENABLED=true
THREAT_DETECTION_ENABLED=true
INCIDENT_RESPONSE_ENABLED=true

# Database Security
DB_ENCRYPTION_KEY=your_32_byte_hex_encryption_key
ENABLE_QUERY_LOGGING=true
ENABLE_SENSITIVE_DATA_ENCRYPTION=true

# API Security
API_SECURITY_ENABLED=true
ENABLE_CSRF_PROTECTION=true
ENABLE_INPUT_VALIDATION=true
MAX_REQUEST_SIZE=10485760
```

## Testing

### Security Testing

```typescript
// tests/security.test.ts
import request from 'supertest';
import { app } from '../src/app';

describe('Security Features', () => {
  test('should block SQL injection attempts', async () => {
    const maliciousInput = "'; DROP TABLE users; --";

    const response = await request(app)
      .post('/api/users')
      .send({ username: maliciousInput, password: 'test123' })
      .expect(400);

    expect(response.body.error).toContain('malicious content');
  });

  test('should enforce rate limiting', async () => {
    // Make multiple rapid requests
    const requests = Array(10)
      .fill(null)
      .map(() =>
        request(app)
          .post('/api/auth/login')
          .send({ username: 'test', password: 'wrong' }),
      );

    const responses = await Promise.all(requests);

    // Should hit rate limit
    const blockedResponse = responses.find(r => r.status === 429);
    expect(blockedResponse).toBeDefined();
  });

  test('should require CSRF token for state changes', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ username: 'test', password: 'test123' })
      .expect(403);

    expect(response.body.error).toContain('CSRF token required');
  });

  test('should validate input formats', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({
        username: 'invalid username with spaces!',
        email: 'not-an-email',
        password: '123', // too short
      })
      .expect(400);

    expect(response.body.details).toBeDefined();
  });
});
```

### Penetration Testing

1. **Authentication Testing**
   - Test brute force protection
   - Test session hijacking prevention
   - Test MFA bypass attempts

2. **Input Validation Testing**
   - Test SQL injection attempts
   - Test XSS payload injection
   - Test CSRF token validation

3. **API Security Testing**
   - Test rate limiting bypass
   - Test authentication bypass
   - Test authorization bypass

4. **Infrastructure Testing**
   - Test security headers
   - Test HTTPS enforcement
   - Test cookie security

## Monitoring & Maintenance

### Security Monitoring Dashboard

```typescript
// src/services/security-dashboard.ts
export class SecurityDashboard {
  async getDashboardData() {
    const [securityStats, incidentStats, auditStats, databaseHealth] =
      await Promise.all([
        securityMonitor.getSecurityStats(),
        incidentResponse.getIncidentStats(),
        auditTrail.getRecentEvents(24),
        databaseSecurity.checkSecurityHealth(),
      ]);

    return {
      security: securityStats,
      incidents: incidentStats,
      audit: auditStats,
      database: databaseHealth,
      lastUpdated: new Date(),
    };
  }

  async getRealTimeAlerts() {
    return await securityMonitor.getSecurityEvents({
      severity: ['high', 'critical'],
      startDate: new Date(Date.now() - 60 * 60 * 1000), // Last hour
      limit: 50,
    });
  }
}
```

### Automated Security Scans

```bash
# Add to package.json scripts
{
  "scripts": {
    "security:scan": "npm audit && nsp check",
    "security:test": "jest --testPathPattern=security",
    "security:headers": "curl -I https://your-domain.com/api/health",
    "security:ssl": "ssl-check --host your-domain.com --port 443"
  }
}
```

## Troubleshooting

### Common Issues

1. **Redis Connection Issues**

   ```
   Error: Redis connection failed
   ```

   **Solution**: Check Redis configuration and ensure Redis server is running

2. **JWT Token Issues**

   ```
   Error: Invalid JWT token
   ```

   **Solution**: Verify JWT_SECRET is consistent across all services

3. **Rate Limiting Too Strict**

   ```
   Error: Too many requests
   ```

   **Solution**: Adjust rate limiting configuration based on traffic patterns

4. **MFA Setup Issues**
   ```
   Error: MFA verification failed
   ```
   **Solution**: Check system time synchronization and MFA secret

### Debug Mode

Enable security debugging in development:

```typescript
// src/config/security-debug.ts
export const securityDebug = {
  enabled: process.env.NODE_ENV === 'development',
  logLevel: 'debug',
  includeSensitiveData: false,
};
```

### Security Incident Response

1. **Immediate Actions**
   - Block suspicious IP addresses
   - Terminate suspicious sessions
   - Enable enhanced monitoring

2. **Investigation**
   - Review audit logs
   - Analyze security events
   - Identify affected systems

3. **Recovery**
   - Patch vulnerabilities
   - Update security configurations
   - Monitor for recurrence

This comprehensive security implementation provides enterprise-grade protection for the CLMS system while maintaining usability and performance.
