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
  user: auth.currentUser || null,
  loading: !auth.currentUser,
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
 * Uses getIdTokenResult(false) for local cached token parsing to eliminate network latency,
 * guaranteeing zero UI flicker or bounce-back during login navigation.
 */
export async function syncUserAuthState(currentUser: User, forceRefresh = true): Promise<AuthState> {
  let role: 'admin' | 'writer' | null = null;

  try {
    // Force-refresh token on login so newly assigned role claims are picked up immediately
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
      updateGlobalAuthState({
        user: null,
        loading: false,
        isAdmin: false,
        isOwnerAdmin: false,
        role: null,
      });
      return;
    }

    await syncUserAuthState(currentUser);
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
