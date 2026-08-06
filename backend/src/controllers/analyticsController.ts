import type { Request, Response, NextFunction } from 'express';
import { analyticsService } from '../services/analyticsService.js';
import { HttpError } from '../utils/httpError.js';

export async function getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // D6: deviates from both existing owner-scoped routes (200/{authenticated:false}
    // on /api/links, 404 on /:code/stats). Neither rationale applies here — the
    // dashboard has no enumeration surface and no anonymous rendering — so the
    // spec-mandated 401 is returned directly, controller-local, no new blocking
    // middleware. Owner scope comes only from req.ownerScope (session-derived by
    // sessionGate), never from query/body/header.
    if (!req.ownerScope?.authenticated || !req.ownerScope.userId) {
      next(new HttpError(401, 'Authentication required'));
      return;
    }

    const dashboard = await analyticsService.getDashboard(req.ownerScope.userId);
    res.status(200).json(dashboard);
  } catch (error) {
    next(error);
  }
}
