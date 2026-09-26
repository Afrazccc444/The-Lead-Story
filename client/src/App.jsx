import { Navigate, Route, Routes } from 'react-router-dom';
import PublicLayout from './pages/PublicLayout.jsx';
import HomePage from './pages/HomePage.jsx';
import AllEditionsPage from './pages/AllEditionsPage.jsx';
import EditionPage from './pages/EditionPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import LoginPage from './admin/LoginPage.jsx';
import RequireAdmin from './admin/RequireAdmin.jsx';
import AdminLayout from './admin/AdminLayout.jsx';
import EditionsPage from './admin/EditionsPage.jsx';
import EditorPage from './admin/EditorPage.jsx';
import SettingsPage from './admin/SettingsPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="all" element={<AllEditionsPage />} />
        <Route path="archive" element={<Navigate to="/all" replace />} />
        <Route path="edition/:slug" element={<EditionPage />} />
      </Route>

      <Route path="admin/login" element={<LoginPage />} />
      <Route
        path="admin"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<EditionsPage />} />
        <Route path="editions/:id" element={<EditorPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
