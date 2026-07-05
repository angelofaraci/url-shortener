import type { Link, StatsResponse } from '../types';

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
  const response = await fetch(`${baseUrl}/api/links/${encodeURIComponent(code)}/stats`);

  if (response.status === 404) {
    throw new ApiError(await parseErrorMessage(response, 'No link found for that code.'), 404);
  }
  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response, 'Failed to fetch stats.'), response.status);
  }

  return (await response.json()) as StatsResponse;
}

export function buildShortUrl(code: string): string {
  return `${baseUrl}/${code}`;
}
