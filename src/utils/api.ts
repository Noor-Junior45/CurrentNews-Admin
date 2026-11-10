/**
 * Client API for Cloudflare Worker & D1 Database
 * Replaces Firestore for all reader-side data: stats, reactions, subscribers, push, pen names.
 */

import { auth } from '../firebase';

export interface PostStats {
  likes: number;
  dislikes: number;
  views: number;
}

const DEFAULT_API_BASE = 'https://api.currentnews.blog';
export const API_BASE = (((import.meta as any).env?.VITE_API_BASE as string) || DEFAULT_API_BASE).replace(/\/+$/, '');

/**
 * Retrieve current user's Firebase ID token if signed in
 */
import { formatAuthErrorMessage } from './adminFetch';

async function getIdToken(forceRefresh = false): Promise<string | null> {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken(forceRefresh);
  } catch (err) {
    console.debug('[Worker API] Could not get ID token:', err);
    return null;
  }
}

/**
 * Wrapper around fetch that auto-attaches Firebase ID token and default headers.
 * Automatically refreshes token and retries once on token_expired / token_revoked.
 */
async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: string | null; status: number; code?: string }> {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const execute = async (token: string | null) => {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && options.method && options.method !== 'GET') {
      headers.set('Content-Type', 'application/json');
    }
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const res = await fetch(url, {
      ...options,
      headers,
    });

    const isJson = res.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await res.json().catch(() => null) : null;
    const code = (data?.code as string | undefined) || undefined;

    return { res, data, code };
  };

  try {
    let token = await getIdToken(false);
    let { res, data, code } = await execute(token);

    if (!res.ok && (code === 'token_expired' || code === 'token_revoked')) {
      console.warn(`[Worker API] Received ${code}. Refreshing token and retrying once...`);
      const freshToken = await getIdToken(true);
      if (freshToken) {
        const retryResult = await execute(freshToken);
        res = retryResult.res;
        data = retryResult.data;
        code = retryResult.code;
      }
    }

    if (!res.ok) {
      const rawError = data?.error || data?.message || `HTTP ${res.status}: ${res.statusText}`;
      const readableError = formatAuthErrorMessage(code, rawError);
      return {
        data: null,
        error: readableError,
        status: res.status,
        code,
      };
    }

    return { data, error: null, status: res.status, code };
  } catch (err: any) {
    console.warn(`[Worker API] Network error on ${endpoint}:`, err?.message || err);
    return { data: null, error: err?.message || 'Network request failed', status: 0 };
  }
}

