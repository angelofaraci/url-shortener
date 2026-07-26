export interface User {
  id: string;
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: Date;
}

// Shape stored in the Redis session payload and returned by GET /auth/me.
// Deliberately excludes googleId — that's an internal join key, not client-facing data.
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
  };
}
