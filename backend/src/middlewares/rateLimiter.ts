import { rateLimit, ipKeyGenerator, type RateLimitRequestHandler } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import type { Request, Response } from 'express';
import { redis } from '../lib/redis.js';
import { config } from '../config/index.js';

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  keyPrefix: string;
}

// Authenticated requests are keyed by user id, so a logged-in user stays
// consistently rate-limited regardless of IP/NAT changes. Anonymous requests
// fall back to express-rate-limit's own IPv6-safe key helper rather than a
// hand-rolled `req.ip` normalization. Exported standalone so it can be unit
// tested without mounting the full middleware.
export function rateLimitKeyGenerator(req: Request): string {
  if (req.user) {
    return `user:${req.user.id}`;
  }
  return ipKeyGenerator(req.ip ?? '');
}

export function createRateLimiter({ windowMs, max, keyPrefix }: RateLimiterOptions): RateLimitRequestHandler {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: rateLimitKeyGenerator,
    store: new RedisStore({
      prefix: `${keyPrefix}:`,
      // Reuses the shared ioredis client (src/lib/redis.ts) rather than opening
      // a second Redis connection; RedisStore only ever needs raw command dispatch.
      // ioredis's `call` overloads are typed as a non-empty tuple, which a plain
      // `string[]` rest param can't satisfy structurally, hence the one cast.
      sendCommand: (...args: string[]) =>
        redis.call(...(args as [string, ...string[]])) as Promise<RedisReply>,
    }),
    // Matches the JSON error shape the rest of the app uses (see errorHandler.ts).
    handler: (_req: Request, res: Response) => {
      res.status(429).json({ error: 'Too many requests' });
    },
  });
}

// Applied globally to every route except /health (see app.ts wiring).
export const generalRateLimiter = createRateLimiter({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  keyPrefix: 'rl:general',
});

// Defense in depth on top of generalRateLimiter: link creation is the endpoint
// with real ongoing storage/compute cost, so it gets its own stricter budget.
export const createLinkRateLimiter = createRateLimiter({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitCreateLinkMax,
  keyPrefix: 'rl:create-link',
});

// Guards the OAuth start/callback hops, which trigger outbound calls to
// Google's token/userinfo endpoints. This one intentionally always keys by
// IP: req.user is only ever populated from an *existing* session cookie
// (see optionalSession.ts), and there is no session yet at this step, so
// rateLimitKeyGenerator naturally falls through to its IP branch here.
export const authRateLimiter = createRateLimiter({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitAuthMax,
  keyPrefix: 'rl:auth',
});
