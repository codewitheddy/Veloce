/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response, NextFunction } from 'express';

interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const requests = new Map<string, { count: number; resetTime: number }>();
  const windowMs = options.windowMs || 60000;
  const max = options.max || 100;
  const message = options.message || 'Too many requests. Please try again later.';

  // Periodic cleanup
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of requests.entries()) {
      if (now > record.resetTime) {
        requests.delete(key);
      }
    }
  }, Math.max(windowMs, 30000));

  return (req: Request, res: Response, next: NextFunction) => {
    const key = options.keyGenerator
      ? options.keyGenerator(req)
      : (req.ip || req.headers['x-forwarded-for'] || 'unknown').toString();

    const now = Date.now();
    let record = requests.get(key);

    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      requests.set(key, record);
    } else {
      record.count++;
    }

    if (record.count > max) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({
        success: false,
        error: message,
        code: 'RATE_LIMIT_EXCEEDED',
        retry_after_seconds: retryAfterSeconds,
      });
    }

    next();
  };
}

export const trackingRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 45,
  message: 'Too many tracking requests from this IP. Please wait a moment before trying again.',
});

export const searchRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many search requests. Please wait a moment before trying again.',
});
