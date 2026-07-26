// Placeholder slot only — real auth wiring (GET /auth/me, sign-in/out,
// avatar/name from the session) is PR3's job. This keeps the header's
// layout final now without pretending auth is implemented.
export function UserMenu() {
  return <span className="user-menu-placeholder" title="Sign-in coming soon" aria-hidden="true" />;
}
