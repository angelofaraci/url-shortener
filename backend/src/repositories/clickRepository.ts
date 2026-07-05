import { prisma } from '../lib/prisma.js';
import type { Click } from '../domain/click.js';

export interface CreateClickRecord {
  linkId: string;
  referrer: string | null;
  userAgent: string | null;
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
};
