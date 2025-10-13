# Security and Error Handling Guide

## Overview

CLMS implements enterprise-grade security and comprehensive error handling systems to ensure data protection, system reliability, and operational resilience. This guide covers security features, error handling mechanisms, audit trails, and best practices for maintaining a secure and stable library management system.

## Security Features Documentation

### Authentication and Authorization

#### JWT-Based Authentication
- **Token Structure**: HMAC SHA-256 signed tokens with user claims
- **Expiration**: Default 24-hour token lifetime with refresh capability
- **Secure Storage**: HttpOnly cookies for web, secure storage for mobile
- **Token Refresh**: Automatic refresh before expiration

**Token Claims:**
```javascript
{
  "sub": "user_123",
  "username": "john_doe",
  "role": "LIBRARIAN",
  "permissions": ["students:read", "students:write", "equipment:manage"],
  "iat": 1697234400,
  "exp": 1697320800,
  "iss": "clms-api",
  "aud": "clms-client"
}
```

#### Role-Based Access Control (RBAC)
**Hierarchy of Roles:**
1. **SUPER_ADMIN**: Full system access, user management, system configuration
2. **ADMIN**: All operations except user role management
3. **LIBRARIAN**: Standard library operations, student management, equipment booking
4. **ASSISTANT**: Limited operations, read access, basic student interactions
5. **TEACHER**: Read-only access to class-specific data, reports
6. **VIEWER**: Read-only access to public data only

**Permission System:**
```javascript
// 70+ granular permissions across 13 categories
const permissions = {
  "students": ["read", "write", "delete"],
  "books": ["read", "write", "delete", "checkout", "return"],
  "equipment": ["read", "write", "manage", "book"],
  "activities": ["read", "write", "delete"],
  "users": ["read", "write", "delete", "manage_roles"],
  "reports": ["read", "generate", "export"],
  "settings": ["read", "write", "system_config"],
  "audit": ["read", "export"],
  "backups": ["create", "restore", "schedule"],
  "notifications": ["read", "write", "send"],
  "analytics": ["read", "generate", "export"],
  "automation": ["read", "write", "manage"]
};
```

### Advanced Security Features

#### Multi-Factor Authentication (MFA) Ready
- **TOTP Support**: Time-based one-time passwords
- **SMS Backup**: SMS verification as secondary factor
- **Recovery Codes**: Backup codes for account recovery
- **Device Management**: Trusted device registration

#### Session Management
- **Secure Sessions**: Server-side session storage with Redis
- **Session Timeout**: Configurable inactivity timeout (default: 30 minutes)
- **Concurrent Sessions**: Limit simultaneous sessions per user
- **Session Revocation**: Immediate session invalidation on logout

**Session Configuration:**
```javascript
{
  "session": {
    "secret": "your-secret-key",
    "resave": false,
    "saveUninitialized": false,
    "cookie": {
      "secure": true,
      "httpOnly": true,
      "maxAge": 1800000, // 30 minutes
      "sameSite": "strict"
    },
    "store": {
      "type": "redis",
      "host": "localhost",
      "port": 6379,
      "ttl": 1800
    }
  }
}
```

#### Rate Limiting and DDoS Protection
- **IP-Based Limiting**: 100 requests per minute per IP
- **User-Based Limiting**: 200 requests per minute per user
- **Endpoint-Specific Limits**: Stricter limits for sensitive operations
- **Progressive Delays**: Exponential backoff for repeated violations

**Rate Limiting Configuration:**
```javascript
{
  "rateLimits": {
    "global": {
      "windowMs": 60000, // 1 minute
      "max": 100,
      "message": "Too many requests from this IP"
    },
    "auth": {
      "windowMs": 900000, // 15 minutes
      "max": 5,
      "skipSuccessfulRequests": true
    },
    "api": {
      "windowMs": 60000,
      "max": 200,
      "keyGenerator": (req) => req.user?.id || req.ip
    }
  }
}
```

#### Data Encryption
- **Transport Encryption**: TLS 1.3 for all API communications
- **Data at Rest**: AES-256 encryption for sensitive data
- **Password Hashing**: bcrypt with 12 rounds
- **API Key Encryption**: Encrypted storage for external service keys

