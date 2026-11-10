import { useLayoutEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AdminLayout from './components/AdminLayout';
import AdminDashboardView from './views/AdminDashboardView';
import DraftPublicationView from './views/DraftPublicationView';
import CurrentPublicationsView from './views/CurrentPublicationsView';
import AudienceRegistryView from './views/AudienceRegistryView';
import SignInView from './views/SignInView';
import PrivacyView from './views/PrivacyView';
import TermsView from './views/TermsView';

function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useLayoutEffect(() => {
    if (hash) {
      const element = document.querySelector(hash);
      if (element) {
        element.scrollIntoView();
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, hash]);

  return null;
}


export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <div className="flex flex-col min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-x-clip" id="app-root-container">
        <main className="flex-grow">
          <Routes>
            {/* 1. Root landing page: Login / Editorial Authentication Portal */}
            <Route path="/" element={<SignInView />} />

            {/* 2. Persistent Admin Layout with Permanent Navbar & Profile controls */}
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboardView />} />
              <Route path="/admin/draft" element={<DraftPublicationView />} />
              <Route path="/admin/publications" element={<CurrentPublicationsView />} />
              <Route path="/admin/audience" element={<AudienceRegistryView />} />
            </Route>

            {/* 3. Authentication Stage Aliases */}
            <Route path="/signin" element={<SignInView />} />
            <Route path="/login" element={<Navigate to="/" replace />} />

            {/* 4. Legal Codex & Platform Standards */}
            <Route path="/privacy" element={<PrivacyView />} />
            <Route path="/terms" element={<TermsView />} />

            {/* 5. Fallback Route: Redirect everything else to root landing */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
