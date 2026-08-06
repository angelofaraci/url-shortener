import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  click: { create: vi.fn(), count: vi.fn(), findMany: vi.fn() },
  $queryRaw: vi.fn(),
};

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const { clickRepository } = await import('./clickRepository.js');

describe('clickRepository.sumDailyByUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns UTC-bucketed daily rows scoped to the given user', async () => {
    const rows = [
      { day: new Date('2026-08-05T00:00:00.000Z'), clicks: 3 },
      { day: new Date('2026-08-06T00:00:00.000Z'), clicks: 7 },
    ];
    prismaMock.$queryRaw.mockResolvedValueOnce(rows);

    const since = new Date('2026-07-08T00:00:00.000Z');
    const result = await clickRepository.sumDailyByUser('user-1', since);

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result).toEqual(rows);
  });

  it('returns a different shape for a different user/window without leaking prior mock state', async () => {
    const rows = [{ day: new Date('2026-08-01T00:00:00.000Z'), clicks: 1 }];
    prismaMock.$queryRaw.mockResolvedValueOnce(rows);

    const since = new Date('2026-07-01T00:00:00.000Z');
    const result = await clickRepository.sumDailyByUser('user-2', since);

    expect(result).toEqual(rows);
  });
});

describe('clickRepository.topLinksByUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all-time top links scoped to the given user, capped at the requested limit', async () => {
    const rows = [
      { linkId: 'link-1', shortCode: 'aaa', totalClicks: 42 },
      { linkId: 'link-2', shortCode: 'bbb', totalClicks: 10 },
    ];
    prismaMock.$queryRaw.mockResolvedValueOnce(rows);

    const result = await clickRepository.topLinksByUser('user-1', 5);

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result).toEqual(rows);
  });

  it('returns fewer than limit entries when the user has fewer qualifying links', async () => {
    const rows = [{ linkId: 'link-3', shortCode: 'ccc', totalClicks: 1 }];
    prismaMock.$queryRaw.mockResolvedValueOnce(rows);

    const result = await clickRepository.topLinksByUser('user-2', 5);

    expect(result).toEqual(rows);
    expect(result).toHaveLength(1);
  });
});
