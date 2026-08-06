interface StatSummaryCardProps {
  totalClicks30d: number;
}

// Headline card for the fixed 30-day window (design: totalClicks30d and
// series always share the same window — the label makes that explicit).
export function StatSummaryCard({ totalClicks30d }: StatSummaryCardProps) {
  return (
    <section className="result-card">
      <p className="result-card__label">Last 30 days (UTC)</p>
      <p className="stat-summary__value">{totalClicks30d}</p>
      <p className="result-card__dest">Total clicks</p>
    </section>
  );
}
