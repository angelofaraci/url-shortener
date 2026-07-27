import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { CreateLinkPage } from './pages/CreateLinkPage';
import { LinkStatsPage } from './pages/LinkStatsPage';
import { MyLinksPage } from './pages/MyLinksPage';

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<CreateLinkPage />} />
        <Route path="/stats" element={<LinkStatsPage />} />
        <Route path="/stats/:code" element={<LinkStatsPage />} />
        <Route path="/links" element={<MyLinksPage />} />
        <Route path="/settings" element={<ComingSoonPage title="Settings" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
