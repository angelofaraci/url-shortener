import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { ApiError, buildShortUrl, getStats, listMyLinks } from '../api';
import type { MyLink, StatsResponse } from '../types';

// Owner-scoped analytics screen. Branches on the `code` route param:
// no param (`/stats`) renders the signed-in user's own links list
// (reusing GET /api/links, same effect shape as MyLinksPage); a param
// (`/stats/:code`) renders that link's detail (GET /api/links/:code/stats).
// Render order mirrors MyLinksPage: loading -> signed-out empty state ->
// error/not-found -> empty -> content. The signed-out branch is always
// driven by useAuth(), never by API response shape.
export function LinkStatsPage() {
  const { code } = useParams<{ code: string }>();

  if (code) {
    return <LinkStatsDetail code={code} />;
  }

  return <LinkStatsList />;
}

function LinkStatsList() {
  const auth = useAuth();
  const [links, setLinks] = useState<MyLink[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.loading || !auth.user) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    listMyLinks()
      .then((response) => {
        if (!cancelled) {
          setLinks(response.links);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Something went wrong while fetching your links.');
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

  return (
    <section className="create-card">
      <h2 className="create-card__title">Link analytics</h2>
      <p className="create-card__subtitle">Select a link to see its click history.</p>

      {auth.loading || loading || (auth.user && links === null && !error) ? (
        <p className="create-card__subtitle">Loading your links...</p>
      ) : !auth.user ? (
        <div className="empty-state">
          <p className="create-card__subtitle">Sign in to see analytics for your links.</p>
          <a className="user-menu-signin" href={auth.signInUrl}>
            Sign in with Google
          </a>
        </div>
      ) : error ? (
        <p className="error">{error}</p>
      ) : links && links.length === 0 ? (
        <div className="empty-state">
          <p className="create-card__subtitle">No links yet.</p>
          <Link to="/" className="btn-primary">
            Create a link
          </Link>
        </div>
      ) : (
        <ul className="stats-clicks">
          {(links ?? []).map((link) => (
            <li key={link.code} className="stats-clicks__item my-links__row">
              <span>
                <Link to={`/stats/${encodeURIComponent(link.code)}`} className="result-card__url">
                  {buildShortUrl(link.code)}
                </Link>
                <span className="result-card__dest">{link.url}</span>
              </span>
              <span>{link.totalClicks} clicks</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LinkStatsDetail({ code }: { code: string }) {
  const auth = useAuth();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.loading || !auth.user) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setStats(null);

    getStats(code)
      .then((result) => {
        if (!cancelled) {
          setStats(result);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Something went wrong while fetching stats.');
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
  }, [auth.loading, auth.user?.id, code]);

  return (
    <div className="create-grid">
      <section className="create-card">
        <h2 className="create-card__title">Link analytics</h2>
        <p className="create-card__subtitle">
          <Link to="/stats">&larr; Back to your links</Link>
        </p>

        {auth.loading || loading ? (
          <p className="create-card__subtitle">Loading stats...</p>
        ) : !auth.user ? (
          <div className="empty-state">
            <p className="create-card__subtitle">Sign in to see analytics for your links.</p>
            <a className="user-menu-signin" href={auth.signInUrl}>
              Sign in with Google
            </a>
          </div>
        ) : error ? (
          <p className="error">No link found for that code.</p>
        ) : null}
      </section>

      {stats && (
        <div className="create-side">
          <section className="result-card">
            <p className="result-card__label">{stats.code}</p>
            <p className="stats-clicks__total">{stats.totalClicks} total clicks</p>

            {stats.recentClicks.length === 0 ? (
              <p className="result-card__dest">No clicks recorded yet.</p>
            ) : (
              <ul className="stats-clicks">
                {stats.recentClicks.map((click, index) => (
                  <li key={index} className="stats-clicks__item">
                    <span>{click.timestamp ?? 'Unknown time'}</span>
                    <span>{click.referrer ?? 'Direct'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
