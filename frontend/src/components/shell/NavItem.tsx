import { NavLink } from 'react-router-dom';

interface NavItemProps {
  label: string;
  dotColor: string;
  to?: string;
}

// Items without a `to` have no registered route yet (spec: "Disabled Nav
// Placeholders") — rendered as a non-interactive span, never a NavLink, so
// clicking them cannot trigger navigation or a route-not-found state.
export function NavItem({ label, dotColor, to }: NavItemProps) {
  const dot = <span className="nav-item__dot" style={{ background: dotColor }} />;

  if (!to) {
    return (
      <span className="nav-item nav-item--disabled" aria-disabled="true" title="Coming soon">
        {dot}
        {label}
      </span>
    );
  }

  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
      end
    >
      {dot}
      {label}
    </NavLink>
  );
}
