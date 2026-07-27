import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { authService } from '../services/authService.js';
import { googleOAuthService } from '../services/googleOAuthService.js';
import { sessionService } from '../services/sessionService.js';
import { logger } from '../lib/logger.js';
import { HttpError } from '../utils/httpError.js';

// D2 cookie policy: httpOnly + SameSite=Lax always; Secure only in production so
// local dev over plain http still works (localhost:5173 <-> localhost:3000 is
// same-site regardless of port).
function cookieOptions(maxAgeMs?: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: config.nodeEnv === 'production',
    path: '/',
    ...(maxAgeMs !== undefined ? { maxAge: maxAgeMs } : {}),
  };
}

// Only same-origin relative paths are ever honored as a post-login redirect target.
// Absolute URLs (`https://evil.tld`) and protocol-relative URLs (`//evil.tld`) are
// both rejected in favor of the safe default, closing the open-redirect boundary.
export function sanitizeReturnTo(returnTo: string | undefined): string {
  if (!returnTo) {
    return '/';
  }
  if (!/^\/[A-Za-z0-9/_-]*$/.test(returnTo) || returnTo.startsWith('//')) {
    return '/';
  }
  return returnTo;
}

function authErrorRedirect(res: Response, reason: 'state' | 'token' | 'denied' | 'unconfigured'): void {
  res.redirect(302, `${config.appBaseUrl}/?authError=${reason}`);
}

export async function startGoogleLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!authService.isConfigured()) {
      next(new HttpError(503, 'Google sign-in is not configured'));
      return;
    }

    const returnTo = sanitizeReturnTo(req.query.returnTo as string | undefined);
    const state = await sessionService.putState(returnTo);
    res.redirect(302, googleOAuthService.buildAuthUrl(state));
  } catch (error) {
    next(error);
  }
}

export async function googleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;

    if (!code || !state) {
      authErrorRedirect(res, 'state');
      return;
    }

    // Single-use GETDEL: a missing, unknown, or already-consumed (replayed) state
    // all produce the same `null` result here — indistinguishable, and all rejected.
    const returnTo = await sessionService.consumeState(state);
    if (returnTo === null) {
      authErrorRedirect(res, 'state');
      return;
    }

    let sessionId: string;
    try {
      const result = await authService.completeLogin(code);
      sessionId = result.sessionId;
    } catch (error) {
      logger.warn({ err: error }, 'Google OAuth callback failed to complete login');
      authErrorRedirect(res, 'token');
      return;
    }

    res.cookie(config.sessionCookieName, sessionId, cookieOptions(config.sessionTtlSeconds * 1000));
    res.redirect(302, `${config.appBaseUrl}${sanitizeReturnTo(returnTo)}`);
  } catch (error) {
    next(error);
  }
}

export function me(req: Request, res: Response): void {
  res.status(200).json({ user: req.user ?? null });
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const sessionId = req.cookies?.[config.sessionCookieName] as string | undefined;
    if (sessionId) {
      await sessionService.destroy(sessionId);
    }
    res.clearCookie(config.sessionCookieName, cookieOptions());
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
