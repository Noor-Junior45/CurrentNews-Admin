import { auth } from '../firebase';

export interface AdminFetchResult<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
  code?: string;
  raw: Response;
}

/**
 * Maps error codes from requireRole / edge auth to clear, human-readable user messages.
 */
export function formatAuthErrorMessage(code?: string, fallbackMessage?: string): string {
  switch (code) {
    case 'signing_in':
      return 'Signing in...';
    case 'token_expired':
      return 'Session expired. Please sign out and sign in again';
    case 'token_revoked':
      return 'Session expired, please sign out and sign in again';
    case 'no_role':
      return 'Your account has no admin role yet';
    case 'no_token':
      return 'No authorization token found. Please sign in.';
    case 'invalid_token':
      return 'Invalid authentication credentials. Please sign out and sign in again.';
    case 'email_not_verified':
      return 'Your email address must be verified before accessing admin features.';
    case 'forbidden':
      return 'Access forbidden: your account does not have sufficient admin permissions.';
    case 'auth_backend_error':
      return 'Authentication backend service error. Please try again shortly.';
    default:
      return fallbackMessage || 'Authentication error: please verify your admin permissions.';
  }
}

/**
 * Universal admin fetch helper:
 * - Awaits auth.authStateReady() before reading auth.currentUser
 * - If there is still no user, does NOT send the request and returns { error: "Signing in...", code: "signing_in" }
 * - Automatically attaches Firebase ID token to the Authorization header
 * - Sets default JSON Content-Type for POST/PUT/PATCH
 * - On any 401 response, calls auth.currentUser.getIdToken(true) and retries the request exactly once
 * - Formats error codes into readable banner messages
 */
export async function adminFetch<T = any>(
  input: string | URL,
  init: RequestInit = {}
): Promise<AdminFetchResult<T>> {
  // 1. Await auth readiness before reading auth.currentUser
  if (typeof auth.authStateReady === 'function') {
    try {
      await auth.authStateReady();
    } catch (e) {
      console.debug('[adminFetch] authStateReady notice:', e);
    }
  }

  const currentUser = auth.currentUser;
  // If there is still no user, do not send the request and let the caller show a "Signing in..." state
  if (!currentUser) {
    return {
      ok: false,
      status: 401,
      data: null,
      error: 'Signing in...',
      code: 'signing_in',
      raw: new Response(JSON.stringify({ error: 'Signing in...', code: 'signing_in' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    };
  }

  const getToken = async (forceRefresh = false): Promise<string | null> => {
    try {
      const u = auth.currentUser;
      if (!u) return null;
      return await u.getIdToken(forceRefresh);
    } catch (e) {
      console.debug('[adminFetch] Error retrieving ID token:', e);
      return null;
    }
  };

  const execute = async (token: string | null) => {
    const headers = new Headers(init.headers || {});
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (!headers.has('Content-Type') && init.method && init.method !== 'GET') {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(input, {
      ...init,
      headers
    });

    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const data = isJson ? await res.json().catch(() => null) : null;
    const code = (data?.code as string | undefined) || undefined;

    return { res, data, code };
  };

  // 2. Initial attempt with standard token
  let token = await getToken(false);
  let { res, data, code } = await execute(token);

  // 3. On a 401 response, call auth.currentUser.getIdToken(true) and retry the request exactly once
  if (res.status === 401) {
    console.warn(`[adminFetch] Received 401 (${code || 'unauthorized'}). Forcing token refresh via getIdToken(true) and retrying once...`);
    try {
      const freshToken = await currentUser.getIdToken(true);
      if (freshToken) {
        const retryResult = await execute(freshToken);
        res = retryResult.res;
        data = retryResult.data;
        code = retryResult.code;
      }
    } catch (refreshErr) {
      console.warn('[adminFetch] Error refreshing ID token on 401:', refreshErr);
    }
  }

  // 4. If still not OK, construct readable error message
  if (!res.ok) {
    const rawError = data?.error || data?.message || `HTTP ${res.status}: ${res.statusText}`;
    const readableError = formatAuthErrorMessage(code, rawError);

    return {
      ok: false,
      status: res.status,
      data,
      error: readableError,
      code,
      raw: res
    };
  }

  return {
    ok: true,
    status: res.status,
    data,
    error: null,
    code,
    raw: res
  };
}
