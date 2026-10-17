import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { Spinner } from './components/ui.jsx';
import IntroSplash from './components/IntroSplash.jsx';
import { RevealObserver } from './components/Cinematic.jsx';
import PublicLayout from './pages/PublicLayout.jsx';
import HomePage from './pages/HomePage.jsx';
import AllEditionsPage from './pages/AllEditionsPage.jsx';
import EditionPage from './pages/EditionPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import SearchPage from './pages/SearchPage.jsx';
import VideosPage from './pages/VideosPage.jsx';

// The editor's desk is loaded only when someone opens it,
// so readers never download the admin code.
const LoginPage = lazy(() => import('./admin/LoginPage.jsx'));
const RequireAdmin = lazy(() => import('./admin/RequireAdmin.jsx'));
const AdminLayout = lazy(() => import('./admin/AdminLayout.jsx'));
const EditionsPage = lazy(() => import('./admin/EditionsPage.jsx'));
const EditorPage = lazy(() => import('./admin/EditorPage.jsx'));
const SettingsPage = lazy(() => import('./admin/SettingsPage.jsx'));
const InvitePage = lazy(() => import('./admin/InvitePage.jsx'));
// The owner's Admin app (accounts, requests, analytics) — also loaded only on demand.
const OwnerLayout = lazy(() => import('./owner/OwnerLayout.jsx'));
const OverviewPage = lazy(() => import('./owner/OverviewPage.jsx'));
const RequestsPage = lazy(() => import('./owner/RequestsPage.jsx'));
const AccountsPage = lazy(() => import('./owner/AccountsPage.jsx'));
const ArticlesPage = lazy(() => import('./owner/ArticlesPage.jsx'));
const PublishingPage = lazy(() => import('./owner/PublishingPage.jsx'));
const PublishPage = lazy(() => import('./pages/PublishPage.jsx'));
const PrintPage = lazy(() => import('./print/PrintPage.jsx'));
// The 3D newsroom (and its 3D engine) only downloads when someone opens a video.
const VideoPage = lazy(() => import('./pages/VideoPage.jsx'));

export default function App() {
  const { pathname } = useLocation();
  const printing = pathname.startsWith('/print');
  return (
    <ErrorBoundary>
      {/* The printable/PDF pages must show only the paper — no intro, no scroll animations */}
      {!printing && <IntroSplash />}
      {!printing && <RevealObserver />}
      <Suspense fallback={<div className="state-message"><Spinner /></div>}>
        <AppRoutes />
      </Suspense>
    </ErrorBoundary>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="all" element={<AllEditionsPage />} />
        <Route path="archive" element={<Navigate to="/all" replace />} />
        <Route path="edition/:slug" element={<EditionPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="videos" element={<VideosPage />} />
        <Route path="videos/:slug" element={<VideoPage />} />
        <Route path="publish" element={<PublishPage />} />
      </Route>

      <Route path="print/draft/:token" element={<PrintPage />} />
      <Route path="print/:slug" element={<PrintPage />} />

      <Route path="admin/login" element={<LoginPage />} />
      <Route path="admin/invite/:token" element={<InvitePage />} />
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

      <Route
        path="owner"
        element={
          <RequireAdmin owner>
            <OwnerLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="requests" element={<RequestsPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="articles" element={<ArticlesPage />} />
        <Route path="publishing" element={<PublishingPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
