import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { ApiError, getDashboardAnalytics } from '../api';
import type { DashboardAnalytics } from '../types';
import { StatSummaryCard } from '../components/analytics/StatSummaryCard';
import { ClicksBarChart } from '../components/analytics/ClicksBarChart';
import { TopLinksTable } from '../components/analytics/TopLinksTable';

// Render order (first match wins): loading -> signed-out empty state ->
// error -> empty (no clicks in the 30d window AND no all-time top links) ->
// data. The single GET /api/analytics/dashboard response cannot distinguish
// "user has zero links" from "user has links that were never clicked" —
// both produce totalClicks30d=0 and topLinks=[] — so both real-world cases
// render the same empty state here by construction (see spec's Zero-State
// Handling requirement). The signed-out branch is always driven by
// useAuth(), never by API response shape, matching MyLinksPage/LinkStatsPage.
export function DashboardPage() {
  const auth = useAuth();
  const [dashboard, setDashboard] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.loading || !auth.user) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getDashboardAnalytics()
      .then((result) => {
        if (!cancelled) {
          setDashboard(result);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Something went wrong while fetching your dashboard.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [auth.loading, auth.user?.id]);

  const isEmpty = dashboard !== null && dashboard.totalClicks30d === 0 && dashboard.topLinks.length === 0;

  return (
    <section className="create-card">
      <h2 className="create-card__title">Dashboard</h2>
      <p className="create-card__subtitle">Aggregate analytics across all of your links.</p>

      {auth.loading || loading || (auth.user && dashboard === null && !error) ? (
        <p className="create-card__subtitle">Loading your dashboard...</p>
      ) : !auth.user ? (
        <div className="empty-state">
          <p className="create-card__subtitle">Sign in to see your dashboard.</p>
          <a className="user-menu-signin" href={auth.signInUrl}>
            Sign in with Google
          </a>
        </div>
      ) : error ? (
        <p className="error">{error}</p>
      ) : isEmpty ? (
        <div className="empty-state">
          <p className="create-card__subtitle">No clicks yet — create a link and share it to see analytics here.</p>
          <Link to="/" className="btn-primary">
            Create a link
          </Link>
        </div>
      ) : dashboard ? (
        <div className="dashboard-grid">
          <StatSummaryCard totalClicks30d={dashboard.totalClicks30d} />
          <ClicksBarChart series={dashboard.series} />
          <TopLinksTable topLinks={dashboard.topLinks} />
        </div>
      ) : null}
    </section>
  );
}