export const api = {
  /**
   * Batch fetch likes/dislikes/views for multiple post IDs in ONE query
   * Cached at Cloudflare edge with s-maxage=30
   */
  async getPostStats(postIds: string[]): Promise<Record<string, PostStats>> {
    if (!postIds || postIds.length === 0) return {};
    const validIds = postIds.map((id) => id.trim()).filter(Boolean);
    if (validIds.length === 0) return {};

    const { data } = await apiFetch<{ stats: Record<string, PostStats> }>(
      `/stats?ids=${encodeURIComponent(validIds.join(','))}`
    );

    return data?.stats || {};
  },

  /**
   * Record article view with 30-minute IP deduplication
   */
  async recordPostView(postId: string): Promise<boolean> {
    if (!postId) return false;
    const { data } = await apiFetch<{ success: boolean }>(`/view/${encodeURIComponent(postId)}`, {
      method: 'POST',
    });
    return Boolean(data?.success);
  },

  /**
   * Fetch current authenticated user's reaction for a specific post
   */
  async getUserReaction(postId: string): Promise<'like' | 'dislike' | null> {
    if (!postId || !auth.currentUser) return null;
    const { data } = await apiFetch<{ type: 'like' | 'dislike' | null }>(
      `/reaction/${encodeURIComponent(postId)}`
    );
    return data?.type || null;
  },

  /**
   * Set or remove user reaction idempotently.
   * Throws on non-OK response or network error so callers can retry or handle auth errors.
   */
  async setUserReaction(
    postId: string,
    type: 'like' | 'dislike' | null,
    options: { keepalive?: boolean } = {}
  ): Promise<{ success: boolean; type: 'like' | 'dislike' | null }> {
    if (!postId) throw new Error('Post ID is required');
    const { data, error, status } = await apiFetch<{ success: boolean; type: 'like' | 'dislike' | null }>(
      `/reaction/${encodeURIComponent(postId)}`,
      {
        method: 'POST',
        body: JSON.stringify({ type }),
        keepalive: options.keepalive,
      }
    );

    if (error || !data?.success) {
      const err: any = new Error(error || 'Failed to update reaction in Worker D1');
      err.status = status;
      throw err;
    }

    return { success: true, type: data?.type ?? null };
  },

  /**
   * Fetch list of post IDs liked by the authenticated user (for LikedView)
   */
  async getMyReactions(): Promise<string[]> {
    if (!auth.currentUser) return [];
    const { data } = await apiFetch<{ likedPostIds: string[] }>('/my-reactions');
    return data?.likedPostIds || [];
  },

  /**
   * Subscribe an email address to the newsletter
   */
  async subscribeEmail(email: string): Promise<boolean> {
    const trimmed = (email || '').trim().toLowerCase();
    if (!trimmed) return false;
    const { data } = await apiFetch<{ success: boolean }>('/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email: trimmed }),
    });
    return Boolean(data?.success);
  },

  /**
   * Check if an email address is subscribed (requires auth)
   */
  async checkEmailSubscription(email: string): Promise<boolean> {
    const trimmed = (email || '').trim().toLowerCase();
    if (!trimmed || !auth.currentUser) return false;
    const { data } = await apiFetch<{ subscribed: boolean }>(
      `/subscribe/check?email=${encodeURIComponent(trimmed)}`
    );
    return Boolean(data?.subscribed);
  },

  /**
   * Unsubscribe current user's email address
   */
  async unsubscribeEmail(): Promise<boolean> {
    if (!auth.currentUser) return false;
    const { data } = await apiFetch<{ success: boolean }>('/subscribe', {
      method: 'DELETE',
    });
    return Boolean(data?.success);
  },

  /**
   * Save Web Push subscription to Cloudflare D1
   */
  async savePushSubscription(id: string, subscription: any): Promise<boolean> {
    const { data } = await apiFetch<{ success: boolean }>('/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ id, subscription }),
    });
    return Boolean(data?.success);
  },

  /**
   * Delete Web Push subscription from D1
   */
  async deletePushSubscription(id: string): Promise<boolean> {
    const { data } = await apiFetch<{ success: boolean }>(
      `/push/subscribe?id=${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
    return Boolean(data?.success);
  },

  /**
   * Get total registered push device subscriber count
   */
  async getPushSubscriberCount(): Promise<number> {
    const { data } = await apiFetch<{ count: number }>('/push/count');
    return data?.count ?? 0;
  },

  /**
   * Fetch author pen name for current user
   */
  async getUserPenName(): Promise<string | null> {
    if (!auth.currentUser) return null;
    const { data } = await apiFetch<{ penName: string | null }>('/user/pen-name');
    return data?.penName || null;
  },

  /**
   * Save author pen name for current user
   */
  async setUserPenName(penName: string): Promise<boolean> {
    if (!auth.currentUser) return false;
    const { data } = await apiFetch<{ success: boolean }>('/user/pen-name', {
      method: 'PUT',
      body: JSON.stringify({ penName: (penName || '').trim() }),
    });
    return Boolean(data?.success);
  },

  /**
   * Admin: List all subscribers
   */
  async getSubscribersAdmin(): Promise<{ email: string; created_at: number }[]> {
    const { data } = await apiFetch<{ subscribers: { email: string; created_at: number }[] }>(
      '/subscribers'
    );
    return data?.subscribers || [];
  },

  /**
   * Admin: Delete a subscriber
   */
  async deleteSubscriberAdmin(email: string): Promise<boolean> {
    const { data } = await apiFetch<{ success: boolean }>('/admin/subscriber', {
      method: 'DELETE',
      body: JSON.stringify({ email: (email || '').trim().toLowerCase() }),
    });
    return Boolean(data?.success);
  },

  /**
   * Admin: Bulk import Firestore data export into Cloudflare D1
   */
  async importFirestoreData(payload: any): Promise<any> {
    const { data, error } = await apiFetch<any>('/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (error) {
      throw new Error(error);
    }
    return data;
  },
};
