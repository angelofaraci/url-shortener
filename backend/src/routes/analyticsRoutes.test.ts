import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createFakeRateLimitRedis } from '../test/fakeRateLimitRedis.js';

const prismaMock = {
  link: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
  click: { create: vi.fn(), count: vi.fn(), findMany: vi.fn() },
  $queryRaw: vi.fn(),
};

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

// Same rate-limiter/session mocking pattern as linkRoutes.test.ts — no real
// Redis is reachable in this sandbox/test environment.
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

const { sessionService } = await import('../services/sessionService.js');
const { createApp } = await import('../app.js');

const app = createApp();

const SESSION_COOKIE = 'sid=test-session-id';
const OWNER = { id: 'user-1', email: 'owner@test.dev', name: 'Owner', avatarUrl: null };

describe('GET /api/analytics/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.reset();
    prismaMock.$queryRaw.mockResolvedValue([]);
  });

  it('returns 401 (never a redirect, never data) when there is no session/cookie', async () => {
    const res = await request(app).get('/api/analytics/dashboard');

    expect(res.status).toBe(401);
    expect(res.header.location).toBeUndefined();
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns 200 with the dashboard shape (JSON, not a 302 to /link-error) for an authenticated owner', async () => {
    vi.mocked(sessionService.get).mockResolvedValueOnce(OWNER);
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ day: new Date('2026-08-06T00:00:00.000Z'), clicks: 3 }])
      .mockResolvedValueOnce([{ linkId: 'link-1', shortCode: 'aaa', totalClicks: 3 }]);

    const res = await request(app).get('/api/analytics/dashboard').set('Cookie', SESSION_COOKIE);

    expect(res.status).toBe(200);
    expect(res.header.location).toBeUndefined();
    expect(res.body).toHaveProperty('totalClicks30d');
    expect(res.body).toHaveProperty('series');
    expect(res.body).toHaveProperty('topLinks');
    expect(res.body.series).toHaveLength(30);
    expect(res.body.totalClicks30d).toBe(3);
    expect(res.body.topLinks).toEqual([{ linkId: 'link-1', shortCode: 'aaa', totalClicks: 3 }]);
  });

  it('ignores a request-supplied ?userId= query and derives ownership from the session only (authz bypass)', async () => {
    vi.mocked(sessionService.get).mockResolvedValueOnce(OWNER);

    const res = await request(app)
      .get('/api/analytics/dashboard')
      .query({ userId: 'someone-elses-id' })
      .set('Cookie', SESSION_COOKIE);

    expect(res.status).toBe(200);
    // The bound parameter passed to $queryRaw must be the session's userId,
    // never the query-string value.
    const callArgs = prismaMock.$queryRaw.mock.calls[0] ?? [];
    expect(callArgs).toContain(OWNER.id);
    expect(callArgs).not.toContain('someone-elses-id');
  });

  it('passes a SQL-injection-shaped userId as a bound parameter, not interpolated into the query text', async () => {
    const maliciousId = `user-1' OR '1'='1`;
    vi.mocked(sessionService.get).mockResolvedValueOnce({ ...OWNER, id: maliciousId });

    const res = await request(app).get('/api/analytics/dashboard').set('Cookie', SESSION_COOKIE);

    expect(res.status).toBe(200);
    const [strings, ...values] = prismaMock.$queryRaw.mock.calls[0] ?? [[]];
    // The template strings (the actual SQL text) never contain the value —
    // it only ever appears as a bound parameter.
    expect((strings as string[]).join('')).not.toContain(maliciousId);
    expect(values).toContain(maliciousId);
  });

  it('is not shadowed by the "/:code" catch-all: reaches the JSON dashboard handler, not a redirect', async () => {
    vi.mocked(sessionService.get).mockResolvedValueOnce(OWNER);

    const dashboardRes = await request(app).get('/api/analytics/dashboard').set('Cookie', SESSION_COOKIE);

    // If '/api/analytics' were mounted after (or shadowed by) the single-segment
    // "/:code" catch-all, this request would 302 to /link-error instead of
    // returning the JSON dashboard body — see app.ts mount-order comment.
    expect(dashboardRes.status).toBe(200);
    expect(dashboardRes.header.location).toBeUndefined();
    expect(dashboardRes.body).toHaveProperty('totalClicks30d');
  });
});
