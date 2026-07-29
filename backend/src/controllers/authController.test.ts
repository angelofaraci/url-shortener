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
  STATE_TTL_SECONDS: 600,
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
        .query({ code: 'abc', state: 'unknown-state' })
        .set('Cookie', 'oauth_state=unknown-state');

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
        .query({ code: 'abc', state: 'replayed-state' })
        .set('Cookie', 'oauth_state=replayed-state');

      expect(res.status).toBe(302);
      expect(res.headers.location).toMatch(/\/\?authError=state$/);
      expect(authService.completeLogin).not.toHaveBeenCalled();
    });
  });

  describe('login-CSRF protection: state bound to the initiating browser via oauth_state cookie', () => {
    it('sets an oauth_state cookie on /auth/google whose value matches the state sent to Google', async () => {
      vi.mocked(authService.isConfigured).mockReturnValueOnce(true);
      vi.mocked(sessionService.putState).mockResolvedValueOnce('csrf-state-value');

      const res = await request(app).get('/auth/google');

      expect(res.status).toBe(302);
      const redirectUrl = new URL(res.headers.location);
      expect(redirectUrl.searchParams.get('state')).toBe('csrf-state-value');

      const setCookie = (res.headers['set-cookie'] ?? []) as unknown as string[];
      const oauthStateCookie = setCookie.find((c) => c.startsWith('oauth_state='));
      expect(oauthStateCookie).toBeDefined();
      expect(oauthStateCookie).toContain('oauth_state=csrf-state-value');
      expect(oauthStateCookie).toMatch(/HttpOnly/i);
    });

    it('redirects to /?authError=state and creates no session when the oauth_state cookie is missing (attacker-relayed callback)', async () => {
      const res = await request(app)
        .get('/auth/google/callback')
        .query({ code: 'abc', state: 'valid-state' });

      expect(res.status).toBe(302);
      expect(res.headers.location).toMatch(/\/\?authError=state$/);
      expect(authService.completeLogin).not.toHaveBeenCalled();
      expect(sessionService.consumeState).not.toHaveBeenCalled();
    });

    it('redirects to /?authError=state and creates no session when the oauth_state cookie does not match the state query param', async () => {
      const res = await request(app)
        .get('/auth/google/callback')
        .query({ code: 'abc', state: 'valid-state' })
        .set('Cookie', 'oauth_state=a-different-state');

      expect(res.status).toBe(302);
      expect(res.headers.location).toMatch(/\/\?authError=state$/);
      expect(authService.completeLogin).not.toHaveBeenCalled();
      expect(sessionService.consumeState).not.toHaveBeenCalled();
    });

    it('always clears the oauth_state cookie on the callback, even on rejection', async () => {
      const res = await request(app)
        .get('/auth/google/callback')
        .query({ code: 'abc', state: 'valid-state' })
        .set('Cookie', 'oauth_state=a-different-state');

      const setCookie = (res.headers['set-cookie'] ?? []) as unknown as string[];
      const clearedCookie = setCookie.find((c) => c.startsWith('oauth_state='));
      expect(clearedCookie).toBeDefined();
      expect(clearedCookie).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/);
    });

    it('proceeds through login when the oauth_state cookie matches the state query param', async () => {
      vi.mocked(sessionService.consumeState).mockResolvedValueOnce('/dashboard');
      vi.mocked(authService.completeLogin).mockResolvedValueOnce({
        sessionId: 'new-session-id',
        user: { id: 'u1', email: 'a@b.com', name: 'A', avatarUrl: null },
      });

      const res = await request(app)
        .get('/auth/google/callback')
        .query({ code: 'abc', state: 'valid-state' })
        .set('Cookie', 'oauth_state=valid-state');

      expect(res.status).toBe(302);
      expect(sessionService.consumeState).toHaveBeenCalledWith('valid-state');
      expect(authService.completeLogin).toHaveBeenCalledWith('abc');
      expect(res.headers.location).toBe('http://localhost:5173/dashboard');

      const setCookie = (res.headers['set-cookie'] ?? []) as unknown as string[];
      expect(setCookie.some((c) => c.startsWith('sid=new-session-id'))).toBe(true);

      const clearedOauthStateCookie = setCookie.find((c) => c.startsWith('oauth_state='));
      expect(clearedOauthStateCookie).toBeDefined();
      expect(clearedOauthStateCookie).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/);
    });
  });
});
