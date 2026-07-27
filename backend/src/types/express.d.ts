import type { SessionUser } from '../domain/user.js';

export interface OwnerScope {
  authenticated: boolean;
  userId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
      ownerScope?: OwnerScope;
    }
  }
}

export {};
