import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';

interface LinkResultProps {
  shortUrl: string;
  longUrl: string;
  expiresAt: string | null;
}

// expiresAt is only ever unset (null) for a signed-in user who didn't pick a
// date — anonymous links always get the server's 24h default, and an
// explicit date is honored regardless of auth state. So the "sign in to keep
// it" nudge only makes sense in the signed-out branch; a signed-in user who
// set their own date sees that date with no nudge attached.
function expiryMessage(expiresAt: string | null, signedIn: boolean): string | null {
  if (expiresAt === null) {
    return null;
  }
  const formatted = new Date(expiresAt).toLocaleString();
  return signedIn ? `Expires ${formatted}` : `Expires ${formatted} — sign in to keep it`;
}

// Right-column "Result card" (handoff screen 1) — only rendered by
// `CreateLinkPage` after a link is created.
export function LinkResult({ shortUrl, longUrl, expiresAt }: LinkResultProps) {
  const [copied, setCopied] = useState(false);
  const auth = useAuth();
  const expiry = expiryMessage(expiresAt, Boolean(auth.user));

  async function handleCopy() {
    await navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="result-card">
      <p className="result-card__label">Link created</p>
      <div className="result-card__row">
        <div className="qr-placeholder" aria-hidden="true">
          QR
        </div>
        <div className="result-card__info">
          <a href={shortUrl} target="_blank" rel="noreferrer" className="result-card__url">
            {shortUrl}
          </a>
          <p className="result-card__dest">{longUrl}</p>
        </div>
      </div>
      {expiry && <p className="result-card__expiry">{expiry}</p>}
      <button type="button" onClick={handleCopy} className="copy-btn">
        {copied ? '✓ Copied' : 'Copy link'}
      </button>
    </div>
  );
}
