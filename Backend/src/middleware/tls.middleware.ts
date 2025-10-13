import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import configuration from '@/config';

class SecurityHeaders {
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
    
    return {
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
}

class TLSMiddleware {
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
        return res.redirect(301, httpsUrl);
      }
    }
    
    next();
  }

  static securityHeaders = helmet(SecurityHeaders.getSecurityHeaders());

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
