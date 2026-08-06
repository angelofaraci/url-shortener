import { prisma } from '../lib/prisma.js';
import type { Click } from '../domain/click.js';

export interface CreateClickRecord {
  linkId: string;
  referrer: string | null;
  userAgent: string | null;
}

export interface DailyClickRow {
  day: Date;
  clicks: number;
}

export interface TopLinkRow {
  linkId: string;
  shortCode: string;
  totalClicks: number;
}

export const clickRepository = {
  async create(data: CreateClickRecord): Promise<Click> {
    return prisma.click.create({ data });
  },

  async countByLinkId(linkId: string): Promise<number> {
    return prisma.click.count({ where: { linkId } });
  },

  async findRecentByLinkId(linkId: string, limit: number): Promise<Click[]> {
    return prisma.click.findMany({
      where: { linkId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  },

  // Daily click counts (UTC calendar days) for a user's links, from `since` to
  // now. Values are bound parameters via the tagged template — never string
  // interpolation. `date_trunc` is bare (no `AT TIME ZONE`): Prisma stores
  // DateTime as Postgres `timestamp(3)` without time zone, already UTC, so
  // reinterpreting against the session TZ would silently shift buckets.
  // `COUNT(*)::int` avoids BigInt leaking into JSON serialization.
  async sumDailyByUser(userId: string, since: Date): Promise<DailyClickRow[]> {
    return prisma.$queryRaw<DailyClickRow[]>`
      SELECT date_trunc('day', c."timestamp") AS day, COUNT(*)::int AS clicks
      FROM "Click" c
      JOIN "Link" l ON l.id = c."linkId"
      WHERE l."userId" = ${userId} AND c."timestamp" >= ${since}
      GROUP BY 1
      ORDER BY 1
    `;
  },

  // All-time top links by click count for a user. INNER JOIN excludes
  // 0-click links by construction. Tiebreak is deterministic: newest link
  // first, then link id, so repeated calls return stable ordering.
  async topLinksByUser(userId: string, limit: number): Promise<TopLinkRow[]> {
    return prisma.$queryRaw<TopLinkRow[]>`
      SELECT l.id AS "linkId", l.code AS "shortCode", COUNT(c.id)::int AS "totalClicks"
      FROM "Link" l
      JOIN "Click" c ON c."linkId" = l.id
      WHERE l."userId" = ${userId}
      GROUP BY l.id, l.code, l."createdAt"
      ORDER BY COUNT(c.id) DESC, l."createdAt" DESC, l.id DESC
      LIMIT ${limit}
    `;
  },
};
