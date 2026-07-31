import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createFakeRateLimitRedis } from '../test/fakeRateLimitRedis.js';

const prismaMock = {
  link: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
  click: { create: vi.fn(), count: vi.fn(), findMany: vi.fn() },
};

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

// Same convention as linkController.test.ts/linkRoutes.test.ts: no real Redis
// is reachable here. The rate limiter still needs the fake (it's wired
// globally in app.ts), but redirectCacheService's plain GET/SET aren't
// commands the fake implements, so that service is mocked directly instead.
const redisMock = createFakeRateLimitRedis();
vi.mock('../lib/redis.js', () => ({ redis: redisMock }));

vi.mock('../services/redirectCacheService.js', () => ({
  redirectCacheService: {
    getUrl: vi.fn().mockResolvedValue(null),
    cacheUrl: vi.fn(),
  },
}));

vi.mock('../services/sessionService.js', () => ({
  sessionService: {
    create: vi.fn(),
    get: vi.fn(),
    destroy: vi.fn(),
    putState: vi.fn(),
    consumeState: vi.fn(),
  },
}));

const { createApp } = await import('../app.js');

const app = createApp();

describe('GET /:code (redirect)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.reset();
  });

  it('sends the browser to the app link-error screen when the code does not exist', async () => {
    prismaMock.link.findUnique.mockResolvedValueOnce(null);

    const res = await request(app).get('/missing').redirects(0);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('http://localhost:5173/link-error?reason=not-found');
  });

  it('sends the browser to the app link-error screen when the link has expired', async () => {
    prismaMock.link.findUnique.mockResolvedValueOnce({
      id: 'link-1',
      code: 'aaa',
      url: 'https://a.test',
      expiresAt: new Date('2020-01-01T00:00:00.000Z'),
      createdAt: new Date('2019-01-01T00:00:00.000Z'),
      userId: null,
    });

    const res = await request(app).get('/aaa').redirects(0);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('http://localhost:5173/link-error?reason=expired');
  });

  it('redirects to the destination URL for a live link', async () => {
    prismaMock.link.findUnique.mockResolvedValue({
      id: 'link-2',
      code: 'bbb',
      url: 'https://b.test',
      expiresAt: null,
      createdAt: new Date('2026-07-20T00:00:00.000Z'),
      userId: null,
    });

    const res = await request(app).get('/bbb').redirects(0);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://b.test');
  });
});
