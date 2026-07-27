import { prisma } from '../lib/prisma.js';
import type { Link } from '../domain/link.js';

export interface CreateLinkRecord {
  code: string;
  url: string;
  expiresAt: Date | null;
  userId: string | null;
}

export const linkRepository = {
  async create(data: CreateLinkRecord): Promise<Link> {
    return prisma.link.create({ data });
  },

  async findByCode(code: string): Promise<Link | null> {
    return prisma.link.findUnique({ where: { code } });
  },

  // `userId` equality never matches `userId: null` rows, so anonymous links can
  // never leak into an owner's listing.
  async findByUserId(userId: string): Promise<Link[]> {
    return prisma.link.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  },
};
