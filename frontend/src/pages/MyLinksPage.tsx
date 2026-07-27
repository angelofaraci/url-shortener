import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { ApiError, buildShortUrl, listMyLinks } from '../api';
import type { MyLink } from '../types';

// Render order (first match wins): loading -> signed-out empty state ->
// error -> zero-links empty state -> populated list. The signed-out branch
// is chosen from useAuth() state, never from the shape of the API response,
// so a stale/failed fetch can never render the wrong empty state.
export function MyLinksPage() {
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
      <h2 className="create-card__title">My links</h2>

      {auth.loading || loading || (auth.user && links === null && !error) ? (
        <p className="create-card__subtitle">Loading your links...</p>
      ) : !auth.user ? (
        <div className="empty-state">
          <p className="create-card__subtitle">Sign in to see the links you've created.</p>
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
                <Link to="/stats" className="result-card__url">
                  {buildShortUrl(link.code)}
                </Link>
                <span className="result-card__dest">{link.url}</span>
              </span>
              <span>{new Date(link.createdAt).toLocaleDateString()}</span>
              <span>{link.expiresAt ? new Date(link.expiresAt).toLocaleDateString() : 'No expiry'}</span>
              <span>{link.totalClicks} clicks</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
