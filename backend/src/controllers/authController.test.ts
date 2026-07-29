import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createFakeRateLimitRedis } from '../test/fakeRateLimitRedis.js';

// createApp() now wires a Redis-backed rate limiter on every route (see
// src/middlewares/rateLimiter.ts). No real Redis is reachable in this
// sandbox/test environment, so — matching how every other integration test in
// this repo already mocks '../lib/redis.js' (see sessionService.test.ts) —
// this fakes the shared client rather than hitting the network.
const redisMock = createFakeRateLimitRedis();
vi.mock('../lib/redis.js', () => ({ redis: redisMock }));

vi.mock('../services/sessionService.js', () => ({
  sessionService: {
    create: vi.fn(),
    get: vi.fn(),
    destroy: vi.fn(),
    putState: vi.fn(),
    consumeState: vi.fn(),
  },
}));

vi.mock('../services/authService.js', () => ({
  authService: {
    isConfigured: vi.fn(),
    completeLogin: vi.fn(),
  },
}));

const { sessionService } = await import('../services/sessionService.js');
const { authService } = await import('../services/authService.js');
const { sanitizeReturnTo } = await import('./authController.js');
const { createApp } = await import('../app.js');

const app = createApp();

describe('auth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.reset();
  });

  describe('route ordering (threat matrix: catch-all shadowing)', () => {
    it('GET /auth/me returns 200 JSON, never falling through to the /:code catch-all', async () => {
      vi.mocked(sessionService.get).mockResolvedValueOnce(null);

      const res = await request(app).get('/auth/me');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ user: null });
    });
  });

  describe('open-redirect protection on returnTo', () => {
    it('accepts a same-origin relative path unchanged', () => {
      expect(sanitizeReturnTo('/dashboard')).toBe('/dashboard');
    });

    it('rejects an absolute external URL and falls back to /', () => {
      expect(sanitizeReturnTo('https://evil.tld')).toBe('/');
    });

    it('rejects a protocol-relative external URL and falls back to /', () => {
      expect(sanitizeReturnTo('//evil.tld')).toBe('/');
    });

    it('rejects undefined/missing returnTo and falls back to /', () => {
      expect(sanitizeReturnTo(undefined)).toBe('/');
    });
  });

  describe('CSRF protection on /auth/google/callback state', () => {
    it('redirects to /?authError=state and creates no session when state is missing', async () => {
      const res = await request(app).get('/auth/google/callback').query({ code: 'abc' });

      expect(res.status).toBe(302);
      expect(res.headers.location).toMatch(/\/\?authError=state$/);
      expect(authService.completeLogin).not.toHaveBeenCalled();
    });

    it('redirects to /?authError=state and creates no session when state is unknown/expired', async () => {
      vi.mocked(sessionService.consumeState).mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/auth/google/callback')
        .query({ code: 'abc', state: 'unknown-state' });

      expect(res.status).toBe(302);
      expect(res.headers.location).toMatch(/\/\?authError=state$/);
      expect(authService.completeLogin).not.toHaveBeenCalled();
    });

    it('redirects to /?authError=state and creates no session when state is replayed', async () => {
      // GETDEL semantics: a replayed state was already consumed, so the second call
      // must observe the same "not found" outcome as an unknown state.
      vi.mocked(sessionService.consumeState).mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/auth/google/callback')
        .query({ code: 'abc', state: 'replayed-state' });

      expect(res.status).toBe(302);
      expect(res.headers.location).toMatch(/\/\?authError=state$/);
      expect(authService.completeLogin).not.toHaveBeenCalled();
    });
  });
});
