import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repositories/linkRepository.js', () => ({
  linkRepository: {
    findByUserId: vi.fn(),
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
