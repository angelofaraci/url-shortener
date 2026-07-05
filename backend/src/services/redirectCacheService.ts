import { redis } from '../lib/redis.js';

export const redirectCacheService = {
  async getUrl(code: string): Promise<string | null> {
    return redis.get(code);
  },

  // Only non-expired links are ever cached, with the TTL set to the exact remaining
  // lifetime, so a cache hit never needs a secondary expiry check downstream.
  async cacheUrl(code: string, url: string, ttlSeconds: number): Promise<void> {
    await redis.set(code, url, 'EX', ttlSeconds);
  },
};
