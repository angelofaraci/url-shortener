import type { SessionUser } from '../domain/user.js';

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export {};
