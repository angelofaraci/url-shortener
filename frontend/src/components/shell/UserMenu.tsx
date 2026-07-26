import { useAuth } from '../../auth/AuthProvider';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

export function UserMenu() {
  const { user, loading, signInUrl, logout } = useAuth();

  if (loading) {
    return <span className="user-menu-placeholder" aria-hidden="true" />;
  }

  if (!user) {
    return (
      <a className="user-menu-signin" href={signInUrl}>
        Sign in with Google
      </a>
    );
  }

  return (
    <div className="user-menu">
      {user.avatarUrl ? (
        <img className="user-menu__avatar" src={user.avatarUrl} alt="" />
      ) : (
        <span className="user-menu__avatar user-menu__avatar--initials">{initials(user.name)}</span>
      )}
      <span className="user-menu__name">{user.name}</span>
      <button
        type="button"
        className="user-menu__logout"
        onClick={() => {
          void logout();
        }}
      >
        Sign out
      </button>
    </div>
  );
}
