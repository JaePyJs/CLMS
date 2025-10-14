import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import fs from 'fs';
import crypto from 'crypto';
import configuration from '@/config';
import { logger } from '@/utils/logger';
import { TransitEncryption } from '@/utils/encryption';

class SecurityHeaders {
  private static tlsConfig: {
    enabled: boolean;
    certPath?: string;
    keyPath?: string;
    caPath?: string;
    options?: any;
  } = {
    enabled: false
  };

  /**
   * Initialize enhanced TLS configuration
   */
  static async initialize(): Promise<void> {
    try {
      const certPath = process.env.TLS_CERT_PATH;
      const keyPath = process.env.TLS_KEY_PATH;
      const caPath = process.env.TLS_CA_PATH;

      if (certPath && keyPath) {
        // Validate certificate files exist
        if (!fs.existsSync(certPath)) {
          throw new Error(`TLS certificate file not found: ${certPath}`);
        }

        if (!fs.existsSync(keyPath)) {
          throw new Error(`TLS key file not found: ${keyPath}`);
        }

        if (caPath && !fs.existsSync(caPath)) {
          throw new Error(`TLS CA file not found: ${caPath}`);
        }

        this.tlsConfig = {
          enabled: true,
          certPath,
          keyPath,
          caPath,
          options: {
            cert: fs.readFileSync(certPath),
            key: fs.readFileSync(keyPath),
            ca: caPath ? fs.readFileSync(caPath) : undefined,
            minVersion: 'TLSv1.3',
            ciphers: [
              'TLS_AES_256_GCM_SHA384',
              'TLS_CHACHA20_POLY1305_SHA256',
              'TLS_AES_128_GCM_SHA256'
            ].join(':'),
            honorCipherOrder: true,
            secureOptions: crypto.constants.SSL_OP_NO_SSLv3 | crypto.constants.SSL_OP_NO_TLSv1 | crypto.constants.SSL_OP_NO_TLSv1_1,
            rejectUnauthorized: true,
            requestCert: process.env.TLS_REQUEST_CLIENT_CERT === 'true'
          }
        };

        logger.info('Enhanced TLS configuration loaded successfully', {
          certPath,
          keyPath,
          caPath,
          clientAuth: this.tlsConfig.options.requestCert
        });
      } else {
        logger.warn('TLS certificates not configured - using basic HTTPS settings');
        this.tlsConfig.enabled = false;
      }
    } catch (error) {
      logger.error('Failed to initialize TLS configuration', {
        error: (error as Error).message
      });
      this.tlsConfig.enabled = false;
    }
  }

  /**
   * Get TLS configuration for HTTPS server
   */
  static getTLSOptions(): any {
    return this.tlsConfig.enabled ? this.tlsConfig.options : undefined;
  }

  /**
   * Check if TLS is enabled
   */
  static isTLSEnabled(): boolean {
    return this.tlsConfig.enabled;
  }

  static getTLSConfiguration(): {
    enforceHTTPS: boolean;
    hstsMaxAge: number;
    includeSubDomains: boolean;
    preload: boolean;
  } {
    return {
      enforceHTTPS: process.env.NODE_ENV === 'production' || process.env.ENFORCE_HTTPS === 'true',
      hstsMaxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      includeSubDomains: true,
      preload: true
    };
  }

