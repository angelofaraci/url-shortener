interface ComingSoonPageProps {
  title: string;
}

// Shown for nav destinations that are routed but not yet built.
export function ComingSoonPage({ title }: ComingSoonPageProps) {
  return (
    <section className="create-card">
      <h2 className="create-card__title">{title}</h2>
      <p className="create-card__subtitle">This screen isn't implemented yet — coming soon.</p>
    </section>
  );
}
