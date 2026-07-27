import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  link: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
};

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const { linkRepository } = await import('./linkRepository.js');

describe('linkRepository.findByUserId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries by userId equality and orders newest first', async () => {
    const rows = [{ id: 'link-2', code: 'bbb', url: 'https://b.test', expiresAt: null, createdAt: new Date(), userId: 'user-1' }];
    prismaMock.link.findMany.mockResolvedValueOnce(rows);

    const result = await linkRepository.findByUserId('user-1');

    expect(prismaMock.link.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toEqual(rows);
  });

  it('returns an empty array when the user owns no links, without touching other users\' data', async () => {
    prismaMock.link.findMany.mockResolvedValueOnce([]);

    const result = await linkRepository.findByUserId('user-2');

    expect(prismaMock.link.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-2' },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toEqual([]);
  });
});
