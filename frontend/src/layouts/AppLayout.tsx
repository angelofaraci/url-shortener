import { Outlet, useLocation } from 'react-router-dom';
import { Header } from '../components/shell/Header';
import { Sidebar } from '../components/shell/Sidebar';

// Only `/` and `/stats` are resolved here today; `/links` and `/settings`
// still fall back to "Create link" — tracked as a follow-up, out of scope
// for this change. `/stats/:code` is a param route, so it can't be a static
// map key; it's resolved via startsWith below before falling back to the map.
const PAGE_TITLES: Record<string, string> = {
  '/': 'Create link',
  '/stats': 'Link analytics',
};

export function AppLayout() {
  const location = useLocation();
  const title = location.pathname.startsWith('/stats')
    ? 'Link analytics'
    : (PAGE_TITLES[location.pathname] ?? 'Create link');

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-shell__main">
        <Header title={title} />
        <div className="app-shell__content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
