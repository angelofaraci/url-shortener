import { Link, useSearchParams } from 'react-router-dom';

const COPY: Record<'expired' | 'not-found', { title: string; message: string }> = {
  expired: {
    title: 'This link has expired',
    message: 'The short link you followed was set to expire and is no longer active.',
  },
  'not-found': {
    title: "This link doesn't exist",
    message: "The short link you followed doesn't match any link we know about.",
  },
};

// Standalone page (no Sidebar/Header): whoever lands here followed a dead
// short link and was never inside the app, so the authenticated shell
// (nav, "My links", etc.) would be misleading chrome to show them.
export function LinkErrorPage() {
  const [searchParams] = useSearchParams();
  const reason = searchParams.get('reason');
  const { title, message } = COPY[reason === 'expired' ? 'expired' : 'not-found'];

  return (
    <div className="link-error-page">
      <div className="logo">
        <span className="logo__square" />
        <span className="logo__mark">URL</span>
        <span className="logo__suffix">Shortener</span>
      </div>

      <section className="create-card link-error-page__card">
        <h2 className="create-card__title">{title}</h2>
        <p className="create-card__subtitle">{message}</p>
        <Link to="/" className="btn-primary">
          Create a new link
        </Link>
      </section>
    </div>
  );
}