#### Security Headers
```javascript
{
  "helmet": {
    "contentSecurityPolicy": {
      "directives": {
        "defaultSrc": ["'self'"],
        "scriptSrc": ["'self'", "'unsafe-inline'"],
        "styleSrc": ["'self'", "'unsafe-inline'"],
        "imgSrc": ["'self'", "data:", "https:"]
      }
    },
    "hsts": {
      "maxAge": 31536000,
      "includeSubDomains": true,
      "preload": true
    },
    "noSniff": true,
    "frameguard": { "action": "deny" },
    "xssFilter": true
  }
}
```

### Threat Detection and Prevention

#### Real-time Threat Detection
- **Suspicious Login Patterns**: Unusual geographic locations, times
- **Brute Force Detection**: Multiple failed login attempts
- **Anomalous API Usage**: Unusual request patterns or volumes
- **Data Access Monitoring**: Access to sensitive data tracking

**Threat Detection Rules:**
```javascript
{
  "threats": {
    "bruteForce": {
      "enabled": true,
      "threshold": 5,
      "windowMs": 900000, // 15 minutes
      "action": "block_ip"
    },
    "suspiciousLocation": {
      "enabled": true,
      "maxDistance": 1000, // km
      "action": "require_mfa"
    },
    "unusualActivity": {
      "enabled": true,
      "baselineDays": 30,
      "threshold": 3, // standard deviations
      "action": "alert_admin"
    }
  }
}
```

#### Security Audit Logging
- **Complete Audit Trail**: All user actions logged with context
- **Security Events**: Failed logins, permission changes, admin actions
- **Data Access Logs**: Who accessed what data and when
- **Change Tracking**: Before/after values for all modifications

## Error Handling System Guide

### Global Error Handling Architecture

#### Frontend Error Boundary System
**Enhanced ErrorBoundary Component:**
```javascript
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      errorType: null,
      suggestions: []
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo,
      errorType: this.categorizeError(error),
      suggestions: this.generateRecoverySuggestions(error)
    });

    // Report error to backend
    this.reportError(error, errorInfo);

    // Attempt auto-recovery
    if (this.state.retryCount < this.props.maxRetries) {
      this.attemptAutoRecovery(error);
    }
  }

  categorizeError(error) {
    if (error.message.includes('Network Error')) return 'NETWORK';
    if (error.message.includes('401') || error.message.includes('403')) return 'AUTHENTICATION';
    if (error.message.includes('400') || error.message.includes('422')) return 'VALIDATION';
    if (error.message.includes('timeout')) return 'TIMEOUT';
    return 'UNKNOWN';
  }

  generateRecoverySuggestions(error) {
    const suggestions = [];
    const errorType = this.categorizeError(error);

    switch (errorType) {
      case 'NETWORK':
        suggestions.push('Check your internet connection');
        suggestions.push('Try refreshing the page');
        suggestions.push('Contact your network administrator');
        break;
      case 'AUTHENTICATION':
        suggestions.push('Log out and log back in');
        suggestions.push('Check if your session has expired');
        suggestions.push('Contact your administrator');
        break;
      case 'VALIDATION':
        suggestions.push('Check your input data');
        suggestions.push('Ensure all required fields are filled');
        suggestions.push('Contact support if the issue persists');
        break;
      case 'TIMEOUT':
        suggestions.push('Try again in a few moments');
        suggestions.push('Check if the server is responding');
        suggestions.push('Contact support if timeouts persist');
        break;
      default:
        suggestions.push('Try refreshing the page');
        suggestions.push('Contact support if the issue continues');
    }

    return suggestions;
  }

  async attemptAutoRecovery(error) {
    const errorType = this.categorizeError(error);

    switch (errorType) {
      case 'NETWORK':
        // Retry with exponential backoff
        const delay = Math.pow(2, this.state.retryCount) * 1000;
        setTimeout(() => {
          this.setState(prevState => ({ retryCount: prevState.retryCount + 1 }));
          window.location.reload();
        }, delay);
        break;

      case 'AUTHENTICATION':
        // Attempt to refresh token
        try {
          await this.refreshAuthToken();
          this.setState({ hasError: false, error: null, retryCount: 0 });
        } catch (refreshError) {
          // Redirect to login
          window.location.href = '/login';
        }
        break;

      default:
        // Generic retry
        if (this.state.retryCount < 3) {
          setTimeout(() => {
            this.setState(prevState => ({
              retryCount: prevState.retryCount + 1,
              hasError: false,
              error: null
            }));
          }, 2000);
        }
    }
  }

  async reportError(error, errorInfo) {
    try {
      await fetch('/api/errors/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: {
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            type: this.state.errorType,
            userAgent: navigator.userAgent,
            url: window.location.href,
            timestamp: new Date().toISOString(),
            userId: this.getCurrentUserId(),
            sessionId: this.getSessionId()
          }
        })
      });
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>We're sorry, but something unexpected happened.</p>

          <div className="error-suggestions">
            <h3>What you can try:</h3>
            <ul>
              {this.state.suggestions.map((suggestion, index) => (
                <li key={index}>{suggestion}</li>
              ))}
            </ul>
          </div>

          <div className="error-actions">
            <button onClick={() => window.location.reload()}>
              Refresh Page
            </button>
            <button onClick={() => this.setState({ hasError: false })}>
              Try Again
            </button>
            <button onClick={() => window.location.href = '/support'}>
              Contact Support
            </button>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <details className="error-details">
              <summary>Error Details (Development)</summary>
              <pre>{this.state.error?.stack}</pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
```

