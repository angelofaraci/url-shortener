import { useState, type FormEvent } from 'react';
import { ApiError, getStats } from '../api';
import type { StatsResponse } from '../types';

// Handoff screen 3: lookup card (code input) + results card, mirroring the
// two-column create-link layout but with the query on the left.
export function LinkStatsPage() {
  const [code, setCode] = useState('');
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStats(null);

    const trimmed = code.trim();
    if (!trimmed) {
      setError('Enter a short code to look up.');
      return;
    }

    setLoading(true);
    try {
      setStats(await getStats(trimmed));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong while fetching stats.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="create-grid">
      <section className="create-card">
        <h2 className="create-card__title">Link stats</h2>
        <p className="create-card__subtitle">Enter a short code to see its click history.</p>

        <form onSubmit={handleSubmit} className="form">
          <label className="field">
            <span>Short code</span>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="my-alias"
              required
            />
          </label>

          <div className="actions-row">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Looking up...' : 'Look up'}
            </button>
          </div>
        </form>

        {error && <p className="error">{error}</p>}
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
