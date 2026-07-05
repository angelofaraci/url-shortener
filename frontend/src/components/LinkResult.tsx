import { useState } from 'react';

interface LinkResultProps {
  shortUrl: string;
}

export function LinkResult({ shortUrl }: LinkResultProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="link-result">
      <a href={shortUrl} target="_blank" rel="noreferrer" className="link-result__url">
        {shortUrl}
      </a>
      <button type="button" onClick={handleCopy} className="link-result__copy">
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}
