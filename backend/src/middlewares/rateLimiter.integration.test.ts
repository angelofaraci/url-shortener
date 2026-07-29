import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createFakeRateLimitRedis } from '../test/fakeRateLimitRedis.js';

// Production defaults (300/20/10 requests per 15 minutes) are far too large to
// exercise in a fast test, so this file overrides the create-link limit to a
// small number before config (and everything that imports it) is loaded.
// config.ts parses process.env at import time, so this must happen before the
// dynamic imports below.
process.env.RATE_LIMIT_CREATE_LINK_MAX = '2';

const redisMock = createFakeRateLimitRedis();
vi.mock('../lib/redis.js', () => ({ redis: redisMock }));

const prismaMock = {
  $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
};
vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

vi.mock('../services/sessionService.js', () => ({
  sessionService: {
    create: vi.fn(),
    get: vi.fn(),
    destroy: vi.fn(),
    putState: vi.fn(),
    consumeState: vi.fn(),
  },
}));

vi.mock('../services/linkService.js', () => ({
  linkService: {
    createLink: vi.fn(),
  },
  AliasTakenError: class AliasTakenError extends Error {},
  CodeGenerationExhaustedError: class CodeGenerationExhaustedError extends Error {},
}));

const { linkService } = await import('../services/linkService.js');
const { createApp } = await import('../app.js');

const app = createApp();

const createdLink = {
  code: 'aaa',
  url: 'https://a.test',
  expiresAt: null,
  createdAt: new Date('2026-07-20T00:00:00.000Z'),
};

describe('rate limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.reset();
    vi.mocked(linkService.createLink).mockResolvedValue(createdLink as never);
  });

  describe('POST /api/links (createLinkRateLimiter, overridden to 2/window)', () => {
    it('allows requests at or under the limit to succeed normally', async () => {
      const res1 = await request(app).post('/api/links').send({ url: 'https://a.test' });
      const res2 = await request(app).post('/api/links').send({ url: 'https://a.test' });

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
    });

    it('returns 429 with the standard error shape once the limit is exceeded', async () => {
      await request(app).post('/api/links').send({ url: 'https://a.test' });
      await request(app).post('/api/links').send({ url: 'https://a.test' });

      const res = await request(app).post('/api/links').send({ url: 'https://a.test' });

      expect(res.status).toBe(429);
      expect(res.body).toEqual({ error: 'Too many requests' });
      // The service must never be reached once the limiter has rejected the request.
      expect(linkService.createLink).toHaveBeenCalledTimes(2);
    });
  });

  describe('GET /health', () => {
    it('is never rate-limited, regardless of request volume', async () => {
      const responses = await Promise.all(
        Array.from({ length: 10 }, () => request(app).get('/health')),
      );

      for (const res of responses) {
        expect(res.status).not.toBe(429);
      }
    });
  });
});
