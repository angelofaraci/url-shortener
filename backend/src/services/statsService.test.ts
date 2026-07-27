import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repositories/linkRepository.js', () => ({
  linkRepository: {
    findByCode: vi.fn(),
  },
}));
vi.mock('../repositories/clickRepository.js', () => ({
  clickRepository: {
    countByLinkId: vi.fn(),
    findRecentByLinkId: vi.fn(),
  },
}));

const { linkRepository } = await import('../repositories/linkRepository.js');
const { clickRepository } = await import('../repositories/clickRepository.js');
const { statsService } = await import('./statsService.js');

const baseLink = {
  id: 'link-1',
  code: 'abc123',
  url: 'https://a.test',
  expiresAt: null,
  createdAt: new Date('2026-07-20T00:00:00.000Z'),
};

describe('statsService.getStatsByCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns stats when the link belongs to the requesting user', async () => {
    vi.mocked(linkRepository.findByCode).mockResolvedValueOnce({ ...baseLink, userId: 'user-1' });
    vi.mocked(clickRepository.countByLinkId).mockResolvedValueOnce(3);
    vi.mocked(clickRepository.findRecentByLinkId).mockResolvedValueOnce([]);

    const result = await statsService.getStatsByCode('abc123', 'user-1');

    expect(result).toEqual({ totalClicks: 3, recentClicks: [] });
  });

  it('returns null when the link belongs to a different user', async () => {
    vi.mocked(linkRepository.findByCode).mockResolvedValueOnce({ ...baseLink, userId: 'user-2' });

    const result = await statsService.getStatsByCode('abc123', 'user-1');

    expect(result).toBeNull();
    expect(clickRepository.countByLinkId).not.toHaveBeenCalled();
  });

  it('returns null when the link is anonymous (userId: null), regardless of caller', async () => {
    vi.mocked(linkRepository.findByCode).mockResolvedValueOnce({ ...baseLink, userId: null });

    const result = await statsService.getStatsByCode('abc123', 'user-1');

    expect(result).toBeNull();
    expect(clickRepository.countByLinkId).not.toHaveBeenCalled();
  });

  it('returns null when the code does not match any link', async () => {
    vi.mocked(linkRepository.findByCode).mockResolvedValueOnce(null);

    const result = await statsService.getStatsByCode('missing', 'user-1');

    expect(result).toBeNull();
    expect(clickRepository.countByLinkId).not.toHaveBeenCalled();
  });
});
