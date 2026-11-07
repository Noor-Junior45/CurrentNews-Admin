import React from 'react';
import { Outlet } from 'react-router-dom';
import AdminNavbar from './AdminNavbar';
import AdminAuthGuard from './AdminAuthGuard';

/**
 * AdminLayout — Persistent Administrative Shell.
 * Keeps the navigation bar and profile controls permanently mounted
 * so switching between Editorial Bureau tabs never unmounts the navbar,
 * never triggers a full-page loading screen, and only buffers individual
 * data-fetching sections within child views.
 */
export default function AdminLayout(): React.JSX.Element {
  return (
    <AdminAuthGuard>
      <div className="min-h-screen bg-white dark:bg-slate-950 font-sans flex flex-col" id="admin-shell">
        {/* Permanent Sticky Admin Navbar */}
        <AdminNavbar />

        {/* Dynamic child view area */}
        <div className="flex-1 w-full">
          <Outlet />
        </div>
      </div>
    </AdminAuthGuard>
  );
}
