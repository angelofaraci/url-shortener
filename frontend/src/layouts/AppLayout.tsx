import { Outlet, useLocation } from 'react-router-dom';
import { Header } from '../components/shell/Header';
import { Sidebar } from '../components/shell/Sidebar';

// Only `/` is a registered route in this slice (spec: "Single Working
// Route"), so this map has one entry today; PR3+ will grow it alongside
// their routes instead of hardcoding the header title in `App.tsx`.
const PAGE_TITLES: Record<string, string> = {
  '/': 'Create link',
};

export function AppLayout() {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] ?? 'Create link';

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