  static getSecurityHeaders(): any {
    const tlsConfig = this.getTLSConfiguration();
    const enhancedHeaders = TransitEncryption.getSecureHeaders();

    return {
      ...enhancedHeaders,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", process.env.API_URL || "http://localhost:3001"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          manifestSrc: ["'self'"],
          workerSrc: ["'self'"]
        }
      },
      hsts: tlsConfig.enforceHTTPS ? {
        maxAge: tlsConfig.hstsMaxAge,
        includeSubDomains: tlsConfig.includeSubDomains,
        preload: tlsConfig.preload
      } : false,
      crossOriginEmbedderPolicy: false, // Disable for development flexibility
      crossOriginResourcePolicy: { policy: "cross-origin" }
    };
  }

  /**
   * Generate TLS configuration report
   */
  static generateTLSReport(): {
    enabled: boolean;
    configuration: any;
    validation: any;
    recommendations: string[];
  } {
    const validation = TransitEncryption.validateTLSConfig();
    const recommendations: string[] = [];

    if (!this.tlsConfig.enabled) {
      recommendations.push('Enable TLS/HTTPS for production environments');
      recommendations.push('Obtain valid SSL/TLS certificates');
    } else {
      if (process.env.NODE_ENV === 'production' && !this.tlsConfig.options?.requestCert) {
        recommendations.push('Consider enabling client certificate authentication for sensitive operations');
      }

      if (!process.env.TLS_OCSP_STAPLING) {
        recommendations.push('Enable OCSP stapling for improved security');
      }
    }

    return {
      enabled: this.tlsConfig.enabled,
      configuration: this.tlsConfig.enabled ? {
        certPath: this.tlsConfig.certPath,
        keyPath: this.tlsConfig.keyPath,
        caPath: this.tlsConfig.caPath,
        clientAuth: this.tlsConfig.options?.requestCert,
        minVersion: this.tlsConfig.options?.minVersion,
        cipherSuite: this.tlsConfig.options?.ciphers?.split(':')
      } : null,
      validation,
      recommendations
    };
  }

  /**
   * Test TLS configuration
   */
  static async testTLSConfiguration(): Promise<{
    success: boolean;
    details: any;
    errors: string[];
  }> {
    const errors: string[] = [];
    const details: any = {};

    try {
      if (!this.tlsConfig.enabled) {
        errors.push('TLS is not enabled');
        return { success: false, details, errors };
      }

      // Test certificate validity
      if (this.tlsConfig.certPath && this.tlsConfig.keyPath) {
        try {
          const cert = fs.readFileSync(this.tlsConfig.certPath, 'utf8');
          const key = fs.readFileSync(this.tlsConfig.keyPath, 'utf8');

          // Parse certificate
          const certInfo = new crypto.X509Certificate(cert);

          details.certificate = {
            subject: certInfo.subject,
            issuer: certInfo.issuer,
            validFrom: certInfo.validFrom,
            validTo: certInfo.validTo,
            fingerprint: certInfo.fingerprint
          };

          // Check if certificate is expired
          const now = new Date();
          const validTo = new Date(certInfo.validTo);
          if (now > validTo) {
            errors.push(`Certificate expired on ${validTo.toISOString()}`);
          }

          // Check if certificate is not yet valid
          const validFrom = new Date(certInfo.validFrom);
          if (now < validFrom) {
            errors.push(`Certificate not valid until ${validFrom.toISOString()}`);
          }

        } catch (certError) {
          errors.push(`Failed to read or parse certificate: ${(certError as Error).message}`);
        }
      }

      return {
        success: errors.length === 0,
        details,
        errors
      };
    } catch (error) {
      errors.push(`TLS configuration test failed: ${(error as Error).message}`);
      return { success: false, details, errors };
    }
  }
}

class TLSMiddleware {
  /**
   * Middleware to validate client certificates (if enabled)
   */
  static validateClientCertificate = (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!SecurityHeaders.isTLSEnabled() || !SecurityHeaders.getTLSOptions()?.requestCert) {
        return next();
      }

      const socket = req.socket as any;
      const clientCert = socket.getPeerCertificate();

      if (!clientCert || Object.keys(clientCert).length === 0) {
        logger.warn('Client certificate validation failed - no certificate provided', {
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Client certificate is required'
        });
      }

      // Log successful client certificate validation
      logger.info('Client certificate validated successfully', {
        subject: clientCert.subject,
        issuer: clientCert.issuer,
        validFrom: clientCert.valid_from,
        validTo: clientCert.valid_to,
        ip: req.ip
      });

      // Add certificate info to request for downstream use
      (req as any).clientCertificate = clientCert;