#### Backend Enhanced Error Middleware
```javascript
class EnhancedErrorHandler {
  constructor() {
    this.errorCategories = {
      AUTHENTICATION: 'Authentication and authorization errors',
      AUTHORIZATION: 'Permission and access control issues',
      VALIDATION: 'Input validation and data format errors',
      DATABASE: 'Database connection and query failures',
      NETWORK: 'Network connectivity and timeout issues',
      EXTERNAL_SERVICE: 'Third-party service integration failures',
      BUSINESS_LOGIC: 'Application business rule violations',
      SYSTEM: 'System-level errors and resource issues',
      PERFORMANCE: 'Performance degradation and timeout errors'
    };

    this.severityLevels = {
      CRITICAL: 'System-down errors requiring immediate attention',
      HIGH: 'Significant errors impacting functionality',
      MEDIUM: 'Errors that degrade user experience',
      LOW: 'Minor errors with minimal impact'
    };
  }

  handleError(error, req, res, next) {
    // Categorize error
    const category = this.categorizeError(error);
    const severity = this.determineSeverity(error, category);

    // Enhance error with context
    const enhancedError = this.enhanceError(error, req, category, severity);

    // Log error
    this.logError(enhancedError, req);

    // Attempt recovery
    const recovery = this.attemptRecovery(error, category);
    if (recovery.success) {
      return res.json(recovery.response);
    }

    // Send appropriate response
    const response = this.formatErrorResponse(enhancedError);
    res.status(enhancedError.statusCode || 500).json(response);

    // Trigger recovery workflows
    this.triggerRecoveryWorkflows(enhancedError, req);
  }

  categorizeError(error) {
    if (error.name === 'ValidationError') return 'VALIDATION';
    if (error.name === 'UnauthorizedError') return 'AUTHENTICATION';
    if (error.name === 'ForbiddenError') return 'AUTHORIZATION';
    if (error.name === 'DatabaseError') return 'DATABASE';
    if (error.name === 'NetworkError') return 'NETWORK';
    if (error.name === 'ExternalServiceError') return 'EXTERNAL_SERVICE';
    if (error.name === 'BusinessLogicError') return 'BUSINESS_LOGIC';
    if (error.name === 'SystemError') return 'SYSTEM';
    if (error.name === 'PerformanceError') return 'PERFORMANCE';

    return 'UNKNOWN';
  }

  determineSeverity(error, category) {
    // Determine severity based on error type and impact
    const criticalCategories = ['SYSTEM', 'DATABASE'];
    const highCategories = ['AUTHENTICATION', 'BUSINESS_LOGIC'];
    const mediumCategories = ['NETWORK', 'EXTERNAL_SERVICE', 'PERFORMANCE'];

    if (criticalCategories.includes(category)) return 'CRITICAL';
    if (highCategories.includes(category)) return 'HIGH';
    if (mediumCategories.includes(category)) return 'MEDIUM';

    return 'LOW';
  }

  enhanceError(error, req, category, severity) {
    return {
      ...error,
      category,
      severity,
      timestamp: new Date().toISOString(),
      requestId: req.id,
      userId: req.user?.id,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      endpoint: req.path,
      method: req.method,
      body: this.sanitizeRequestBody(req.body),
      query: req.query,
      headers: this.sanitizeHeaders(req.headers),
      stack: error.stack,
      message: error.message,
      statusCode: this.getStatusCode(error, category)
    };
  }

  async logError(error, req) {
    const logEntry = {
      level: this.getLogLevel(error.severity),
      message: `${error.category}: ${error.message}`,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        category: error.category,
        severity: error.severity
      },
      request: {
        id: error.requestId,
        method: req.method,
        url: req.url,
        ip: error.ip,
        userAgent: error.userAgent,
        userId: error.userId
      },
      timestamp: error.timestamp
    };

    // Log to file/monitoring service
    logger.error(logEntry);

    // Store in database for analysis
    await this.storeErrorLog(logEntry);
  }

  attemptRecovery(error, category) {
    switch (category) {
      case 'DATABASE':
        return this.recoverFromDatabaseError(error);
      case 'NETWORK':
        return this.recoverFromNetworkError(error);
      case 'EXTERNAL_SERVICE':
        return this.recoverFromExternalServiceError(error);
      case 'AUTHENTICATION':
        return this.recoverFromAuthError(error);
      default:
        return { success: false };
    }
  }

  async recoverFromDatabaseError(error) {
    // Try to reconnect to database
    try {
      await database.reconnect();
      return {
        success: true,
        response: {
          message: 'Database connection restored',
          retry: true
        }
      };
    } catch (reconnectError) {
      return { success: false };
    }
  }

  async recoverFromNetworkError(error) {
    // Check if service is available
    if (await this.isServiceAvailable()) {
      return {
        success: true,
        response: {
          message: 'Service restored',
          retry: true
        }
      };
    }
    return { success: false };
  }

  async recoverFromExternalServiceError(error) {
    // Try with cached data or fallback service
    const cachedData = await this.getCachedData(error.service);
    if (cachedData) {
      return {
        success: true,
        response: {
          message: 'Using cached data',
          data: cachedData,
          isStale: true
        }
      };
    }
    return { success: false };
  }

  async recoverFromAuthError(error) {
    // Try to refresh token if it's expired
    if (error.message.includes('expired')) {
      try {
        const newToken = await this.refreshToken(error.token);
        return {
          success: true,
          response: {
            message: 'Token refreshed',
            token: newToken,
            retry: true
          }
        };
      } catch (refreshError) {
        return { success: false };
      }
    }
    return { success: false };
  }

  formatErrorResponse(error) {
    return {
      success: false,
      error: {
        code: error.code || 'UNKNOWN_ERROR',
        message: this.getUserFriendlyMessage(error),
        category: error.category,
        severity: error.severity,
        timestamp: error.timestamp,
        requestId: error.requestId
      }
    };
  }

  getUserFriendlyMessage(error) {
    const messages = {
      VALIDATION: 'Please check your input and try again.',
      AUTHENTICATION: 'Please log in to continue.',
      AUTHORIZATION: 'You don\'t have permission to perform this action.',
      DATABASE: 'We\'re experiencing technical difficulties. Please try again later.',
      NETWORK: 'Network connection issue. Please check your connection and try again.',
      EXTERNAL_SERVICE: 'External service unavailable. Please try again later.',
      BUSINESS_LOGIC: 'This action cannot be completed due to system constraints.',
      SYSTEM: 'System error occurred. Our team has been notified.',
      PERFORMANCE: 'Request timed out. Please try again.',
      UNKNOWN: 'An unexpected error occurred. Please try again.'
    };

    return messages[error.category] || messages.UNKNOWN;
  }

  async triggerRecoveryWorkflows(error, req) {
    // Send notifications for critical errors
    if (error.severity === 'CRITICAL') {
      await this.sendAlertNotification(error);
    }

    // Create error report
    await this.createErrorReport(error);

    // Update system health metrics
    await this.updateHealthMetrics(error);

    // Trigger automated recovery if applicable
    if (error.category === 'DATABASE') {
      await this.triggerDatabaseRecovery();
    }
  }
}
```

