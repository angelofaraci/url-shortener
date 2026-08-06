export interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

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

export interface MyLink {
  code: string;
  url: string;
  expiresAt: string | null;
  createdAt: string;
  totalClicks: number;
}

export type MyLinksResponse =
  | { authenticated: false; links: [] }
  | { authenticated: true; links: MyLink[] };

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
