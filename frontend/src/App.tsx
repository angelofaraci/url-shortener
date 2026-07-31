import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { CreateLinkPage } from './pages/CreateLinkPage';
import { LinkErrorPage } from './pages/LinkErrorPage';
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
      </Route>
      <Route path="/link-error" element={<LinkErrorPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
