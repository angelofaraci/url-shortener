import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../repositories/clickRepository.js', () => ({
  clickRepository: {
    sumDailyByUser: vi.fn(),
    topLinksByUser: vi.fn(),
  },
}));

const { clickRepository } = await import('../repositories/clickRepository.js');
const { analyticsService } = await import('./analyticsService.js');

const NOW = new Date('2026-08-06T12:00:00.000Z');

describe('analyticsService.getDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns exactly 30 contiguous zero-filled buckets, oldest to newest, when there are no clicks', async () => {
    vi.mocked(clickRepository.sumDailyByUser).mockResolvedValueOnce([]);
    vi.mocked(clickRepository.topLinksByUser).mockResolvedValueOnce([]);

    const result = await analyticsService.getDashboard('user-1');

    expect(result.series).toHaveLength(30);
    expect(result.series[0]?.date).toBe('2026-07-08');
    expect(result.series[29]?.date).toBe('2026-08-06');
    expect(result.series.every((point) => point.clicks === 0)).toBe(true);
    expect(result.totalClicks30d).toBe(0);
    expect(result.topLinks).toEqual([]);
  });

  it('fills leading zeros for short account history and sums totalClicks30d from the series', async () => {
    vi.mocked(clickRepository.sumDailyByUser).mockResolvedValueOnce([
      { day: new Date('2026-08-05T00:00:00.000Z'), clicks: 4 },
      { day: new Date('2026-08-06T00:00:00.000Z'), clicks: 6 },
    ]);
    vi.mocked(clickRepository.topLinksByUser).mockResolvedValueOnce([
      { linkId: 'link-1', shortCode: 'aaa', totalClicks: 10 },
    ]);

    const result = await analyticsService.getDashboard('user-1');

    expect(result.series).toHaveLength(30);
    const aug5 = result.series.find((point) => point.date === '2026-08-05');
    const aug6 = result.series.find((point) => point.date === '2026-08-06');
    expect(aug5?.clicks).toBe(4);
    expect(aug6?.clicks).toBe(6);
    expect(result.series.filter((point) => point.clicks === 0)).toHaveLength(28);
    expect(result.totalClicks30d).toBe(10);
    expect(result.topLinks).toEqual([{ linkId: 'link-1', shortCode: 'aaa', totalClicks: 10 }]);
  });
});
