import React from 'react';
import { useAuthState } from '../hooks/useAuthState';
import { auth } from '../firebase';
import { signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { ShieldAlert } from 'lucide-react';

interface AdminAuthGuardProps {
  children: React.ReactNode;
}

export default function AdminAuthGuard({ children }: AdminAuthGuardProps): React.JSX.Element {
  const { user, loading, isAdmin } = useAuthState();

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('Google Sign In failed:', err);
    }
  };

  // 1. Loading screen
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] font-mono">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900 dark:border-white mb-4" />
        <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
          Accessing Administrator authorization context...
        </span>
      </div>
    );
  }

  // 2. Unauthenticated or non-admin screen
  if (!user || !isAdmin) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-center shadow-lg" id="unauthorized-slate">
        <div className="bg-red-50 dark:bg-red-950/40 text-red-650 dark:text-red-400 inline-flex p-4 rounded-full border border-red-150 dark:border-red-900/50 mb-4">
          <ShieldAlert className="h-8 w-8 animate-bounce" />
        </div>
        <h2 className="text-xl font-display font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">
          Access Prohibited
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans mb-6">
          This portal strictly registers and authorizes Ledger news architects. Please authenticate with credentials verified in the system directory.
        </p>

        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            className="w-full bg-slate-950 dark:bg-indigo-600 hover:bg-slate-900 dark:hover:bg-indigo-500 active:scale-95 text-white py-3 px-4 rounded-xl text-xs font-bold transition-all duration-150 shadow-md cursor-pointer inline-flex items-center justify-center space-x-2"
          >
            <span>Authenticate Secure Operator Access</span>
          </button>

          <button
            onClick={() => signOut(auth)}
            className="w-full text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-[11px] font-mono hover:underline cursor-pointer block"
          >
            Sign Out & Try Another Account
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
