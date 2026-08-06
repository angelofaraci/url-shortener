import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createFakeRateLimitRedis } from '../test/fakeRateLimitRedis.js';

const prismaMock = {
  link: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
  click: { create: vi.fn(), count: vi.fn(), findMany: vi.fn() },
};

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

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

const { sessionService } = await import('../services/sessionService.js');
const { createApp } = await import('../app.js');

const app = createApp();

const SESSION_COOKIE = 'sid=test-session-id';
const OWNER = { id: 'user-1', email: 'owner@test.dev', name: 'Owner', avatarUrl: null };

const ownedLink = {
  id: 'link-1',
  code: 'aaa',
  url: 'https://a.test',
  expiresAt: null,
  createdAt: new Date('2026-07-20T00:00:00.000Z'),
  userId: 'user-1',
};
const foreignLink = { ...ownedLink, id: 'link-2', code: 'bbb', userId: 'user-2' };
const anonymousLink = { ...ownedLink, id: 'link-3', code: 'ccc', userId: null };

describe('GET /api/links/:code/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.reset();
  });

  it('returns 200 with stats for a link the requester owns', async () => {
    vi.mocked(sessionService.get).mockResolvedValueOnce(OWNER);
    prismaMock.link.findUnique.mockResolvedValueOnce(ownedLink);
    prismaMock.click.count.mockResolvedValueOnce(5);
    prismaMock.click.findMany.mockResolvedValueOnce([]);

    const res = await request(app).get('/api/links/aaa/stats').set('Cookie', SESSION_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ code: 'aaa', totalClicks: 5, recentClicks: [] });
  });

  it('returns 404 for a link owned by another user', async () => {
    vi.mocked(sessionService.get).mockResolvedValueOnce(OWNER);
    prismaMock.link.findUnique.mockResolvedValueOnce(foreignLink);

    const res = await request(app).get('/api/links/bbb/stats').set('Cookie', SESSION_COOKIE);

    expect(res.status).toBe(404);
    expect(prismaMock.click.count).not.toHaveBeenCalled();
  });

  it('returns 404 for an anonymous (userId: null) link', async () => {
    vi.mocked(sessionService.get).mockResolvedValueOnce(OWNER);
    prismaMock.link.findUnique.mockResolvedValueOnce(anonymousLink);

    const res = await request(app).get('/api/links/ccc/stats').set('Cookie', SESSION_COOKIE);

    expect(res.status).toBe(404);
  });

  it('returns 404 for a code that does not exist', async () => {
    vi.mocked(sessionService.get).mockResolvedValueOnce(OWNER);
    prismaMock.link.findUnique.mockResolvedValueOnce(null);

    const res = await request(app).get('/api/links/missing/stats').set('Cookie', SESSION_COOKIE);

    expect(res.status).toBe(404);
  });

  it('returns 404 (never 401 or 403) when there is no session/cookie', async () => {
    const res = await request(app).get('/api/links/aaa/stats');

    expect(res.status).toBe(404);
    expect(prismaMock.link.findUnique).not.toHaveBeenCalled();
  });
});

describe('POST /api/links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.reset();
  });

  it('rejects an expiresAt in the past with 400', async () => {
    const res = await request(app)
      .post('/api/links')
      .send({ url: 'https://a.test', expiresAt: '2020-01-01T00:00:00.000Z' });

    expect(res.status).toBe(400);
    expect(prismaMock.link.create).not.toHaveBeenCalled();
  });

  it.each(['dashboard', 'stats', 'links', 'assets', 'index.html', 'link-error', 'api', 'auth', 'health'])(
    'rejects reserved alias "%s" with 400',
    async (alias) => {
      const res = await request(app).post('/api/links').send({ url: 'https://a.test', alias });

      expect(res.status).toBe(400);
      expect(prismaMock.link.create).not.toHaveBeenCalled();
    },
  );

  it('defaults an anonymous link with no expiresAt to ~24h out', async () => {
    prismaMock.link.create.mockImplementationOnce(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'link-4',
      createdAt: new Date(),
      ...data,
    }));

    const before = Date.now();
    const res = await request(app).post('/api/links').send({ url: 'https://a.test' });
    const after = Date.now();

    expect(res.status).toBe(201);
    const expiresAtMs = new Date(res.body.expiresAt).getTime();
    expect(expiresAtMs).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000);
    expect(expiresAtMs).toBeLessThanOrEqual(after + 24 * 60 * 60 * 1000);
  });
});
