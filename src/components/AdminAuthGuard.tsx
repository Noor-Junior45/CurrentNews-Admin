import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuthState } from '../hooks/useAuthState';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { ShieldAlert, LogOut, ExternalLink } from 'lucide-react';
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
  // Role claim check only — never an email comparison
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

  // 2. Unauthenticated user -> Redirect to root landing page
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
      <div 
        className="w-full min-h-screen bg-[#edf6f9] flex flex-col items-center justify-center p-6 sm:p-10 text-center select-none" 
        id="unauthorized-slate"
      >
        <div className="bg-[#ffe5ec] text-[#03071e] inline-flex p-4 rounded-full border border-[#fb6f92]/20 mb-4 shadow-xs">
          <ShieldAlert className="h-8 w-8 text-[#54463A]" />
        </div>
        <h2 className="text-2xl font-lora font-bold text-[#000814] mb-2 tracking-tight">
          Role Assignment Required
        </h2>
        <p className="text-xs text-[#000000]/85 leading-relaxed font-sans mb-2">
          Signed in as <strong className="text-[#006d77] font-bold">{user.email || user.uid}</strong>.
        </p>
        <p className="text-xs text-[#000000]/80 leading-relaxed font-sans mb-6 max-w-md">
          This portal strictly registers and authorizes newsroom staff. Your account does not currently have an active <code>admin</code> or <code>writer</code> role claim assigned.
        </p>

        {errorMessage && (
          <p role="alert" className="w-full max-w-md mb-4 px-3.5 py-2.5 bg-[#C75F71]/15 border border-[#C75F71]/40 rounded-xl text-[#54463A] text-xs text-center leading-relaxed font-medium">
            {errorMessage}
          </p>
        )}

        <div className="w-full max-w-md space-y-3">
          <button
            onClick={handleGoogleRetry}
            disabled={isAuthenticating}
            className="w-full bg-[#54463A] hover:bg-[#43372E] text-white py-3.5 px-4 rounded-xl text-xs sm:text-sm font-sans font-bold uppercase tracking-wider transition-all shadow-xs active:scale-[0.99] cursor-pointer inline-flex items-center justify-center space-x-2 disabled:opacity-60"
          >
            <span>{isAuthenticating ? 'Authenticating...' : 'Sign In With Another Account'}</span>
          </button>

          <button
            onClick={async () => {
              try {
                await signOut(auth);
              } catch (_) {}
              window.location.href = 'https://currentnews.blog/signin';
            }}
            className="w-full bg-[#f00606] hover:bg-[#ff0022] text-white py-3.5 px-4 rounded-xl text-xs sm:text-sm font-sans font-bold uppercase tracking-wider transition-all shadow-xs active:scale-[0.99] cursor-pointer inline-flex items-center justify-center gap-2"
            id="login-as-reader-btn"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Login as Reader</span>
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
