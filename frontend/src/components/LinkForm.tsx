import { useState, type FormEvent } from 'react';
import { ApiError, createLink, shortUrlHost } from '../api';
import type { Link } from '../types';

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

// `datetime-local`'s `min` wants the same timezone-less local format it emits,
// truncated to the minute so "right now" isn't itself rejected as past.
function nowAsDatetimeLocalMin(): string {
  const now = new Date();
  now.setSeconds(0, 0);
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
}

interface LinkFormProps {
  onCreated: (link: Link) => void;
  onSubmitStart: () => void;
}

// Left card only (handoff screen 1). The result — shown in the right column —
// is lifted to `CreateLinkPage` via `onCreated` so it can sit alongside
// `WhatYouGetCard` instead of being nested inside this form's own card.
export function LinkForm({ onCreated, onSubmitStart }: LinkFormProps) {
  const [url, setUrl] = useState('');
  const [alias, setAlias] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    onSubmitStart();

    if (!isValidUrl(url)) {
      setError('Please enter a valid URL, including the protocol (e.g. https://example.com).');
      return;
    }

    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      setError('Expiration date must be in the future.');
      return;
    }

    setLoading(true);
    try {
      const link = await createLink({
        url,
        alias: alias.trim() || undefined,
        expiresAt: expiresAt ? datetimeLocalToIso(expiresAt) : undefined,
      });
      onCreated(link);
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
    <section className="create-card">
      <h2 className="create-card__title">Create a short link</h2>
      <p className="create-card__subtitle">Paste a long URL and get a tidy, trackable short code.</p>

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

        <div className="field-row">
          <label className="field">
            <span>
              Custom alias <span className="field__hint">optional</span>
            </span>
            <div className="alias-input">
              <span className="alias-input__prefix">{shortUrlHost()}</span>
              <input
                type="text"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="my-alias"
              />
            </div>
          </label>

          <label className="field">
            <span>Expires at</span>
            <input
              type="datetime-local"
              value={expiresAt}
              min={nowAsDatetimeLocalMin()}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </label>
        </div>

        <div className="actions-row">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creating...' : 'Shorten'}
          </button>
          <span className="ttl-note">
            <span className="ttl-note__dot" />
            Anonymous links expire after 24h
          </span>
        </div>
      </form>

      {error && <p className="error">{error}</p>}
    </section>
  );
}
