import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthState } from '../hooks/useAuthState';
import { auth } from '../firebase';
import { signOut, deleteUser } from 'firebase/auth';
import { 
  LayoutDashboard, 
  PenSquare, 
  BookOpen, 
  Users, 
  LogOut, 
  ShieldCheck, 
  FileText, 
  Trash2, 
  X, 
  AlertTriangle
} from 'lucide-react';

export default function AdminNavbar(): React.JSX.Element {
  const { user } = useAuthState();
  const navigate = useNavigate();
  const location = useLocation();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'delete' | null>(null);

  // Delete modal state
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsProfileOpen(false);
        setActiveModal(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Determine active tab
  const getActiveTab = (): 'dashboard' | 'draft' | 'publications' | 'audience' => {
    const path = location.pathname;
    const searchParams = new URLSearchParams(location.search);
    const focus = searchParams.get('focus');

    if (path.includes('/draft') || focus === 'draft') return 'draft';
    if (path.includes('/publications') || focus === 'publications') return 'publications';
    if (path.includes('/audience') || focus === 'audience') return 'audience';
    return 'dashboard';
  };

  const activeTab = getActiveTab();

  const TABS = [
    { 
      id: 'dashboard' as const, 
      path: '/admin', 
      label: 'Dashboard', 
      icon: LayoutDashboard,
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      activeStyles: 'bg-emerald-50 text-emerald-800 border-emerald-300/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700/80 shadow-2xs'
    },
    { 
      id: 'draft' as const, 
      path: '/admin/draft', 
      label: 'Drafts', 
      icon: PenSquare,
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      activeStyles: 'bg-indigo-50 text-indigo-800 border-indigo-300/80 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-700/80 shadow-2xs'
    },
    { 
      id: 'publications' as const, 
      path: '/admin/publications', 
      label: 'Publications', 
      icon: BookOpen,
      iconColor: 'text-blue-600 dark:text-blue-400',
      activeStyles: 'bg-blue-50 text-blue-800 border-blue-300/80 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700/80 shadow-2xs'
    },
    { 
      id: 'audience' as const, 
      path: '/admin/audience', 
      label: 'Audience', 
      icon: Users,
      iconColor: 'text-amber-600 dark:text-amber-400',
      activeStyles: 'bg-amber-50 text-amber-800 border-amber-300/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700/80 shadow-2xs'
    },
  ];

  // Touch swipe gesture listener to seamlessly switch tabs on mobile/tablet (100% offline, lightweight pure JS)
  useEffect(() => {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length !== 1) return;
      const deltaX = e.changedTouches[0].clientX - touchStartX;
      const deltaY = e.changedTouches[0].clientY - touchStartY;
      const elapsed = Date.now() - touchStartTime;

      // Ensure gesture was a deliberate horizontal swipe on mobile/tablet
      if (elapsed > 550) return;
      if (Math.abs(deltaX) < 45) return;
      if (Math.abs(deltaX) <= Math.abs(deltaY) * 1.3) return;

      // Guard: do not swipe-navigate when touching forms, rich text editor, or modals
      const target = e.target as HTMLElement | null;
      if (target) {
        const isInteractive = target.closest('input, textarea, select, button, [contenteditable="true"], .ql-editor, .ql-container, #admin-profile-dropdown, [role="dialog"]');
        if (isInteractive) return;
      }

      const currentIdx = TABS.findIndex((t) => t.id === activeTab);
      if (currentIdx === -1) return;

      if (deltaX < 0) {
        // Swiped Left -> Next Tab
        if (currentIdx < TABS.length - 1) {
          navigate(TABS[currentIdx + 1].path);
        }
      } else {
        // Swiped Right -> Previous Tab
        if (currentIdx > 0) {
          navigate(TABS[currentIdx - 1].path);
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [activeTab, navigate]);

  const handleSignOut = async () => {
    setIsProfileOpen(false);
    try {
      await signOut(auth);
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Sign out error:', err);
      navigate('/', { replace: true });
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') return;
    setIsDeletingAccount(true);
    setDeleteError(null);
    try {
      if (auth.currentUser) {
        await deleteUser(auth.currentUser);
      }
      localStorage.clear();
      sessionStorage.clear();
      setActiveModal(null);
      navigate('/signin', { replace: true });
    } catch (err: any) {
      console.error('Account deletion error:', err);
      if (err.code === 'auth/requires-recent-login') {
        setDeleteError('For security, this action requires a recent sign-in. Please sign out and sign in again before deleting.');
      } else {
        setDeleteError(err.message || 'Failed to delete account. Please try again.');
      }
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // User display name & avatar initial
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Admin';
  const initial = (displayName.charAt(0) || 'A').toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-2xs select-none">
        {/* LINE 1: Logo & Name on Left | Circle Profile Button on Right */}
        <div className="w-full px-3 sm:px-6 lg:px-8 xl:px-10 h-14 sm:h-15 flex items-center justify-between gap-3">
          {/* Left: Brand Identity with Lora font */}
          <Link 
            to="/admin" 
            className="flex items-center gap-2.5 sm:gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-xl py-1 px-1.5 -ml-1.5 transition-transform active:scale-98 shrink-0"
            title="Current News Admin"
            id="admin-brand-link"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl overflow-hidden bg-slate-950 shadow-xs border border-slate-200 dark:border-slate-800 shrink-0 flex items-center justify-center p-0.5 group-hover:shadow-md transition-shadow">
              <img 
                src="/CurrentNews.png" 
                alt="Current News Logo" 
                className="w-full h-full object-contain" 
              />
            </div>
            <span className="font-lora text-lg sm:text-2xl font-semibold tracking-tight text-slate-950 dark:text-white leading-none antialiased">
              Current News Admin
            </span>
          </Link>

          {/* Right: Circle Profile Button with Flyout Menu */}
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setIsProfileOpen(prev => !prev)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-2 border-slate-300/80 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs transition-all active:scale-95 cursor-pointer overflow-hidden group"
              aria-label="User Profile and Administrative Settings"
              aria-expanded={isProfileOpen}
              title={`${displayName} — Profile & Menu`}
              id="admin-circle-profile-button"
            >
              {user?.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={displayName} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-mono">
                  {initial}
                </span>
              )}
            </button>

            {/* Profile Dropdown Menu */}
            {isProfileOpen && (
              <div 
                className="absolute right-0 mt-2 w-64 sm:w-72 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150 font-sans"
                role="menu"
                id="admin-profile-dropdown"
              >
                {/* User Summary Card */}
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 overflow-hidden font-bold text-slate-800 dark:text-white text-sm font-mono">
                      {user?.photoURL ? (
                        <img src={user.photoURL} alt={displayName} className="w-full h-full object-cover" />
                      ) : (
                        initial
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {displayName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono">
                        {user?.email || 'Authenticated Staff'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Profile Actions List */}
                <div className="py-1 text-xs">
                  {/* Privacy Button */}
                  <Link
                    to="/privacy"
                    onClick={() => setIsProfileOpen(false)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left"
                  >
                    <ShieldCheck className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span className="font-medium">Privacy Policy</span>
                  </Link>

                  {/* TOS Button */}
                  <Link
                    to="/terms"
                    onClick={() => setIsProfileOpen(false)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left"
                  >
                    <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span className="font-medium">Terms of Service</span>
                  </Link>

                  {/* Delete Account Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      setDeleteConfirmText('');
                      setDeleteError(null);
                      setActiveModal('delete');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50/80 dark:hover:bg-rose-950/30 transition-colors text-left cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="font-medium">Delete Account</span>
                  </button>
                </div>

                {/* Sign Out Button */}
                <div className="pt-1 mt-1 border-t border-slate-100 dark:border-slate-800/80">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left font-bold text-xs cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* LINE 2: Navigation Buttons (Centered in middle, no background pill box, reference image pattern) */}
        <div className="w-full px-2.5 sm:px-6 pb-2.5 pt-0.5">
          <nav 
            className="flex items-center justify-start xs:justify-center gap-0.5 xs:gap-1.5 sm:gap-2.5 max-w-full mx-auto select-none overflow-x-auto no-scrollbar scroll-smooth px-1 py-0.5"
            aria-label="Editorial Sections"
            id="admin-tabs-nav"
          >
            {TABS.map((tab, idx) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <React.Fragment key={tab.id}>
                  {idx > 0 && (
                    <span 
                      className="w-px h-3.5 sm:h-4 bg-slate-200/90 dark:bg-slate-800/90 shrink-0 select-none mx-0.5 sm:mx-1" 
                      aria-hidden="true" 
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => navigate(tab.path)}
                    className={`inline-flex items-center gap-1 sm:gap-2 px-2 xs:px-2.5 sm:px-4 py-1 sm:py-1.5 mx-0.5 sm:mx-1 rounded-full text-[11px] xs:text-xs sm:text-xs md:text-sm font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 border ${
                      isActive
                        ? `${tab.activeStyles} liquid-tab-active font-extrabold`
                        : 'border-transparent text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/50'
                    }`}
                    id={`admin-nav-${tab.id}-button`}
                  >
                    <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${isActive ? '' : tab.iconColor}`} />
                    <span>{tab.label}</span>
                  </button>
                </React.Fragment>
              );
            })}
          </nav>
        </div>
      </header>

      {/* DELETE ACCOUNT MODAL */}
      {activeModal === 'delete' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-3xl max-w-md w-full shadow-2xl p-6 relative font-sans">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">
                  Delete Account
                </h2>
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                  Permanent & Irreversible Action
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
              Deleting your account permanently revokes your newsroom credentials and removes your session from the Ledger. Published articles will remain in the public ledger under Current News Staff.
            </p>

            {deleteError && (
              <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-xs">
                {deleteError}
              </div>
            )}

            <div className="space-y-3 mb-6">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono">
                Type <span className="text-rose-600 font-black">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-150 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                disabled={isDeletingAccount}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText.trim().toUpperCase() !== 'DELETE' || isDeletingAccount}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-2"
              >
                {isDeletingAccount ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
