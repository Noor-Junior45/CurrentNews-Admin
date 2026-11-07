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
      <div className="flex flex-col min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-x-hidden" id="app-root-container">
        <main className="flex-grow">
          <Routes>
            {/* 1. Root redirect directly to Admin Editorial Bureau */}
            <Route path="/" element={<Navigate to="/admin" replace />} />

            {/* 2. Persistent Admin Layout with Permanent Navbar & Profile controls */}
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboardView />} />
              <Route path="/admin/draft" element={<DraftPublicationView />} />
              <Route path="/admin/publications" element={<CurrentPublicationsView />} />
              <Route path="/admin/audience" element={<AudienceRegistryView />} />
            </Route>

            {/* 3. Authentication Stage */}
            <Route path="/signin" element={<SignInView />} />
            <Route path="/login" element={<Navigate to="/signin" replace />} />

            {/* 4. Legal Codex & Platform Standards */}
            <Route path="/privacy" element={<PrivacyView />} />
            <Route path="/terms" element={<TermsView />} />

            {/* 5. Fallback Route: Redirect everything else to Admin */}
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
