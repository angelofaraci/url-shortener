import { useState, type FormEvent } from 'react';
import { ApiError, getStats } from '../api';
import type { StatsResponse } from '../types';

function cell(value: string | null | undefined): string {
  return value ?? '—';
}

export function StatsLookup() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStats(null);

    setLoading(true);
    try {
      const data = await getStats(code.trim());
      setStats(data);
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
    <section className="card">
      <h2>Look up link stats</h2>
      <form onSubmit={handleSubmit} className="form form--inline">
        <label className="field">
          <span>Short code</span>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="abc123"
            required
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Looking up...' : 'Look up'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {stats && (
        <div className="stats">
          <p className="stats__total">
            Total clicks: <strong>{stats.totalClicks}</strong>
          </p>
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Referrer</th>
                <th>User agent</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentClicks.length === 0 ? (
                <tr>
                  <td colSpan={3} className="stats__empty">
                    No clicks yet.
                  </td>
                </tr>
              ) : (
                stats.recentClicks.map((click, index) => (
                  <tr key={index}>
                    <td>{cell(click.timestamp)}</td>
                    <td>{cell(click.referrer)}</td>
                    <td>{cell(click.userAgent)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