      next();
    } catch (error) {
      logger.error('Error validating client certificate', {
        error: (error as Error).message,
        ip: req.ip
      });

      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Certificate validation failed'
      });
    }
  };

  /**
   * Middleware to log TLS connection details
   */
  static logTLSConnection = (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (req.secure) {
        const socket = req.socket as any;
        const tlsInfo = {
          protocol: socket.getProtocol(),
          cipher: socket.getCipher(),
          servername: socket.getServername?.(),
          authorized: socket.authorized,
          authorizationError: socket.authorizationError,
          alpnProtocol: socket.alpnProtocol
        };

        logger.info('TLS connection established', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          tls: tlsInfo
        });
      }

      next();
    } catch (error) {
      logger.error('Error logging TLS connection', {
        error: (error as Error).message
      });
      next(error);
    }
  };

  /**
   * Enhanced HTTPS enforcement with reverse proxy support
   */
  static enforceHTTPS(req: Request, res: Response, next: NextFunction): void {
    const tlsConfig = SecurityHeaders.getTLSConfiguration();

    if (tlsConfig.enforceHTTPS && req.secure === false) {
      // Check behind reverse proxy
      const forwardedProto = req.get('X-Forwarded-Proto');
      const forwardedSSL = req.get('X-Forwarded-SSL');
      const secureConnection = req.secure || forwardedProto === 'https' || forwardedSSL === 'on';

      if (!secureConnection) {
        // Redirect to HTTPS
        const httpsUrl = `https://${req.get('host')}${req.originalUrl}`;
        logger.warn('Redirecting HTTP to HTTPS', {
          originalUrl: req.url,
          redirectUrl: httpsUrl,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });
        return res.redirect(301, httpsUrl);
      }
    }

    next();
  }

  /**
   * Enhanced security headers with TLS information
   */
  static securityHeaders = helmet(SecurityHeaders.getSecurityHeaders());

  /**
   * Middleware to add TLS-specific headers
   */
  static addTLSHeaders = (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Add TLS-specific headers
      if (req.secure) {
        res.setHeader('X-HTTPS', 'true');
        res.setHeader('X-TLS-Version', req.socket.getProtocol() || 'unknown');
        res.setHeader('X-TLS-Cipher', req.socket.getCipher()?.name || 'unknown');

        // Add client certificate info if available
        const socket = req.socket as any;
        if (socket.getPeerCertificate && Object.keys(socket.getPeerCertificate()).length > 0) {
          const cert = socket.getPeerCertificate();
          res.setHeader('X-Client-Cert-Subject', cert.subject?.CN || 'unknown');
          res.setHeader('X-Client-Cert-Issuer', cert.issuer?.CN || 'unknown');
        }
      }

      // Add encryption status headers
      res.setHeader('X-Encryption-Enabled', 'true');
      res.setHeader('X-Encryption-Version', '1.0');
      res.setHeader('X-Data-Classification', 'confidential');

      next();
    } catch (error) {
      logger.error('Error adding TLS headers', {
        error: (error as Error).message
      });
      next(error);
    }
  };

  static corsSettings = {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control',
      'Pragma'
    ],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    credentials: true,
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204
  };

  static rateLimiting = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Stricter in production
    message: {
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: 900 // 15 minutes
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Different limits for different endpoints
    keyGenerator: (req: Request) => {
      const user = (req as any).user;
      return user?.id || req.ip;
    },
    // Custom skip function for health checks and static assets
    skip: (req: Request) => {
      const healthEndpoints = ['/health', '/api/health', '/ping'];
      const staticAssets = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$/i;
      
      return healthEndpoints.includes(req.path) || staticAssets.test(req.path);
    }
  };

  static compressionSettings = {
    level: 6, // Balanced compression
    threshold: 1024, // Only compress responses > 1KB
    filter: (req: Request, res: Response) => {
      // Only compress text-based responses
      const contentType = res.get('Content-Type') || '';
      return contentType.includes('text/') || 
             contentType.includes('application/json') ||
             contentType.includes('application/javascript') ||
             contentType.includes('application/xml') ||
             contentType.includes('application/xhtml+xml');
    }
  };
}

export {
  SecurityHeaders,
  TLSMiddleware
};