### Self-Healing Capabilities

#### Automatic Recovery Strategies
```javascript
class SelfHealingService {
  constructor() {
    this.strategies = {
      database: new DatabaseRecoveryStrategy(),
      external_service: new ExternalServiceRecoveryStrategy(),
      performance: new PerformanceRecoveryStrategy(),
      authentication: new AuthenticationRecoveryStrategy()
    };

    this.healingHistory = new Map();
    this.activeHealings = new Set();
  }

  async attemptHealing(error, context) {
    const strategy = this.strategies[error.category];
    if (!strategy || this.activeHealings.has(error.category)) {
      return { success: false, reason: 'No strategy available or healing in progress' };
    }

    try {
      this.activeHealings.add(error.category);

      const result = await strategy.heal(error, context);

      this.recordHealingAttempt(error, result);

      return result;
    } catch (healingError) {
      this.recordHealingFailure(error, healingError);
      return { success: false, reason: healingError.message };
    } finally {
      this.activeHealings.delete(error.category);
    }
  }

  recordHealingAttempt(error, result) {
    const key = `${error.category}_${error.type}`;
    const history = this.healingHistory.get(key) || [];

    history.push({
      timestamp: new Date(),
      error: error.message,
      result: result.success,
      duration: result.duration,
      attempts: history.length + 1
    });

    // Keep only last 100 attempts
    if (history.length > 100) {
      history.shift();
    }

    this.healingHistory.set(key, history);
  }

  getHealingStatistics() {
    const stats = {};

    for (const [key, history] of this.healingHistory) {
      const successCount = history.filter(h => h.result).length;
      const avgDuration = history.reduce((sum, h) => sum + h.duration, 0) / history.length;

      stats[key] = {
        totalAttempts: history.length,
        successRate: (successCount / history.length) * 100,
        averageDuration: avgDuration,
        lastAttempt: history[history.length - 1].timestamp
      };
    }

    return stats;
  }
}
```

