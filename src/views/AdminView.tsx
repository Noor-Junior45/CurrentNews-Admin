import React from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminDashboardView from './AdminDashboardView';
import DraftPublicationView from './DraftPublicationView';
import CurrentPublicationsView from './CurrentPublicationsView';
import AudienceRegistryView from './AudienceRegistryView';

/**
 * AdminView — Central routing router for the Editorial Bureau.
 * Routes directly to each dedicated, self-contained view file:
 * - /admin (dashboard) -> AdminDashboardView.tsx
 * - /admin?focus=draft -> DraftPublicationView.tsx
 * - /admin?focus=publications -> CurrentPublicationsView.tsx
 * - /admin?focus=audience -> AudienceRegistryView.tsx
 */
export default function AdminView(): React.JSX.Element {
  const [searchParams] = useSearchParams();
  const currentSegment = searchParams.get('focus') || 'dashboard';

  switch (currentSegment) {
    case 'draft':
      return <DraftPublicationView />;
    case 'publications':
      return <CurrentPublicationsView />;
    case 'audience':
      return <AudienceRegistryView />;
    case 'dashboard':
    default:
      return <AdminDashboardView />;
  }
}
