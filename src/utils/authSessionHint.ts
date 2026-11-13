export const AUTH_SESSION_HINT_KEY = 'cn_auth_session_active';

function getSafeLocalStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Ignore storage access errors in restricted iframes/sandboxes
  }
  return null;
}

/**
 * UX-only routing hint indicating the user previously completed a sign-in session
 * and has not explicitly signed out. NEVER used for authorization or permissions.
 */
export function hasAuthSessionHint(storage: Pick<Storage, 'getItem'> | null = getSafeLocalStorage()): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(AUTH_SESSION_HINT_KEY) === '1';
  } catch {
    return false;
  }
}

export function setAuthSessionHint(storage: Pick<Storage, 'setItem'> | null = getSafeLocalStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(AUTH_SESSION_HINT_KEY, '1');
  } catch {
    // Ignore quota or restricted storage errors
  }
}

export function clearAuthSessionHint(storage: Pick<Storage, 'removeItem'> | null = getSafeLocalStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(AUTH_SESSION_HINT_KEY);
  } catch {
    // Ignore restricted storage errors
  }
}

/**
 * Determines whether the root / login route should bypass rendering the sign-in form
 * and route straight into /admin for smooth session restoration.
 */
export function shouldRedirectRootToAdmin(options: {
  hasCurrentUser: boolean;
  hasSessionHint: boolean;
}): boolean {
  return options.hasCurrentUser || options.hasSessionHint;
}

export type AuthGuardViewState = 'loading' | 'unauthenticated' | 'unauthorized' | 'authorized';

/**
 * Computes the guard state cleanly without flashing "Role Assignment Required"
 * while Firebase token claims are still hydrating.
 */
export function getAuthGuardViewState(params: {
  loading: boolean;
  hasUser: boolean;
  hasAdminPrivileges: boolean;
}): AuthGuardViewState {
  if (params.loading) {
    return 'loading';
  }
  if (!params.hasUser) {
    return 'unauthenticated';
  }
  if (!params.hasAdminPrivileges) {
    return 'unauthorized';
  }
  return 'authorized';
}
