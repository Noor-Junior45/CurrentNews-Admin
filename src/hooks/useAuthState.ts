import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../firebase';
import { setAuthSessionHint, clearAuthSessionHint } from '../utils/authSessionHint';

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
  user: auth.currentUser || null,
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

/**
 * Near-instantaneously synchronizes user claims into cachedAuthState.
 * Uses getIdTokenResult(false) by default for local cached token parsing to eliminate
 * network latency on reopen/navigation while preserving fresh claims when requested.
 */
export async function syncUserAuthState(currentUser: User, forceRefresh = false): Promise<AuthState> {
  let role: 'admin' | 'writer' | null = null;

  try {
    const tokenResult = await currentUser.getIdTokenResult(forceRefresh);
    const claimRole = (tokenResult.claims.role as 'admin' | 'writer') || null;
    if (claimRole) {
      role = claimRole;
    }
  } catch (err) {
    console.debug('[Auth State] Token claim read notice:', err);
  }

  const isWriter = role === 'writer';
  const isOwnerAdmin = role === 'admin';
  const isAdmin = isOwnerAdmin || isWriter;

  setAuthSessionHint();

  const nextState: AuthState = {
    user: currentUser,
    loading: false,
    isAdmin,
    isOwnerAdmin,
    role,
  };

  updateGlobalAuthState(nextState);
  return nextState;
}

// Start Firebase auth listener once at module evaluation
if (typeof window !== 'undefined' && !isAuthInitialized) {
  isAuthInitialized = true;
  onAuthStateChanged(auth, async (currentUser) => {
    if (!currentUser) {
      clearAuthSessionHint();
      updateGlobalAuthState({
        user: null,
        loading: false,
        isAdmin: false,
        isOwnerAdmin: false,
        role: null,
      });
      return;
    }

    const syncedState = await syncUserAuthState(currentUser, false);

    // Automatically record Firebase authenticated staff session in database
    try {
      const token = await currentUser.getIdToken(false);
      if (token && currentUser.email && syncedState.isAdmin) {
        fetch('/api/users/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            displayName: currentUser.displayName || null
          })
        }).catch(() => {});
      }
    } catch (_) {}
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
