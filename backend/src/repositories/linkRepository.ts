import { prisma } from '../lib/prisma.js';
import type { Link } from '../domain/link.js';

export interface CreateLinkRecord {
  code: string;
  url: string;
  expiresAt: Date | null;
}

export const linkRepository = {
  async create(data: CreateLinkRecord): Promise<Link> {
    return prisma.link.create({ data });
  },

  async findByCode(code: string): Promise<Link | null> {
    return prisma.link.findUnique({ where: { code } });
  },
};
