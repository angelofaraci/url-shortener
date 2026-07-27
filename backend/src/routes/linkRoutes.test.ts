import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const prismaMock = {
  link: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
  click: { create: vi.fn(), count: vi.fn(), findMany: vi.fn() },
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

const { sessionService } = await import('../services/sessionService.js');
const { createApp } = await import('../app.js');

const app = createApp();

const SESSION_COOKIE = 'sid=test-session-id';
const OWNER = { id: 'user-1', email: 'owner@test.dev', name: 'Owner', avatarUrl: null };

const ownerLinks = [
  { id: 'link-1', code: 'aaa', url: 'https://a.test', expiresAt: null, createdAt: new Date('2026-07-20T00:00:00.000Z'), userId: 'user-1' },
  { id: 'link-2', code: 'bbb', url: 'https://b.test', expiresAt: null, createdAt: new Date('2026-07-19T00:00:00.000Z'), userId: 'user-1' },
];
const anonymousLink = {
  id: 'link-anon',
  code: 'ccc',
  url: 'https://c.test',
  expiresAt: null,
  createdAt: new Date('2026-07-18T00:00:00.000Z'),
  userId: null,
};
const allRows = [...ownerLinks, anonymousLink];

// Mirrors the real `where: { userId }` predicate that linkRepository.findByUserId
// passes to Prisma, so this exercises the actual exclusion logic instead of a
// re-implemented copy of it.
function fakeFindMany({ where }: { where: { userId: string } }) {
  return allRows.filter((row) => row.userId === where.userId);
}

describe('GET /api/links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with owned links and correct totalClicks for an authenticated user', async () => {
    vi.mocked(sessionService.get).mockResolvedValueOnce(OWNER);
    prismaMock.link.findMany.mockImplementationOnce(fakeFindMany);
    prismaMock.click.count.mockImplementation(async ({ where }: { where: { linkId: string } }) =>
      where.linkId === 'link-1' ? 5 : 2,
    );

    const res = await request(app).get('/api/links').set('Cookie', SESSION_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      authenticated: true,
      links: [
        { code: 'aaa', url: 'https://a.test', expiresAt: null, createdAt: ownerLinks[0].createdAt.toISOString(), totalClicks: 5 },
        { code: 'bbb', url: 'https://b.test', expiresAt: null, createdAt: ownerLinks[1].createdAt.toISOString(), totalClicks: 2 },
      ],
    });
  });

  it('returns 200 with an empty links array for an authenticated user who owns no links', async () => {
    vi.mocked(sessionService.get).mockResolvedValueOnce({ ...OWNER, id: 'user-empty' });
    prismaMock.link.findMany.mockImplementationOnce(fakeFindMany);

    const res = await request(app).get('/api/links').set('Cookie', SESSION_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ authenticated: true, links: [] });
    expect(prismaMock.click.count).not.toHaveBeenCalled();
  });

  it('returns 200 with the anonymous shape when there is no session — never 401, never a redirect', async () => {
    const res = await request(app).get('/api/links');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ authenticated: false, links: [] });
    expect(res.header.location).toBeUndefined();
  });

  it('excludes an anonymous (userId: null) link from the owner listing', async () => {
    vi.mocked(sessionService.get).mockResolvedValueOnce(OWNER);
    prismaMock.link.findMany.mockImplementationOnce(fakeFindMany);
    prismaMock.click.count.mockResolvedValue(0);

    const res = await request(app).get('/api/links').set('Cookie', SESSION_COOKIE);

    const codes = (res.body.links as Array<{ code: string }>).map((link) => link.code);
    expect(codes).toEqual(['aaa', 'bbb']);
    expect(codes).not.toContain(anonymousLink.code);
  });

  it('ignores a request-supplied ?userId= query and derives ownership from the session only', async () => {
    const res = await request(app).get('/api/links').query({ userId: 'user-1' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ authenticated: false, links: [] });
    expect(prismaMock.link.findMany).not.toHaveBeenCalled();
  });

  it('does not shadow the existing GET /api/links/:code/stats route', async () => {
    prismaMock.link.findUnique.mockResolvedValueOnce(ownerLinks[0]);
    prismaMock.click.count.mockResolvedValueOnce(3);
    prismaMock.click.findMany.mockResolvedValueOnce([]);

    const statsRes = await request(app).get('/api/links/aaa/stats');
    const listRes = await request(app).get('/api/links');

    expect(statsRes.status).toBe(200);
    expect(statsRes.body).toEqual({ code: 'aaa', totalClicks: 3, recentClicks: [] });
    expect(listRes.status).toBe(200);
    expect(listRes.body).toEqual({ authenticated: false, links: [] });
  });
});