## Audit Trail and Compliance Documentation

### Comprehensive Audit System

#### Audit Log Structure
```javascript
{
  "id": "audit_123456789",
  "timestamp": "2025-10-13T10:30:00Z",
  "userId": "user_123",
  "username": "john_doe",
  "userRole": "LIBRARIAN",
  "action": "STUDENT_CHECK_IN",
  "resourceType": "STUDENT",
  "resourceId": "student_456",
  "details": {
    "studentName": "Jane Smith",
    "gradeLevel": "GRADE_10",
    "equipmentId": "computer_1",
    "location": "Main Library",
    "duration": 7200
  },
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "sessionId": "sess_789",
  "success": true,
  "errorMessage": null,
  "changes": {
    "before": { "status": "CHECKED_OUT" },
    "after": { "status": "CHECKED_IN" }
  },
  "additionalContext": {
    "source": "WEB_DASHBOARD",
    "requestId": "req_123",
    "correlationId": "corr_456"
  }
}
```

#### Audit Categories and Events
```javascript
const auditCategories = {
  AUTHENTICATION: {
    events: ['LOGIN', 'LOGOUT', 'PASSWORD_CHANGE', 'MFA_ENABLED', 'MFA_DISABLED'],
    retention: 2555 // 7 years
  },
  USER_MANAGEMENT: {
    events: ['USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'ROLE_CHANGED', 'PERMISSION_GRANTED'],
    retention: 2555
  },
  STUDENT_MANAGEMENT: {
    events: ['STUDENT_CREATED', 'STUDENT_UPDATED', 'STUDENT_DELETED', 'STUDENT_CHECK_IN', 'STUDENT_CHECK_OUT'],
    retention: 1825 // 5 years
  },
  BOOK_MANAGEMENT: {
    events: ['BOOK_ADDED', 'BOOK_UPDATED', 'BOOK_DELETED', 'BOOK_BORROWED', 'BOOK_RETURNED', 'FINE_ASSESSED'],
    retention: 1825
  },
  EQUIPMENT_MANAGEMENT: {
    events: ['EQUIPMENT_ADDED', 'EQUIPMENT_UPDATED', 'EQUIPMENT_DELETED', 'EQUIPMENT_BOOKED', 'EQUIPMENT_RETURNED'],
    retention: 1825
  },
  SYSTEM_ADMINISTRATION: {
    events: ['SYSTEM_CONFIG_CHANGED', 'BACKUP_CREATED', 'BACKUP_RESTORED', 'SYSTEM_MAINTENANCE', 'EXPORT_PERFORMED'],
    retention: 2555
  },
  DATA_ACCESS: {
    events: ['DATA_VIEWED', 'DATA_EXPORTED', 'REPORT_GENERATED', 'SEARCH_PERFORMED'],
    retention: 1095 // 3 years
  },
  SECURITY_EVENTS: {
    events: ['LOGIN_FAILED', 'PERMISSION_DENIED', 'SUSPICIOUS_ACTIVITY', 'SECURITY_VIOLATION', 'DATA_BREACH_ATTEMPT'],
    retention: 2555
  }
};
```

