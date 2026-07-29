import { createHash } from 'node:crypto';
import { vi } from 'vitest';

// rate-limit-redis's RedisStore talks to Redis exclusively through
// `sendCommand`, which this repo wires straight to the shared ioredis
// client's `call(...)` (see src/middlewares/rateLimiter.ts). No real Redis
// server is reachable in this sandbox/test environment, and every existing
// integration test in this repo already mocks `../lib/redis.js` rather than
// requiring a live Redis (see sessionService.test.ts). This fake follows the
// same convention, but — unlike a naive stub — it re-implements the actual
// Redis commands RedisStore issues (SCRIPT LOAD + EVALSHA of its fixed-window
// increment/get Lua scripts) against an in-memory counter map, so the real
// rate-limiting logic in RedisStore/express-rate-limit is genuinely exercised
// end-to-end through `redis.call`, not bypassed.
export function createFakeRateLimitRedis() {
  const scripts = new Map<string, string>();
  const counters = new Map<string, { count: number; expiresAt: number }>();

  function sha1(input: string): string {
    return createHash('sha1').update(input).digest('hex');
  }

  const call = vi.fn(async (...args: string[]): Promise<unknown> => {
    const [command, ...rest] = args;

    if (command === 'SCRIPT' && rest[0] === 'LOAD') {
      const script = rest[1] ?? '';
      const sha = sha1(script);
      scripts.set(sha, script);
      return sha;
    }

    if (command === 'EVALSHA') {
      const [sha, , key, windowMsArg] = rest;
      const script = scripts.get(sha ?? '');
      if (!script) {
        // Mirrors real Redis: an unloaded/evicted script rejects with NOSCRIPT,
        // which is exactly what RedisStore's retry path is written to handle.
        throw new Error('NOSCRIPT No matching script. Please use EVAL.');
      }

      const now = Date.now();
      const bucketKey = key ?? '';
      const existing = counters.get(bucketKey);
      const isIncrementScript = script.includes('INCR');

      if (isIncrementScript) {
        const windowMs = Number(windowMsArg);
        if (!existing || existing.expiresAt <= now) {
          counters.set(bucketKey, { count: 1, expiresAt: now + windowMs });
          return [1, windowMs];
        }
        existing.count += 1;
        return [existing.count, existing.expiresAt - now];
      }

      // The "get" script (peek without incrementing).
      if (!existing || existing.expiresAt <= now) {
        return [false, -2];
      }
      return [existing.count, existing.expiresAt - now];
    }

    if (command === 'DEL') {
      counters.delete(rest[0] ?? '');
      return 1;
    }

    if (command === 'DECR') {
      const bucketKey = rest[0] ?? '';
      const existing = counters.get(bucketKey);
      if (existing) {
        existing.count -= 1;
      }
      return existing?.count ?? 0;
    }

    throw new Error(`Unsupported command in fake rate-limit redis: ${command}`);
  });

  return {
    call,
    ping: vi.fn().mockResolvedValue('PONG'),
    // Clears hit counters between tests without discarding the loaded scripts
    // (RedisStore.init() only runs SCRIPT LOAD once, at construction time).
    reset(): void {
      counters.clear();
    },
  };
}
