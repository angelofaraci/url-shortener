import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repositories/linkRepository.js', () => ({
  linkRepository: {
    findByUserId: vi.fn(),
    create: vi.fn(),
  },
}));
vi.mock('../repositories/clickRepository.js', () => ({
  clickRepository: {
    countByLinkId: vi.fn(),
  },
}));

const { linkRepository } = await import('../repositories/linkRepository.js');
const { clickRepository } = await import('../repositories/clickRepository.js');
const { linkService } = await import('./linkService.js');

describe('linkService.listByUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('composes totalClicks per link via clickRepository, preserving repository order', async () => {
    const linkA = { id: 'link-a', code: 'aaa', url: 'https://a.test', expiresAt: null, createdAt: new Date('2026-07-20T00:00:00.000Z'), userId: 'user-1' };
    const linkB = { id: 'link-b', code: 'bbb', url: 'https://b.test', expiresAt: null, createdAt: new Date('2026-07-19T00:00:00.000Z'), userId: 'user-1' };
    vi.mocked(linkRepository.findByUserId).mockResolvedValueOnce([linkA, linkB]);
    vi.mocked(clickRepository.countByLinkId).mockImplementation(async (linkId: string) => (linkId === 'link-a' ? 5 : 2));

    const result = await linkService.listByUser('user-1');

    expect(linkRepository.findByUserId).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([
      { code: 'aaa', url: 'https://a.test', expiresAt: null, createdAt: linkA.createdAt, totalClicks: 5 },
      { code: 'bbb', url: 'https://b.test', expiresAt: null, createdAt: linkB.createdAt, totalClicks: 2 },
    ]);
  });

  it('returns an empty array without calling clickRepository when the user owns no links', async () => {
    vi.mocked(linkRepository.findByUserId).mockResolvedValueOnce([]);

    const result = await linkService.listByUser('user-2');

    expect(result).toEqual([]);
    expect(clickRepository.countByLinkId).not.toHaveBeenCalled();
  });
});

describe('linkService.createLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(linkRepository.create).mockImplementation(async (input) => ({
      id: 'link-1',
      code: input.code,
      url: input.url,
      expiresAt: input.expiresAt,
      userId: input.userId,
      createdAt: new Date(),
    }));
  });

  it('defaults anonymous links (no userId, no expiresAt) to a 24h expiry', async () => {
    const before = Date.now();

    const link = await linkService.createLink({ url: 'https://a.test', userId: null }, 6);

    const after = Date.now();
    expect(link.expiresAt).not.toBeNull();
    const expiresAtMs = link.expiresAt!.getTime();
    expect(expiresAtMs).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000);
    expect(expiresAtMs).toBeLessThanOrEqual(after + 24 * 60 * 60 * 1000);
  });

  it('leaves logged-in links (userId set, no expiresAt) without an expiry', async () => {
    const link = await linkService.createLink({ url: 'https://a.test', userId: 'user-1' }, 6);

    expect(link.expiresAt).toBeNull();
  });

  it('honors an explicit expiresAt regardless of userId', async () => {
    const explicit = new Date(Date.now() + 60 * 60 * 1000);

    const link = await linkService.createLink({ url: 'https://a.test', userId: null, expiresAt: explicit }, 6);

    expect(link.expiresAt).toEqual(explicit);
  });
});
