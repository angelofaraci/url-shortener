import type { NextFunction, Request, Response } from 'express';

// Non-blocking: always calls next(). Never writes a response, never 401s, never
// redirects. Normalizes req.user (already resolved by the global optionalSession
// middleware) into req.ownerScope so downstream controllers get an honest,
// reusable "who is this request for" contract without reaching into req.user.
export function sessionGate(req: Request, _res: Response, next: NextFunction): void {
  req.ownerScope = req.user
    ? { authenticated: true, userId: req.user.id }
    : { authenticated: false, userId: null };

  next();
}
