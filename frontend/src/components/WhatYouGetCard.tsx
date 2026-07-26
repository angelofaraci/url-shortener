interface Perk {
  title: string;
  description: string;
}

// Third perk's copy is reworded from the handoff's fictional "cleaned up by
// DynamoDB" to the real anonymous-link cleanup rule (24h, no owner ⇒ sign in
// to keep it) — see spec "Anonymous link expiry warning".
const PERKS: Perk[] = [
  { title: 'Custom aliases', description: 'Human-readable codes, checked for collisions.' },
  { title: 'Click analytics', description: 'Referrers, geography and click history.' },
  { title: 'Auto-expiry', description: 'Anonymous links expire in 24h. Sign in to keep them forever.' },
];

export function WhatYouGetCard() {
  return (
    <section className="perks-card">
      <h3 className="perks-card__title">What you get</h3>
      {PERKS.map((perk) => (
        <div key={perk.title} className="perk">
          <span className="perk__dot" />
          <div>
            <p className="perk__title">{perk.title}</p>
            <p className="perk__desc">{perk.description}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
