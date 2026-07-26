import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  link: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
};
const redisMock = { del: vi.fn() };

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../lib/redis.js', () => ({ redis: redisMock }));

const { cleanupAnonymousLinks } = await import('./cleanupAnonymousLinks.js');

// Fixed clock so the 24h cutoff is deterministic across the boundary cases.
const now = new Date('2026-07-26T12:00:00.000Z');
const cutoff = new Date(now.getTime() - 24 * 3_600_000); // 2026-07-25T12:00:00.000Z

const ownedOld = {
  id: 'link-owned-old',
  code: 'owned-old',
  userId: 'user-1',
  createdAt: new Date('2026-07-01T00:00:00.000Z'), // far older than 24h, but owned
};
const anon23h59m = {
  id: 'link-anon-2359',
  code: 'anon-2359',
  userId: null,
  createdAt: new Date(cutoff.getTime() + 60_000), // 1 minute inside the TTL window
};
const anon24h01m = {
  id: 'link-anon-2401',
  code: 'anon-2401',
  userId: null,
  createdAt: new Date(cutoff.getTime() - 60_000), // 1 minute past the TTL window
};

const allRows = [ownedOld, anon23h59m, anon24h01m];

// Mirrors the Postgres predicate (`userId IS NULL AND createdAt < cutoff`) applied
// to the exact `where` clause cleanupAnonymousLinks passes, so this test exercises
// the real boundary logic instead of a re-implemented copy of it.
function fakeFindMany({ where }: { where: { userId: null; createdAt: { lt: Date } } }) {
  return allRows.filter((row) => row.userId === where.userId && row.createdAt.getTime() < where.createdAt.lt.getTime());
}

describe('cleanupAnonymousLinks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes only anonymous links past the 24h TTL, keeping owned links and links inside the window', async () => {
    prismaMock.link.findMany.mockImplementationOnce(fakeFindMany);
    prismaMock.link.deleteMany.mockResolvedValueOnce({ count: 1 });

    const result = await cleanupAnonymousLinks(now);

    expect(prismaMock.link.findMany).toHaveBeenCalledWith({
      where: { userId: null, createdAt: { lt: cutoff } },
      select: { id: true, code: true },
      take: 500,
    });
    // Only the 24h01m-old anonymous link is doomed — owned-old and 23h59m are excluded.
    expect(prismaMock.link.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [anon24h01m.id] } },
    });
    expect(redisMock.del).toHaveBeenCalledWith(anon24h01m.code);
    expect(result).toEqual({ scanned: 1, deleted: 1 });
  });

  it('keeps an owned link regardless of age', async () => {
    prismaMock.link.findMany.mockImplementationOnce(({ where }: { where: { userId: null } }) =>
      allRows.filter((row) => row.userId === where.userId),
    );
    prismaMock.link.deleteMany.mockResolvedValueOnce({ count: 0 });

    await cleanupAnonymousLinks(now);

    const deletedIds = prismaMock.link.deleteMany.mock.calls[0]?.[0]?.where?.id?.in ?? [];
    expect(deletedIds).not.toContain(ownedOld.id);
  });

  it('keeps an anonymous link at exactly 23h59m old', async () => {
    prismaMock.link.findMany.mockImplementationOnce(fakeFindMany);
    prismaMock.link.deleteMany.mockResolvedValueOnce({ count: 1 });

    await cleanupAnonymousLinks(now);

    const deletedIds = prismaMock.link.deleteMany.mock.calls[0]?.[0]?.where?.id?.in ?? [];
    expect(deletedIds).not.toContain(anon23h59m.id);
  });

  it('deletes Postgres rows before purging the Redis cache (D6 ordering)', async () => {
    const callOrder: string[] = [];
    prismaMock.link.findMany.mockImplementationOnce(fakeFindMany);
    prismaMock.link.deleteMany.mockImplementationOnce(async () => {
      callOrder.push('deleteMany');
      return { count: 1 };
    });
    redisMock.del.mockImplementationOnce(async () => {
      callOrder.push('redis.del');
      return 1;
    });

    await cleanupAnonymousLinks(now);

    expect(callOrder).toEqual(['deleteMany', 'redis.del']);
  });

  it('does not touch Redis when there is nothing to delete', async () => {
    prismaMock.link.findMany.mockResolvedValueOnce([]);

    const result = await cleanupAnonymousLinks(now);

    expect(prismaMock.link.deleteMany).not.toHaveBeenCalled();
    expect(redisMock.del).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 0, deleted: 0 });
  });
});
