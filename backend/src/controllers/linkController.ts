import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { config } from '../config/index.js';
import { linkService, AliasTakenError, CodeGenerationExhaustedError } from '../services/linkService.js';
import { statsService } from '../services/statsService.js';
import { HttpError } from '../utils/httpError.js';

const createLinkSchema = z.object({
  url: z.string().url(),
  alias: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/, 'alias must be alphanumeric (dashes/underscores allowed)')
    .optional(),
  expiresAt: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), 'expiresAt must be a valid ISO date')
    .refine((value) => Date.parse(value) > Date.now(), 'expiresAt must be in the future')
    .optional(),
});

export async function createLink(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = createLinkSchema.parse(req.body);

    const link = await linkService.createLink(
      {
        url: body.url,
        alias: body.alias,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
        userId: req.user?.id ?? null,
      },
      config.shortCodeLength,
    );

    res.status(201).json({
      code: link.code,
      url: link.url,
      expiresAt: link.expiresAt,
      createdAt: link.createdAt,
    });
  } catch (error) {
    if (error instanceof AliasTakenError) {
      next(new HttpError(409, error.message));
      return;
    }
    if (error instanceof CodeGenerationExhaustedError) {
      next(new HttpError(503, error.message));
      return;
    }
    next(error);
  }
}

export async function listMyLinks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Owner scope comes only from req.ownerScope (session-derived by sessionGate).
    // Request-supplied values (query/body/headers) are never read for ownership.
    if (!req.ownerScope?.authenticated || !req.ownerScope.userId) {
      res.status(200).json({ authenticated: false, links: [] });
      return;
    }

    const links = await linkService.listByUser(req.ownerScope.userId);
    res.status(200).json({ authenticated: true, links });
  } catch (error) {
    next(error);
  }
}

export async function getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code } = req.params;

    // Owner scope comes only from req.ownerScope (session-derived by sessionGate).
    // No session → 404, matching the not-found/not-owned case below, so the
    // response never reveals whether a code exists to an unauthenticated caller.
    if (!req.ownerScope?.authenticated || !req.ownerScope.userId) {
      next(new HttpError(404, `No link found for code "${code}"`));
      return;
    }

    const stats = await statsService.getStatsByCode(code, req.ownerScope.userId);

    if (!stats) {
      next(new HttpError(404, `No link found for code "${code}"`));
      return;
    }

    res.status(200).json({
      code,
      totalClicks: stats.totalClicks,
      recentClicks: stats.recentClicks,
    });
  } catch (error) {
    next(error);
  }
}
