import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { logger } from '@/utils/logger';

export interface SecurityHeaderConfig {
  // Content Security Policy
  contentSecurityPolicy: {
    enabled: boolean;
    directives: {
      defaultSrc: string[];
      scriptSrc: string[];
      styleSrc: string[];
      imgSrc: string[];
      connectSrc: string[];
      fontSrc: string[];
      objectSrc: string[];
      mediaSrc: string[];
      frameSrc: string[];
      childSrc: string[];
      workerSrc: string[];
      manifestSrc: string[];
      upgradeInsecureRequests?: boolean;
    };
    reportOnly?: boolean;
  };

  // HSTS (HTTP Strict Transport Security)
  hsts: {
    enabled: boolean;
    maxAge: number;
    includeSubDomains: boolean;
    preload: boolean;
  };

  // Other security headers
  xFrameOptions: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM';
  xContentTypeOptions: boolean;
  xXSSProtection: boolean;
  referrerPolicy: 'no-referrer' | 'no-referrer-when-downgrade' | 'origin' | 'origin-when-cross-origin' | 'same-origin' | 'strict-origin' | 'strict-origin-when-cross-origin' | 'unsafe-url';
  permissionsPolicy: {
    enabled: boolean;
    features: Record<string, string[]>;
  };

  // Additional headers
  crossOriginEmbedderPolicy: boolean;
  crossOriginOpenerPolicy: boolean;
  crossOriginResourcePolicy: boolean;

  // Custom headers
  customHeaders: Record<string, string>;

  // Development overrides
  developmentOverrides: {
    disableSomeHeaders: boolean;
    allowedHosts: string[];
  };
}

export class SecurityHeaders {
  private config: SecurityHeaderConfig;

  constructor(config: Partial<SecurityHeaderConfig> = {}) {
    this.config = this.getDefaultConfig();
    this.mergeConfig(config);
  }

  private getDefaultConfig(): SecurityHeaderConfig {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const isTest = process.env.NODE_ENV === 'test';

    return {
      contentSecurityPolicy: {
        enabled: !isTest, // Disable in tests
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            ...(isDevelopment ? ["'unsafe-inline'", "'unsafe-eval'"] : []),
            "'strict-dynamic'"
          ],
          styleSrc: [
            "'self'",
            ...(isDevelopment ? ["'unsafe-inline'"] : [])
          ],
          imgSrc: [
            "'self'",
            'data:',
            'https:',
            'blob:'
          ],
          connectSrc: [
            "'self'",
            ...(isDevelopment ? ['ws:', 'wss:'] : ['wss:'])
          ],
          fontSrc: [
            "'self'",
            'data:'
          ],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
          childSrc: ["'none'"],
          workerSrc: ["'self'", 'blob:'],
          manifestSrc: ["'self'"],
          upgradeInsecureRequests: !isDevelopment
        },
        reportOnly: isDevelopment
      },

      hsts: {
        enabled: !isDevelopment,
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      },

      xFrameOptions: 'DENY',
      xContentTypeOptions: true,
      xXSSProtection: true,
      referrerPolicy: 'strict-origin-when-cross-origin',

      permissionsPolicy: {
        enabled: true,
        features: {
          'geolocation': [],
          'microphone': [],
          'camera': [],
          'payment': [],
          'usb': [],
          'magnetometer': [],
          'gyroscope': [],
          'accelerometer': [],
          'ambient-light-sensor': [],
          'autoplay': [],
          'document-domain': [],
          'encrypted-media': [],
          'fullscreen': ['self'],
          'picture-in-picture': [],
          'publickey-credentials-get': [],
          'screen-wake-lock': [],
          'web-share': [],
          'xr-spatial-tracking': []
        }
      },

      crossOriginEmbedderPolicy: !isDevelopment,
      crossOriginOpenerPolicy: !isDevelopment,
      crossOriginResourcePolicy: true,

      customHeaders: {
        'X-Permitted-Cross-Domain-Policies': 'none',
        'X-Download-Options': 'noopen',
        'X-Robots-Tag': 'noindex, nofollow',
        'Server': 'CLMS-Secure', // Hide server signature
        'X-Content-Type-Options': 'nosniff'
      },