#### Audit Log API Endpoints
```javascript
// GET /api/audit/logs
// Query audit logs with filtering and pagination
{
  "startDate": "2025-10-01T00:00:00Z",
  "endDate": "2025-10-13T23:59:59Z",
  "userId": "user_123",
  "action": "STUDENT_CHECK_IN",
  "resourceType": "STUDENT",
  "success": true,
  "page": 1,
  "limit": 50,
  "sort": "timestamp:desc"
}

// GET /api/audit/logs/:id
// Get specific audit log entry

// GET /api/audit/export
// Export audit logs (CSV, JSON, PDF)
{
  "format": "csv",
  "filters": {
    "startDate": "2025-10-01T00:00:00Z",
    "endDate": "2025-10-13T23:59:59Z",
    "actions": ["STUDENT_CHECK_IN", "STUDENT_CHECK_OUT"]
  }
}

// GET /api/audit/statistics
// Get audit statistics and summaries
{
  "timeframe": "month",
  "groupBy": "action,user,resourceType"
}

// GET /api/audit/compliance
// Generate compliance reports
{
  "reportType": "SOX", // SOX, GDPR, HIPAA, etc.
  "timeframe": "quarter",
  "format": "pdf"
}
```

### Compliance Features

#### Data Privacy Compliance
- **GDPR Ready**: Right to access, rectification, and erasure
- **Data Minimization**: Collect only necessary data
- **Consent Management**: Explicit consent for data processing
- **Data Retention**: Configurable retention policies by data type
- **Anonymization**: Automatic data anonymization after retention period

#### Financial Compliance (SOX)
- **Access Control**: Segregation of duties enforcement
- **Change Management**: All changes tracked and approved
- **Data Integrity**: Tamper-evident audit logs
- **Reporting**: Comprehensive financial and operational reports

#### Educational Compliance
- **FERPA**: Student record privacy protection
- **CIPA**: Internet safety and filtering compliance
-Accessibility**: WCAG 2.1 AA compliance for all interfaces

## Security Best Practices and Configuration Guide

### Security Configuration

#### Environment Variables
```bash
# Security Configuration
NODE_ENV=production
BCRYPT_ROUNDS=12
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=24h
SESSION_SECRET=your-session-secret-here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_AUTH_MAX=5

# Security Headers
ENABLE_HELMET=true
ENABLE_CSP=true
CORS_ORIGIN=https://your-domain.com

# Database Security
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=true
DATABASE_CONNECTION_TIMEOUT=30000

# Session Security
SESSION_SECURE=true
SESSION_HTTP_ONLY=true
SESSION_SAME_SITE=strict
SESSION_MAX_AGE=1800000

# File Upload Security
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=jpg,jpeg,png,pdf,csv
UPLOAD_PATH=/var/www/clms/uploads

# Email Security (for notifications)
SMTP_SECURE=true
SMTP_PORT=587
EMAIL_FROM_VERIFIED=true

# Backup Security
BACKUP_ENCRYPTION=true
BACKUP_RETENTION_DAYS=90
BACKUP_ACCESS_LOG=true

# Audit Logging
AUDIT_LOG_LEVEL=info
AUDIT_RETENTION_YEARS=7
AUDIT_ENCRYPTION=true

# Security Monitoring
SECURITY_ALERTS_ENABLED=true
SECURITY_ALERT_EMAIL=admin@your-domain.com
SECURITY_MONITORING_ENABLED=true
```

#### Security Headers Configuration
```javascript
// Content Security Policy
const cspDirectives = {
  "default-src": ["'self'"],
  "script-src": ["'self'", "'unsafe-inline'", "https://trusted-cdn.com"],
  "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  "font-src": ["'self'", "https://fonts.gstatic.com"],
  "img-src": ["'self'", "data:", "https:", "blob:"],
  "connect-src": ["'self'", "https://api.your-domain.com"],
  "frame-src": ["'none'"],
  "object-src": ["'none'"],
  "media-src": ["'self'"],
  "manifest-src": ["'self'"]
};

// Additional Security Headers
const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin'
};
```

### Database Security

