import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter
 * Allows 1000 requests per 15 minutes per IP
 */
export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Strict rate limiter for authentication endpoints
 * Allows only 5 attempts per 15 minutes per IP to prevent brute force attacks
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message:
    'Too many authentication attempts from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count both successful and failed attempts
});

/**
 * Medium-strict rate limiter for registration and password reset
 * Allows 3 attempts per hour per IP
 */
export const registrationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message:
    'Too many registration/reset attempts from this IP, please try again after 1 hour',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Scan rate limiter - detects USB barcode scanner spam
 * Allows 30 scans per minute per IP (reasonable for batch scanning)
 * but blocks rapid-fire spam attacks
 */
export const scanRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 scans per minute (1 every 2 seconds average)
  message: {
    success: false,
    message:
      'Too many scans detected. Please wait a moment before scanning again.',
    cooldownRemaining: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => {
    // Use a combination of IP and user ID if available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (req as any).user?.id;
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    return userId ? `${ip}:${userId}` : ip;
  },
});

/**
 * Per-student scan rate limiter - prevents same student from being scanned too fast
 * This is a helper to track per-barcode rates
 */
const studentScanTracker = new Map<
  string,
  { count: number; resetAt: number }
>();

export const checkStudentScanRate = (
  barcode: string,
): { allowed: boolean; waitSeconds?: number } => {
  const now = Date.now();
  const windowMs = 30000; // 30 second window - prevents duplicate check-ins from rapid scanning
  const maxScans = 1; // Only 1 scan per 30 seconds for same barcode

  const tracker = studentScanTracker.get(barcode);

  // Clean up old entries periodically
  if (studentScanTracker.size > 1000) {
    for (const [key, value] of studentScanTracker.entries()) {
      if (value.resetAt < now) {
        studentScanTracker.delete(key);
      }
    }
  }

  if (!tracker || tracker.resetAt < now) {
    // New window
    studentScanTracker.set(barcode, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (tracker.count >= maxScans) {
    const waitSeconds = Math.ceil((tracker.resetAt - now) / 1000);
    return { allowed: false, waitSeconds };
  }

  tracker.count++;
  return { allowed: true };
};
