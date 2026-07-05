import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { linkService } from '../services/linkService.js';
import { redirectCacheService } from '../services/redirectCacheService.js';
import { statsService } from '../services/statsService.js';
import { logger } from '../lib/logger.js';
import { HttpError } from '../utils/httpError.js';

export async function redirect(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code } = req.params;

    const cachedUrl = await redirectCacheService.getUrl(code);
    if (cachedUrl) {
      sendRedirect(req, res, code, cachedUrl);
      return;
    }

    const link = await linkService.getByCode(code);
    if (!link) {
      next(new HttpError(404, `No link found for code "${code}"`));
      return;
    }

    if (linkService.isExpired(link)) {
      next(new HttpError(410, `Link "${code}" has expired`));
      return;
    }

    const ttlSeconds = linkService.getCacheTtlSeconds(link, config.defaultCacheTtlSeconds);
    await redirectCacheService.cacheUrl(code, link.url, ttlSeconds);

    sendRedirect(req, res, code, link.url);
  } catch (error) {
    next(error);
  }
}

function sendRedirect(req: Request, res: Response, code: string, url: string): void {
  res.redirect(302, url);
  recordClickForCode(req, code);
}

// Fire-and-forget: click logging must never add latency to the redirect response.
// We still resolve the link's id and catch rejections so failures are logged instead
// of surfacing as unhandled promise rejections.
function recordClickForCode(req: Request, code: string): void {
  const referrer = req.get('referer') ?? null;
  const userAgent = req.get('user-agent') ?? null;

  void (async () => {
    const link = await linkService.getByCode(code);
    if (!link) {
      return;
    }
    await statsService.recordClick(link.id, referrer, userAgent);
  })().catch((error: unknown) => {
    logger.error({ err: error, code }, 'Failed to record click');
  });
}
