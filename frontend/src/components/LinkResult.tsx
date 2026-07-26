import { useState } from 'react';

interface LinkResultProps {
  shortUrl: string;
  longUrl: string;
}

// Right-column "Result card" (handoff screen 1) — only rendered by
// `CreateLinkPage` after a link is created.
export function LinkResult({ shortUrl, longUrl }: LinkResultProps) {
  const [copied, setCopied] = useState(false);

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
      <p className="result-card__expiry">Expires in 24h — sign in to keep it</p>
      <button type="button" onClick={handleCopy} className="copy-btn">
        {copied ? '✓ Copied' : 'Copy link'}
      </button>
    </div>
  );
}