#### Secure Database Configuration
```sql
-- Create secure database user
CREATE USER 'clms_app'@'%' IDENTIFIED BY 'strong-password-here';
GRANT SELECT, INSERT, UPDATE, DELETE ON clms_database.* TO 'clms_app'@'%';

-- Create read-only user for reports
CREATE USER 'clms_readonly'@'%' IDENTIFIED BY 'another-strong-password';
GRANT SELECT ON clms_database.* TO 'clms_readonly'@'%';

-- Enable SSL connections
ALTER USER 'clms_app'@'%' REQUIRE SSL;
ALTER USER 'clms_readonly'@'%' REQUIRE SSL;

-- Audit log table
CREATE TABLE audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  timestamp TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  user_id VARCHAR(36),
  username VARCHAR(255),
  user_role VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(36),
  details JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  session_id VARCHAR(255),
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  changes JSON,
  additional_context JSON,
  created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_timestamp (timestamp),
  INDEX idx_user_action (user_id, action),
  INDEX idx_resource (resource_type, resource_id),
  INDEX idx_success (success)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### Data Encryption at Rest
```javascript
// Encryption configuration
const encryptionConfig = {
  algorithm: 'aes-256-gcm',
  keyLength: 32,
  ivLength: 16,
  tagLength: 16,
  keyDerivation: {
    algorithm: 'pbkdf2',
    iterations: 100000,
    saltLength: 32,
    hashFunction: 'sha256'
  }
};

// Fields to encrypt
const encryptedFields = [
  'students.address',
  'students.phone',
  'students.email',
  'users.email',
  'audit_logs.details',
  'audit_logs.changes'
];

// Encryption service
class EncryptionService {
  constructor(config) {
    this.config = config;
    this.masterKey = this.getMasterKey();
  }

  encrypt(data) {
    const iv = crypto.randomBytes(this.config.ivLength);
    const cipher = crypto.createCipher(this.config.algorithm, this.masterKey);
    cipher.setAAD(Buffer.from('clms-data'));

    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  decrypt(encryptedData) {
    const decipher = crypto.createDecipher(this.config.algorithm, this.masterKey);
    decipher.setAAD(Buffer.from('clms-data'));
    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }
}
```

### API Security Best Practices

#### Input Validation and Sanitization
```javascript
// Input validation schemas
const validationSchemas = {
  student: {
    create: {
      firstName: { type: 'string', required: true, maxLength: 50 },
      lastName: { type: 'string', required: true, maxLength: 50 },
      gradeLevel: { type: 'enum', values: ['GRADE_1', 'GRADE_2', ..., 'GRADE_12'] },
      email: { type: 'email', required: false },
      phone: { type: 'phone', required: false },
      address: { type: 'string', maxLength: 200 }
    },
    update: {
      id: { type: 'uuid', required: true },
      firstName: { type: 'string', maxLength: 50 },
      lastName: { type: 'string', maxLength: 50 },
      // ... other fields
    }
  },

  // SQL Injection Prevention
  validateQuery: (query) => {
    // Check for dangerous SQL patterns
    const dangerousPatterns = [
      /DROP\s+TABLE/i,
      /DELETE\s+FROM/i,
      /INSERT\s+INTO/i,
      /UPDATE\s+.*\s+SET/i,
      /UNION\s+SELECT/i,
      /--/,
      /\/\*/,
      /\*\//
    ];

    return !dangerousPatterns.some(pattern => pattern.test(query));
  },

  // XSS Prevention
  sanitizeInput: (input) => {
    if (typeof input !== 'string') return input;

    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
};
```

#### API Rate Limiting Implementation
```javascript
class RateLimiter {
  constructor(options = {}) {
    this.redis = new Redis(options.redis);
    this.defaultLimits = {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100,
      skipSuccessfulRequests: false,
      skipFailedRequests: false
    };
  }

  async checkLimit(key, options = {}) {
    const config = { ...this.defaultLimits, ...options };
    const redisKey = `rate_limit:${key}`;

    try {
      const current = await this.redis.incr(redisKey);

      if (current === 1) {
        await this.redis.expire(redisKey, Math.ceil(config.windowMs / 1000));
      }

      const ttl = await this.redis.ttl(redisKey);
      const resetTime = Date.now() + (ttl * 1000);

      return {
        allowed: current <= config.maxRequests,
        remaining: Math.max(0, config.maxRequests - current),
        resetTime,
        totalHits: current
      };
    } catch (error) {
      // If Redis fails, allow the request (fail open)
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetTime: Date.now() + config.windowMs,
        totalHits: 0
      };
    }
  }

  generateKey(req) {
    // Different keys for different types of rate limiting
    if (req.user) {
      return `user:${req.user.id}`;
    }
    return `ip:${req.ip}`;
  }
}
```

### Monitoring and Alerting

#### Security Monitoring
```javascript
class SecurityMonitor {
  constructor() {
    this.alerts = new Map();
    this.thresholds = {
      failedLogins: 5,
      suspiciousRequests: 50,
      unusualAccess: 3,
      systemErrors: 10
    };
  }

