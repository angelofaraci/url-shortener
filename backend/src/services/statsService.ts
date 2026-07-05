import { clickRepository } from '../repositories/clickRepository.js';
import { linkRepository } from '../repositories/linkRepository.js';
import type { Click } from '../domain/click.js';

const RECENT_CLICKS_LIMIT = 20;

export interface LinkStats {
  totalClicks: number;
  recentClicks: Click[];
}

export const statsService = {
  async recordClick(linkId: string, referrer: string | null, userAgent: string | null): Promise<void> {
    await clickRepository.create({ linkId, referrer, userAgent });
  },

  async getStatsByCode(code: string): Promise<LinkStats | null> {
    const link = await linkRepository.findByCode(code);
    if (!link) {
      return null;
    }

    const [totalClicks, recentClicks] = await Promise.all([
      clickRepository.countByLinkId(link.id),
      clickRepository.findRecentByLinkId(link.id, RECENT_CLICKS_LIMIT),
    ]);

    return { totalClicks, recentClicks };
  },
};
