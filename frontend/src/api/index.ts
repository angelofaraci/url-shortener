import type { DashboardAnalytics, Link, MyLinksResponse, SessionUser, StatsResponse } from '../types';

// Read only from import.meta.env — never hardcode the backend origin in source,
// since the short URL shown to the user is built client-side as `${baseUrl}/${code}`.
const baseUrl = import.meta.env.VITE_API_URL;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Backend error bodies are not guaranteed to use the same field name,
// so we accept either `message` or `error` and fall back to a generic message.
async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object') {
      const record = body as Record<string, unknown>;
      if (typeof record.message === 'string') return record.message;
      if (typeof record.error === 'string') return record.error;
    }
  } catch {
    // response had no JSON body — use the fallback below
  }
  return fallback;
}

export interface CreateLinkPayload {
  url: string;
  alias?: string;
  expiresAt?: string;
}

export async function createLink(payload: CreateLinkPayload): Promise<Link> {
  const response = await fetch(`${baseUrl}/api/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (response.status === 409) {
    throw new ApiError(await parseErrorMessage(response, 'That alias is already taken.'), 409);
  }
  if (response.status === 400) {
    throw new ApiError(await parseErrorMessage(response, 'Invalid request.'), 400);
  }
  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response, 'Failed to create the short link.'), response.status);
  }

  return (await response.json()) as Link;
}

export async function getStats(code: string): Promise<StatsResponse> {
  const response = await fetch(`${baseUrl}/api/links/${encodeURIComponent(code)}/stats`, {
    credentials: 'include',
  });

  if (response.status === 404) {
    throw new ApiError(await parseErrorMessage(response, 'No link found for that code.'), 404);
  }
  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response, 'Failed to fetch stats.'), response.status);
  }

  return (await response.json()) as StatsResponse;
}

// GET /api/links always returns 200 (never 401): `{ authenticated: false, links: [] }`
// for anonymous requests. `credentials: 'include'` is required so the session
// cookie is sent — owner scope is derived server-side, never from a query param.
export async function listMyLinks(): Promise<MyLinksResponse> {
  const response = await fetch(`${baseUrl}/api/links`, { credentials: 'include' });

  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response, 'Failed to fetch your links.'), response.status);
  }

  return (await response.json()) as MyLinksResponse;
}

// GET /api/analytics/dashboard is authenticated-only (401 without a session,
// per design D6 — no anonymous {authenticated:false} shape here, unlike
// GET /api/links). `credentials: 'include'` sends the session cookie.
export async function getDashboardAnalytics(): Promise<DashboardAnalytics> {
  const response = await fetch(`${baseUrl}/api/analytics/dashboard`, { credentials: 'include' });

  if (response.status === 401) {
    throw new ApiError(await parseErrorMessage(response, 'Authentication required.'), 401);
  }
  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response, 'Failed to fetch dashboard analytics.'), response.status);
  }

  return (await response.json()) as DashboardAnalytics;
}

export function buildShortUrl(code: string): string {
  return `${baseUrl}/${code}`;
}

// Real backend host, used as the alias-input prefix so the Create screen
// never shows the design handoff's fictional "shrt.link" domain.
export function shortUrlHost(): string {
  return `${new URL(baseUrl).host}/`;
}

// GET /auth/me always returns 200 (never 401): `{ user: null }` for anonymous
// requests. `credentials: 'include'` is required so the `sid` cookie is sent.
export async function getMe(): Promise<SessionUser | null> {
  const response = await fetch(`${baseUrl}/auth/me`, { credentials: 'include' });

  if (!response.ok) {
    // Treat any unexpected failure as anonymous rather than throwing — auth
    // must never block the rest of the app from rendering.
    return null;
  }

  const body = (await response.json()) as { user: SessionUser | null };
  return body.user;
}

export async function logout(): Promise<void> {
  await fetch(`${baseUrl}/auth/logout`, { method: 'POST', credentials: 'include' });
}

// Builds the `GET /auth/google` URL, preserving the current path as `returnTo`
// so the post-login redirect lands back where the user started.
export function googleSignInUrl(returnTo: string): string {
  return `${baseUrl}/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
}