  async monitorEvent(event) {
    switch (event.type) {
      case 'LOGIN_FAILED':
        await this.checkFailedLogins(event);
        break;
      case 'SUSPICIOUS_REQUEST':
        await this.checkSuspiciousActivity(event);
        break;
      case 'UNUSUAL_ACCESS':
        await this.checkUnusualAccess(event);
        break;
      case 'SYSTEM_ERROR':
        await this.checkSystemErrors(event);
        break;
    }
  }

  async checkFailedLogins(event) {
    const key = `failed_login:${event.ip}`;
    const count = await this.incrementCounter(key, 900); // 15 minutes

    if (count >= this.thresholds.failedLogins) {
      await this.triggerAlert({
        type: 'BRUTE_FORCE_ATTACK',
        severity: 'HIGH',
        message: `Multiple failed login attempts from ${event.ip}`,
        details: { ip: event.ip, count, timeframe: '15 minutes' },
        actions: ['block_ip', 'notify_admin']
      });
    }
  }

  async triggerAlert(alert) {
    // Store alert
    const alertId = this.generateAlertId();
    this.alerts.set(alertId, { ...alert, timestamp: new Date() });

    // Send notifications
    await this.sendNotifications(alert);

    // Take automatic actions
    await this.executeActions(alert.actions, alert);

    // Log security event
    await this.logSecurityEvent(alert);
  }

  async sendNotifications(alert) {
    const channels = this.getNotificationChannels(alert.severity);

    for (const channel of channels) {
      try {
        await this.sendNotification(channel, alert);
      } catch (error) {
        console.error(`Failed to send ${channel} notification:`, error);
      }
    }
  }

  async executeActions(actions, alert) {
    for (const action of actions) {
      switch (action) {
        case 'block_ip':
          await this.blockIP(alert.details.ip);
          break;
        case 'notify_admin':
          await this.notifyAdmin(alert);
          break;
        case 'require_mfa':
          await this.requireMFA(alert.details.userId);
          break;
        case 'log_out_user':
          await this.logOutUser(alert.details.userId);
          break;
      }
    }
  }
}
```

### Security Checklist

#### Pre-Deployment Security Checklist

**Authentication & Authorization:**
- [ ] JWT secrets are strong and unique
- [ ] Password hashing uses bcrypt with 12+ rounds
- [ ] Session management is properly configured
- [ ] MFA is enabled for admin accounts
- [ ] Role-based permissions are correctly assigned

**API Security:**
- [ ] All inputs are validated and sanitized
- [ ] SQL injection protection is in place
- [ ] XSS protection is implemented
- [ ] CSRF protection is enabled
- [ ] Rate limiting is configured appropriately

**Data Protection:**
- [ ] Sensitive data is encrypted at rest
- [ ] Database connections use SSL/TLS
- [ ] Backup encryption is enabled
- [ ] Data retention policies are configured
- [ ] Personal data is anonymized when appropriate

**Infrastructure Security:**
- [ ] HTTPS is enforced for all connections
- [ ] Security headers are properly configured
- [ ] Firewall rules are restrictive
- [ ] Server software is up to date
- [ ] Audit logging is enabled

**Monitoring & Alerting:**
- [ ] Security event monitoring is active
- [ ] Alert notifications are configured
- [ ] Log aggregation is set up
- [ ] Intrusion detection is enabled
- [ ] Regular security scans are scheduled

**Compliance:**
- [ ] GDPR compliance requirements are met
- [ ] Data privacy policies are implemented
- [ ] Audit trails are complete and tamper-proof
- [ ] User consent is properly managed
- [ ] Data subject rights are supported

#### Ongoing Security Maintenance

**Daily:**
- Review security alerts and notifications
- Monitor failed login attempts
- Check for unusual system behavior
- Verify backup completion

**Weekly:**
- Review and rotate access logs
- Update security monitoring rules
- Check for security updates
- Test incident response procedures

**Monthly:**
- Conduct security audit
- Review user access permissions
- Update security documentation
- Perform penetration testing

**Quarterly:**
- Full security assessment
- Review and update security policies
- Conduct employee security training
- Evaluate compliance status

---

This comprehensive security and error handling guide ensures that CLMS maintains enterprise-grade security standards while providing a robust, self-healing system that can recover from errors automatically and maintain operational resilience.