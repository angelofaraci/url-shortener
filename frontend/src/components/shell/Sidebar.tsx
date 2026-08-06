import { NavItem } from './NavItem';
import { RegionCard } from './RegionCard';

const NAV_ITEMS = [
  { label: 'Create link', dotColor: '#4c8dff', to: '/' },
  { label: 'My links', dotColor: '#3fb950', to: '/links' },
  { label: 'Link analytics', dotColor: '#8a63e8', to: '/stats' },
  { label: 'Dashboard', dotColor: '#f2b84a', to: '/dashboard' },
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="logo">
        <span className="logo__square" />
        <span className="logo__mark">URL</span>
        <span className="logo__suffix">Shortener</span>
      </div>

      <nav className="nav">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.label} {...item} />
        ))}
      </nav>

      <RegionCard />
    </aside>
  );
}
