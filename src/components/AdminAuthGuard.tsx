import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuthState } from '../hooks/useAuthState';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { ShieldAlert, LogOut } from 'lucide-react';
import { signInWithGoogleSafe } from '../utils/authHelper';

interface AdminAuthGuardProps {
  children: React.ReactNode;
}

export default function AdminAuthGuard({ children }: AdminAuthGuardProps): React.JSX.Element {
  const { user, loading, isAdmin } = useAuthState();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Synchronously evaluate SDK current user if state update is in-flight
  const activeUser = user || auth.currentUser;
  const hasAdminPrivileges = isAdmin;

  // 1. Loading screen: only if initial SDK loading with no user session
  if (loading && !activeUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] font-mono">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900 dark:border-white mb-4" />
        <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
          Accessing Administrator authorization context...
        </span>
      </div>
    );
  }

  // 2. Unauthenticated user -> Redirect to root landing page where full Email/Password & Google auth are handled
  if (!activeUser) {
    return <Navigate to="/" replace />;
  }

  // 3. Authenticated user without admin or writer custom claims
  if (!hasAdminPrivileges) {
    const handleGoogleRetry = async () => {
      if (isAuthenticating) return;
      setIsAuthenticating(true);
      setErrorMessage(null);
      try {
        const res = await signInWithGoogleSafe();
        if (res.success) {
          window.location.reload();
        } else if (!res.cancelled && res.error) {
          setErrorMessage(res.error);
        }
      } catch (err: any) {
        console.warn('[AdminAuthGuard] Auth notice:', err?.message || err);
        setErrorMessage('Authentication could not be completed. Please try another account.');
      } finally {
        setIsAuthenticating(false);
      }
    };

    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center shadow-xs" id="unauthorized-slate">
        <div className="bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 inline-flex p-4 rounded-full border border-amber-200 dark:border-amber-900/50 mb-4">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-display font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">
          Role Assignment Required
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans mb-2">
          Signed in as <strong className="text-slate-800 dark:text-slate-200">{user.email || user.uid}</strong>.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans mb-6">
          This portal strictly registers and authorizes newsroom staff. Your account does not currently have an active <code>admin</code> or <code>writer</code> role claim assigned.
        </p>

        {errorMessage && (
          <div className="w-full mb-4 px-3.5 py-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-600 dark:text-rose-400 text-xs text-center leading-relaxed">
            {errorMessage}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleGoogleRetry}
            disabled={isAuthenticating}
            className="w-full bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 py-3 px-4 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer inline-flex items-center justify-center space-x-2 disabled:opacity-60"
          >
            <span>{isAuthenticating ? 'Authenticating...' : 'Sign In With Another Account'}</span>
          </button>

          <button
            onClick={async () => {
              await signOut(auth);
              navigate('/signin', { replace: true });
            }}
            className="w-full inline-flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-semibold py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out & Return to Sign In</span>
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
