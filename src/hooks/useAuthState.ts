import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../firebase';

export interface AuthState {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isOwnerAdmin: boolean;
  role: 'admin' | 'writer' | null;
}

/**
 * React hook for authenticated staff identity.
 * Roles and permissions derive SOLELY from verified Firebase Custom Claims on the ID token.
 * No hardcoded emails, domains, or client-side bypasses.
 */
let cachedAuthState: AuthState = {
  user: null,
  loading: true,
  isAdmin: false,
  isOwnerAdmin: false,
  role: null,
};

let isAuthInitialized = false;
const listeners = new Set<(state: AuthState) => void>();

function updateGlobalAuthState(newState: AuthState) {
  cachedAuthState = newState;
  listeners.forEach((listener) => listener(cachedAuthState));
}

// Start Firebase auth listener once at module evaluation
if (typeof window !== 'undefined' && !isAuthInitialized) {
  isAuthInitialized = true;
  onAuthStateChanged(auth, async (currentUser) => {
    if (!currentUser) {
      updateGlobalAuthState({
        user: null,
        loading: false,
        isAdmin: false,
        isOwnerAdmin: false,
        role: null,
      });
      return;
    }

    try {
      const tokenResult = await currentUser.getIdTokenResult(true);
      const role = (tokenResult.claims.role as 'admin' | 'writer') || null;
      const isWriter = role === 'writer';
      const isOwnerAdmin = role === 'admin';
      const isAdmin = isOwnerAdmin || isWriter;

      updateGlobalAuthState({
        user: currentUser,
        loading: false,
        isAdmin,
        isOwnerAdmin,
        role,
      });
    } catch (err) {
      console.warn('[Auth State] Error retrieving custom claims:', err);
      updateGlobalAuthState({
        user: currentUser,
        loading: false,
        isAdmin: false,
        isOwnerAdmin: false,
        role: null,
      });
    }
  });
}

/**
 * React hook for authenticated staff identity.
 * Cached in memory so route transitions never trigger full-page loading buffers.
 */
export function useAuthState(): AuthState {
  const [state, setState] = useState<AuthState>(cachedAuthState);

  useEffect(() => {
    // If cache updated while mounting
    if (state !== cachedAuthState) {
      setState(cachedAuthState);
    }

    const handler = (nextState: AuthState) => setState(nextState);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, [state]);

  return state;
}
