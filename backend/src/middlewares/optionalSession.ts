import type { NextFunction, Request, Response } from 'express';
import { config } from '../config/index.js';
import { sessionService } from '../services/sessionService.js';
import { logger } from '../lib/logger.js';

// Never blocks or rejects a request: a missing/garbage/expired cookie, or a Redis
// error, all degrade silently to anonymous (req.user left undefined). This is the
// only auth boundary the rest of the app (link creation, redirects) ever sees.
export async function optionalSession(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const sessionId = req.cookies?.[config.sessionCookieName] as string | undefined;

  if (!sessionId) {
    next();
    return;
  }

  try {
    const user = await sessionService.get(sessionId);
    if (user) {
      req.user = user;
    }
  } catch (error) {
    logger.warn({ err: error }, 'optionalSession: failed to read session, treating request as anonymous');
  }

  next();
}
