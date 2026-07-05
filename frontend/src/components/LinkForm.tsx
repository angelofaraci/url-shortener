import { useState, type FormEvent } from 'react';
import { ApiError, createLink, buildShortUrl } from '../api';
import type { Link } from '../types';
import { LinkResult } from './LinkResult';

function isValidUrl(value: string): boolean {
  // `new URL()` is the platform's own URL parser, so it accepts everything a
  // browser would actually navigate to without maintaining a regex by hand.
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

// The datetime-local input's value has no timezone (e.g. "2026-07-05T14:30").
// `new Date(value)` interprets that plain form as local time, which matches what
// the user picked on their clock, and `.toISOString()` then converts that exact
// instant to UTC — passing the raw string instead would silently be treated by
// the backend as UTC and shift the expiration by the local offset.
function datetimeLocalToIso(value: string): string {
  return new Date(value).toISOString();
}

export function LinkForm() {
  const [url, setUrl] = useState('');
  const [alias, setAlias] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Link | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (!isValidUrl(url)) {
      setError('Please enter a valid URL, including the protocol (e.g. https://example.com).');
      return;
    }

    setLoading(true);
    try {
      const link = await createLink({
        url,
        alias: alias.trim() || undefined,
        expiresAt: expiresAt ? datetimeLocalToIso(expiresAt) : undefined,
      });
      setResult(link);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong while creating the link.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card">
      <h2>Create a short link</h2>
      <form onSubmit={handleSubmit} className="form">
        <label className="field">
          <span>Long URL</span>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/some/long/path"
            required
          />
        </label>

        <label className="field">
          <span>Custom alias (optional)</span>
          <input
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="my-alias"
          />
        </label>

        <label className="field">
          <span>Expires at (optional)</span>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </label>

        <button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Shorten'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {result && <LinkResult shortUrl={buildShortUrl(result.code)} />}
    </section>
  );
}
