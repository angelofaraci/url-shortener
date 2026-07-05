export interface Link {
  code: string;
  url: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface ClickStat {
  timestamp: string | null;
  referrer: string | null;
  userAgent: string | null;
}

export interface StatsResponse {
  code: string;
  totalClicks: number;
  recentClicks: ClickStat[];
}
