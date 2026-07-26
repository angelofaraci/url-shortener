import { useState } from 'react';
import { buildShortUrl } from '../api';
import { LinkForm } from '../components/LinkForm';
import { LinkResult } from '../components/LinkResult';
import { WhatYouGetCard } from '../components/WhatYouGetCard';
import type { Link } from '../types';

// Handoff screen 1: 2-col grid — left card is the form, right column is the
// result (only after a successful shorten) + the "what you get" perks card.
export function CreateLinkPage() {
  const [result, setResult] = useState<Link | null>(null);

  return (
    <div className="create-grid">
      <LinkForm onCreated={setResult} />
      <div className="create-side">
        {result && <LinkResult shortUrl={buildShortUrl(result.code)} longUrl={result.url} />}
        <WhatYouGetCard />
      </div>
    </div>
  );
}
