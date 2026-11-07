/**
 * src/utils/reactionStore.ts
 *
 * Instagram-Style Optimistic Reaction Store for Current News Live
 *
 * Features:
 * - Per-user reactions in localStorage `cn_react_${uid}`
 * - Last server-confirmed state in `cn_confirmed_${uid}`
 * - Instant UI updates on tap with heart-pop animation
 * - Debounced flush 1500 ms after the LAST tap
 * - Sends nothing if final state equals confirmed state
 * - Idempotent "set to X" requests (never toggles)
 * - Persisted retry queue with exponential backoff in `cn_react_queue_${uid}`
 * - Automatic flush on visibilitychange / pagehide (fetch keepalive) / online / app start
 * - Loads /my-reactions once per session (10-minute cache)
 * - Displayed count formula:
 *     count = serverCount + (localMine === 'like' ? 1 : 0) - (serverMine === 'like' ? 1 : 0)
 * - Never overwrites count with stale server count for posts with pending/recent changes
 * - HTTP 401 clears the queue
 */

import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { api } from './api';

export type ReactionType = 'like' | 'dislike' | null;

interface QueueItem {
  postId: string;
  type: ReactionType;
  attempts: number;
  nextRetry: number;
  timestamp: number;
}

type Listener = () => void;

class ReactionStore {
  private currentUid: string | null = null;
  private localReactions: Record<string, ReactionType> = {};
  private confirmedReactions: Record<string, ReactionType> = {};
  private retryQueue: QueueItem[] = [];
  private debounceTimers: Map<string, any> = new Map();
  private recentChangeTimestamps: Map<string, number> = new Map();
  private listeners: Set<Listener> = new Set();
  private isFlushing = false;
  private myReactionsLoadedForSession = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initAuthListener();
      this.initLifecycleListeners();
    }
  }

  private getStorageKey(prefix: string): string {
    return `${prefix}_${this.currentUid || 'guest'}`;
  }

  private initAuthListener() {
    onAuthStateChanged(auth, async (user) => {
      const prevUid = this.currentUid;
      this.currentUid = user ? user.uid : null;

      if (this.currentUid !== prevUid) {
        // If guest had local reactions, migrate them to logged-in user
        if (user) {
          try {
            const guestStored = localStorage.getItem('cn_react_guest');
            if (guestStored) {
              const guestReactions = JSON.parse(guestStored);
              const userKey = this.getStorageKey('cn_react');
              const existingUserStored = localStorage.getItem(userKey);
              const existingUserReactions = existingUserStored ? JSON.parse(existingUserStored) : {};
              for (const [id, r] of Object.entries(guestReactions)) {
                if (!existingUserReactions[id]) {
                  existingUserReactions[id] = r;
                  if (r === 'like') {
                    this.enqueueReaction(id, 'like');
                  }
                }
              }
              localStorage.setItem(userKey, JSON.stringify(existingUserReactions));
              localStorage.removeItem('cn_react_guest');
            }
          } catch (_) {}
        }

        this.loadFromStorage();
        this.myReactionsLoadedForSession = false;
        if (user) {
          await this.loadMyReactions();
          this.flush();
        }
        this.notify();
      }
    });
  }

  private loadFromStorage() {
    try {
      const storedLocal = localStorage.getItem(this.getStorageKey('cn_react'));
      this.localReactions = storedLocal ? JSON.parse(storedLocal) : {};
    } catch (_) {
      this.localReactions = {};
    }

    try {
      const storedConfirmed = localStorage.getItem(this.getStorageKey('cn_confirmed'));
      this.confirmedReactions = storedConfirmed ? JSON.parse(storedConfirmed) : {};
    } catch (_) {
      this.confirmedReactions = {};
    }

    if (!this.currentUid) {
      this.retryQueue = [];
      return;
    }

    try {
      const storedQueue = localStorage.getItem(this.getStorageKey('cn_react_queue'));
      this.retryQueue = storedQueue ? JSON.parse(storedQueue) : [];
    } catch (_) {
      this.retryQueue = [];
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(this.getStorageKey('cn_react'), JSON.stringify(this.localReactions));
      localStorage.setItem(this.getStorageKey('cn_confirmed'), JSON.stringify(this.confirmedReactions));
      if (this.currentUid) {
        localStorage.setItem(this.getStorageKey('cn_react_queue'), JSON.stringify(this.retryQueue));
      }
    } catch (_) {}
  }

  private initLifecycleListeners() {
    // 1. Flush immediately when page is hidden or navigating away with fetch keepalive
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flushAllDebounces();
        this.flush({ keepalive: true });
      }
    });

    window.addEventListener('pagehide', () => {
      this.flushAllDebounces();
      this.flush({ keepalive: true });
    });

    // 2. Flush on network reconnection
    window.addEventListener('online', () => {
      this.flush();
    });

    // 3. Periodic retry check for backoff queue
    setInterval(() => {
      if (this.retryQueue.length > 0) {
        this.flush();
      }
    }, 10000);
  }

  /**
   * Immediately clears pending debounce timers and queues the action
   */
  private flushAllDebounces() {
    for (const [postId, timer] of this.debounceTimers.entries()) {
      clearTimeout(timer);
      this.debounceTimers.delete(postId);
      this.enqueueReaction(postId, this.getReaction(postId));
    }
  }

  /**
   * Subscribe to reaction store updates
   */
  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.debug('[ReactionStore] Listener error:', err);
      }
    });
  }

  /**
   * Get current local reaction for a post ('like' | 'dislike' | null)
   */
  public getReaction(postId: string): ReactionType {
    return this.localReactions[postId] ?? null;
  }

  /**
   * Get last server-confirmed reaction for a post
   */
  public getConfirmedReaction(postId: string): ReactionType {
    return this.confirmedReactions[postId] ?? null;
  }

  /**
   * Return array of all post IDs the current user has liked
   */
  public getLikedIds(): string[] {
    return Object.keys(this.localReactions).filter((id) => this.localReactions[id] === 'like');
  }

  /**
   * Calculates displayed counts using the formula:
   *   displayedLikes = serverLikes + (localMine === 'like' ? 1 : 0) - (confirmedMine === 'like' ? 1 : 0)
   *   displayedDislikes = serverDislikes + (localMine === 'dislike' ? 1 : 0) - (confirmedMine === 'dislike' ? 1 : 0)
   */
  public getCalculatedCounts(postId: string, serverLikes: number, serverDislikes: number) {
    const local = this.getReaction(postId);
    const confirmed = this.getConfirmedReaction(postId);

    const localLikeOffset = local === 'like' ? 1 : 0;
    const confirmedLikeOffset = confirmed === 'like' ? 1 : 0;

    const localDislikeOffset = local === 'dislike' ? 1 : 0;
    const confirmedDislikeOffset = confirmed === 'dislike' ? 1 : 0;

    const displayedLikes = Math.max(0, (Number(serverLikes) || 0) + localLikeOffset - confirmedLikeOffset);
    const displayedDislikes = Math.max(0, (Number(serverDislikes) || 0) + localDislikeOffset - confirmedDislikeOffset);

    return {
      likes: displayedLikes,
      dislikes: displayedDislikes,
      myReaction: local,
    };
  }

  /**
   * Checks whether a post has a pending debounce or recent tap (< 8 seconds)
   * to protect against stale server count overwrites
   */
  public hasPendingOrRecentChange(postId: string): boolean {
    if (this.debounceTimers.has(postId)) return true;
    if (this.retryQueue.some((q) => q.postId === postId)) return true;
    const recent = this.recentChangeTimestamps.get(postId);
    if (recent && Date.now() - recent < 8000) return true;
    return false;
  }

  /**
   * Optimistically toggle or set a reaction on a post.
   * Debounces the server flush by 1500 ms after the LAST tap.
   */
  public setReaction(postId: string, targetType: ReactionType) {
    if (!postId) return;

    // 1. Instant optimistic update
    this.localReactions[postId] = targetType;
    this.recentChangeTimestamps.set(postId, Date.now());
    this.saveToStorage();

    // Synchronize cn_my_reactions cache immediately so LikedView reflects the change
    try {
      const cacheKey = this.getStorageKey('cn_my_reactions');
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.likedPostIds)) {
          let list: string[] = parsed.likedPostIds;
          if (targetType === 'like') {
            if (!list.includes(postId)) list.push(postId);
          } else {
            list = list.filter((id) => id !== postId);
          }
          parsed.likedPostIds = list;
          localStorage.setItem(cacheKey, JSON.stringify(parsed));
        }
      }
    } catch (_) {}

    this.notify();

    // 2. Clear existing debounce timer for this post
    if (this.debounceTimers.has(postId)) {
      clearTimeout(this.debounceTimers.get(postId));
      this.debounceTimers.delete(postId);
    }

    // 3. Set debounced timer 1500 ms after LAST tap
    const timer = setTimeout(() => {
      this.debounceTimers.delete(postId);
      const currentTarget = this.localReactions[postId] ?? null;
      const currentConfirmed = this.confirmedReactions[postId] ?? null;

      // Send nothing if final state equals confirmed state (user tapped and undid)
      if (currentTarget === currentConfirmed) {
        // Remove from retry queue if was queued
        this.retryQueue = this.retryQueue.filter((q) => q.postId !== postId);
        this.saveToStorage();
        return;
      }

      this.enqueueReaction(postId, currentTarget);
      this.flush();
    }, 1500);

    this.debounceTimers.set(postId, timer);
  }

  private enqueueReaction(postId: string, type: ReactionType) {
    const existingIndex = this.retryQueue.findIndex((q) => q.postId === postId);
    const item: QueueItem = {
      postId,
      type,
      attempts: 0,
      nextRetry: Date.now(),
      timestamp: Date.now(),
    };

    if (existingIndex >= 0) {
      this.retryQueue[existingIndex] = item;
    } else {
      this.retryQueue.push(item);
    }
    this.saveToStorage();
  }

  /**
   * Flush pending reactions in the retry queue
   */
  public async flush(options: { keepalive?: boolean } = {}) {
    if (this.isFlushing || this.retryQueue.length === 0 || !this.currentUid) return;
    this.isFlushing = true;

    const now = Date.now();
    const toProcess = this.retryQueue.filter((item) => item.nextRetry <= now);

    for (const item of toProcess) {
      try {
        await api.setUserReaction(item.postId, item.type, options);

        // Server confirmed!
        this.confirmedReactions[item.postId] = item.type;
        this.retryQueue = this.retryQueue.filter((q) => q.postId !== item.postId);
        this.saveToStorage();
      } catch (err: any) {
        console.warn(`[ReactionStore] Failed to sync reaction for ${item.postId}:`, err?.message || err);

        // 401 Unauthorized clears the queue
        if (err?.status === 401) {
          console.warn('[ReactionStore] HTTP 401 received: Clearing reaction queue');
          this.retryQueue = [];
          this.saveToStorage();
          break;
        }

        // Exponential backoff
        item.attempts++;
        const delay = Math.min(60000, 1500 * Math.pow(2, item.attempts));
        item.nextRetry = Date.now() + delay;
        this.saveToStorage();
      }
    }

    this.isFlushing = false;
  }

  /**
   * Load /my-reactions once per session (10-minute cache)
   */
  public async loadMyReactions(): Promise<string[]> {
    if (!this.currentUid) return [];

    const cacheKey = this.getStorageKey('cn_my_reactions');
    const cached = localStorage.getItem(cacheKey);
    const now = Date.now();

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.likedPostIds) && now - (parsed.timestamp || 0) < 10 * 60 * 1000) {
          this.myReactionsLoadedForSession = true;
          this.syncLikedIds(parsed.likedPostIds);
          return parsed.likedPostIds;
        }
      } catch (_) {}
    }

    if (this.myReactionsLoadedForSession) {
      return Object.keys(this.localReactions).filter((id) => this.localReactions[id] === 'like');
    }

    try {
      const likedPostIds = await api.getMyReactions();
      this.myReactionsLoadedForSession = true;

      // Update confirmed & local states
      this.syncLikedIds(likedPostIds);

      // Save 10 min cache
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          likedPostIds,
          timestamp: now,
        })
      );

      this.notify();
      return likedPostIds;
    } catch (err) {
      console.debug('[ReactionStore] Failed to load my reactions:', err);
      return [];
    }
  }

  private syncLikedIds(likedPostIds: string[]) {
    for (const postId of likedPostIds) {
      this.confirmedReactions[postId] = 'like';
      if (!this.debounceTimers.has(postId)) {
        this.localReactions[postId] = 'like';
      }
    }
    this.saveToStorage();
  }

  /**
   * Helper to set initial server-confirmed reaction if discovered from server
   */
  public registerServerState(postId: string, serverType: ReactionType) {
    if (!this.hasPendingOrRecentChange(postId)) {
      this.confirmedReactions[postId] = serverType;
      this.localReactions[postId] = serverType;
      this.saveToStorage();
    }
  }
}

export const reactionStore = new ReactionStore();