      developmentOverrides: {
        disableSomeHeaders: isDevelopment,
        allowedHosts: isDevelopment ? [
          'localhost',
          '127.0.0.1',
          '0.0.0.0'
        ] : []
      }
    };
  }

  private mergeConfig(userConfig: Partial<SecurityHeaderConfig>): void {
    if (userConfig.contentSecurityPolicy) {
      this.config.contentSecurityPolicy = {
        ...this.config.contentSecurityPolicy,
        ...userConfig.contentSecurityPolicy,
        directives: {
          ...this.config.contentSecurityPolicy.directives,
          ...userConfig.contentSecurityPolicy.directives
        }
      };
    }

    if (userConfig.hsts) {
      this.config.hsts = { ...this.config.hsts, ...userConfig.hsts };
    }

    if (userConfig.permissionsPolicy) {
      this.config.permissionsPolicy = {
        ...this.config.permissionsPolicy,
        ...userConfig.permissionsPolicy,
        features: {
          ...this.config.permissionsPolicy.features,
          ...userConfig.permissionsPolicy.features
        }
      };
    }

    // Merge other config properties
    Object.assign(this.config, userConfig);
  }

  // Main middleware function
  securityHeaders() {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        // Set CSP header
        if (this.config.contentSecurityPolicy.enabled) {
          const cspValue = this.buildCSPHeader();
          const headerName = this.config.contentSecurityPolicy.reportOnly
            ? 'Content-Security-Policy-Report-Only'
            : 'Content-Security-Policy';
          res.set(headerName, cspValue);
        }

        // Set HSTS header
        if (this.config.hsts.enabled && req.secure) {
          const hstsValue = [
            `max-age=${this.config.hsts.maxAge}`,
            this.config.hsts.includeSubDomains ? 'includeSubDomains' : '',
            this.config.hsts.preload ? 'preload' : ''
          ].filter(Boolean).join('; ');

          res.set('Strict-Transport-Security', hstsValue);
        }

        // Set X-Frame-Options
        if (this.config.xFrameOptions) {
          res.set('X-Frame-Options', this.config.xFrameOptions);
        }

        // Set X-Content-Type-Options
        if (this.config.xContentTypeOptions) {
          res.set('X-Content-Type-Options', 'nosniff');
        }

        // Set X-XSS-Protection
        if (this.config.xXSSProtection) {
          res.set('X-XSS-Protection', '1; mode=block');
        }

        // Set Referrer Policy
        res.set('Referrer-Policy', this.config.referrerPolicy);

        // Set Permissions Policy
        if (this.config.permissionsPolicy.enabled) {
          const permissionsValue = this.buildPermissionsPolicyHeader();
          res.set('Permissions-Policy', permissionsValue);
        }

        // Set Cross-Origin headers
        if (this.config.crossOriginEmbedderPolicy) {
          res.set('Cross-Origin-Embedder-Policy', 'require-corp');
        }

        if (this.config.crossOriginOpenerPolicy) {
          res.set('Cross-Origin-Opener-Policy', 'same-origin');
        }

        if (this.config.crossOriginResourcePolicy) {
          res.set('Cross-Origin-Resource-Policy', 'same-origin');
        }

        // Set custom headers
        for (const [header, value] of Object.entries(this.config.customHeaders)) {
          res.set(header, value);
        }

        // Add security-related headers for API responses
        if (req.path.startsWith('/api/')) {
          res.set({
            'X-API-Version': '1.0.0',
            'X-RateLimit-Limit': '1000',
            'X-RateLimit-Remaining': '999',
            'X-RateLimit-Reset': Math.ceil(Date.now() / 1000 + 3600).toString(),
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          });
        }

        // Log security header configuration (development only)
        if (process.env.NODE_ENV === 'development') {
          logger.debug('Security headers applied', {
            path: req.path,
            method: req.method,
            headers: res.getHeaders()
          });
        }

        next();
      } catch (error) {
        logger.error('Error applying security headers', {
          error: (error as Error).message,
          path: req.path
        });
        next(); // Continue even if headers fail
      }
    };
  }

  // Helmet configuration
  helmetConfig(): helmet.IHelmetConfiguration {
    const config: any = {};

    // Content Security Policy
    if (this.config.contentSecurityPolicy.enabled) {
      config.contentSecurityPolicy = {
        directives: this.config.contentSecurityPolicy.directives,
        reportOnly: this.config.contentSecurityPolicy.reportOnly
      };
    } else {
      config.contentSecurityPolicy = false;
    }

    // HSTS
    config.hsts = this.config.hsts.enabled ? {
      maxAge: this.config.hsts.maxAge,
      includeSubDomains: this.config.hsts.includeSubDomains,
      preload: this.config.hsts.preload
    } : false;

    // Frame options
    config.frameguard = {
      action: this.config.xFrameOptions.toLowerCase() as any
    };

    // Other helmet options
    config.noSniff = this.config.xContentTypeOptions;
    config.xssFilter = this.config.xXSSProtection;
    config.referrerPolicy = { policy: this.config.referrerPolicy };

    // Cross-origin policies
    config.crossOriginEmbedderPolicy = this.config.crossOriginEmbedderPolicy;
    config.crossOriginOpenerPolicy = this.config.crossOriginOpenerPolicy;
    config.crossOriginResourcePolicy = { policy: 'same-origin' };

    // Permissions policy
    if (this.config.permissionsPolicy.enabled) {
      config.permissionsPolicy = {
        features: this.config.permissionsPolicy.features
      };
    }

    return config;
  }

  // Combined middleware using helmet + custom headers
  enhancedSecurity() {
    return [
      helmet(this.helmetConfig()),
      this.securityHeaders()
    ];
  }

  private buildCSPHeader(): string {
    const directives: string[] = [];

    for (const [directive, values] of Object.entries(this.config.contentSecurityPolicy.directives)) {
      if (Array.isArray(values) && values.length > 0) {
        const kebabCase = directive.replace(/([A-Z])/g, '-$1').toLowerCase();
        directives.push(`${kebabCase} ${values.join(' ')}`);
      } else if (values === true) {
        const kebabCase = directive.replace(/([A-Z])/g, '-$1').toLowerCase();
        directives.push(kebabCase);
      }
    }

    return directives.join('; ');
  }

  private buildPermissionsPolicyHeader(): string {
    const policies: string[] = [];

    for (const [feature, allowlist] of Object.entries(this.config.permissionsPolicy.features)) {
      const kebabCase = feature.replace(/([A-Z])/g, '-$1').toLowerCase();
      const values = allowlist.length > 0 ? allowlist.join(' ') : '()';
      policies.push(`${kebabCase}=${values}`);
    }

    return policies.join(', ');
  }

  // Method to update configuration at runtime
  updateConfig(newConfig: Partial<SecurityHeaderConfig>): void {
    this.mergeConfig(newConfig);
    logger.info('Security headers configuration updated');
  }

  // Method to get current configuration
  getConfig(): SecurityHeaderConfig {
    return { ...this.config };
  }

  // Method to validate CSP directives
  validateCSPDirective(directive: string, values: string[]): boolean {
    const validDirectives = Object.keys(this.config.contentSecurityPolicy.directives);
    const kebabCaseDirective = directive.replace(/([A-Z])/g, '-$1').toLowerCase();

    if (!validDirectives.includes(kebabCaseDirective)) {
      return false;
    }

    // Basic validation for common values
    for (const value of values) {
      if (value.includes('javascript:') || value.includes('data:')) {
        logger.warn('Potentially unsafe CSP value detected', { directive, value });
        return false;
      }
    }

    return true;
  }

  // Method to generate CSP violation report handler
  cspViolationHandler() {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (req.method === 'POST' && req.path === '/api/security/csp-report') {
        try {
          const report = req.body;

          logger.warn('CSP Violation Report', {
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            'blocked-uri': report?.['blocked-uri'],
            'violated-directive': report?.['violated-directive'],
            'original-policy': report?.['original-policy'],
            'document-uri': report?.['document-uri'],
            timestamp: new Date().toISOString()
          });

          res.status(204).send();
        } catch (error) {
          logger.error('Error processing CSP violation report', {
            error: (error as Error).message
          });
          res.status(400).json({ error: 'Invalid report format' });
        }
      } else {
        next();
      }
    };
  }
}

// Export singleton instance
export const securityHeaders = new SecurityHeaders();

// Export convenience functions
export const enhancedSecurity = () => securityHeaders.enhancedSecurity();
export const cspViolationHandler = () => securityHeaders.cspViolationHandler();