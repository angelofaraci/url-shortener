import { buildShortUrl } from '../../api';
import type { TopLink } from '../../types';

interface TopLinksTableProps {
  topLinks: TopLink[];
}

// All-time ranking (not limited to the 30-day window) — see spec's
// "All-Time Top-5 Links Ranking" requirement. Caller only renders this when
// topLinks is non-empty (DashboardPage's empty-state branch handles the
// zero case), so no internal empty message is needed here.
export function TopLinksTable({ topLinks }: TopLinksTableProps) {
  return (
    <section className="create-card">
      <h3 className="create-card__title">Top links</h3>
      <p className="create-card__subtitle">All time</p>

      <ul className="stats-clicks">
        {topLinks.map((link) => (
          <li key={link.linkId} className="stats-clicks__item my-links__row">
            <span className="result-card__url">{buildShortUrl(link.shortCode)}</span>
            <span>{link.totalClicks} clicks</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
