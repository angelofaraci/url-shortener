import { LinkForm } from './components/LinkForm';
import { StatsLookup } from './components/StatsLookup';

export function App() {
  return (
    <main className="app">
      <h1>URL Shortener</h1>
      <LinkForm />
      <StatsLookup />
    </main>
  );
}
