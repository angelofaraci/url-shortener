import { clickRepository } from '../repositories/clickRepository.js';

const WINDOW_DAYS = 30;
const TOP_LINKS_LIMIT = 5;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface SeriesPoint {
  date: string;
  clicks: number;
}

export interface TopLink {
  linkId: string;
  shortCode: string;
  totalClicks: number;
}

export interface DashboardAnalytics {
  totalClicks30d: number;
  series: SeriesPoint[];
  topLinks: TopLink[];
}

// UTC calendar-day key ("YYYY-MM-DD"), independent of the requester's local
// timezone. Matches the bare date_trunc('day', ...) bucketing in the raw SQL
// query (clickRepository.sumDailyByUser) — see design D1's Postgres gotcha.
function toUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Builds WINDOW_DAYS contiguous UTC-day buckets ending today (inclusive),
// oldest first, and zero-fills any day the repository did not return a row
// for. Pure function — no I/O, trivially unit-testable at the 30-boundary,
// short-history, and empty-history edges (design D3).
function zeroFillSeries(rows: { day: Date; clicks: number }[], now: Date): SeriesPoint[] {
  const clicksByDay = new Map(rows.map((row) => [toUtcDateKey(row.day), row.clicks]));
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const series: SeriesPoint[] = [];
  for (let offset = WINDOW_DAYS - 1; offset >= 0; offset -= 1) {
    const bucketDate = new Date(todayUtc - offset * ONE_DAY_MS);
    const dateKey = toUtcDateKey(bucketDate);
    series.push({ date: dateKey, clicks: clicksByDay.get(dateKey) ?? 0 });
  }
  return series;
}

export const analyticsService = {
  async getDashboard(userId: string): Promise<DashboardAnalytics> {
    const now = new Date();
    const since = new Date(now.getTime() - (WINDOW_DAYS - 1) * ONE_DAY_MS);

    const [dailyRows, topLinks] = await Promise.all([
      clickRepository.sumDailyByUser(userId, since),
      clickRepository.topLinksByUser(userId, TOP_LINKS_LIMIT),
    ]);

    const series = zeroFillSeries(dailyRows, now);
    // Derived from the series, not a third query: same filter, same window,
    // so a separate query could only ever disagree (design D2).
    const totalClicks30d = series.reduce((sum, point) => sum + point.clicks, 0);

    return { totalClicks30d, series, topLinks };
  },
};
