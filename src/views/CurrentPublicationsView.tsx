import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuthState } from '../hooks/useAuthState';
import { auth } from '../firebase';
import { Post } from '../types';
import { cleanImageUrl, sanitizePostImages } from '../utils/imageUrl';
import { getCompressedStories, removeCompressedStory, getDeletedStoryIds } from '../utils/compressedStorage';
import { adminFetch } from '../utils/adminFetch';
import { safeFormatDate } from '../utils/dateHelper';
import { updateDocumentSEO } from '../utils/seo';
import { getCanonicalPostUrl } from '../utils/shareUrl';
import {
  PublicationCounts,
  mergePublicationPages,
  applyOptimisticDeleteCount,
  applyOptimisticUpsertCount,
} from '../utils/publicationsHelper';
import { 
  PlusCircle, 
  Edit3, 
  Trash2, 
  ArrowUpRight, 
  CheckCircle, 
  AlertCircle, 
  X, 
  Newspaper,
  RefreshCw
} from 'lucide-react';

const PAGE_SIZE = 15;

export default function CurrentPublicationsView(): React.JSX.Element {
  const { user, isAdmin } = useAuthState();
  const location = useLocation();

  const [posts, setPosts] = useState<Post[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [serverCounts, setServerCounts] = useState<PublicationCounts | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [pubListFilter, setPubListFilter] = useState<'all' | 'published' | 'drafts'>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>((location.state as any)?.warning || null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const activeFetchSeqRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadingMoreRef = useRef(false);

  // Auto-dismiss timers for notifications
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss success notification (e.g., outbox sync, deletion) after 4.5 seconds
  useEffect(() => {
    if (successMsg) {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => {
        setSuccessMsg(null);
      }, 4500);
    }
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, [successMsg]);

  // Auto-dismiss warning notification after 5 seconds
  useEffect(() => {
    if (warningMsg) {
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      warningTimerRef.current = setTimeout(() => {
        setWarningMsg(null);
      }, 5000);
    }
    return () => {
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    };
  }, [warningMsg]);

  // Auto-dismiss error notification after 6 seconds
  useEffect(() => {
    if (errorMsg) {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => {
        setErrorMsg(null);
      }, 6000);
    }
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, [errorMsg]);

  useEffect(() => {
    updateDocumentSEO({
      title: 'Current Publications — Current News Live',
      description: 'Manage and review published dispatches and draft manuscripts.',
      canonicalPath: '/admin/publications',
      robots: 'noindex, nofollow'
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const filterVisiblePosts = useCallback(
    (items: Post[], activeUser: NonNullable<typeof user>): Post[] => {
      const deletedIds = getDeletedStoryIds();
      return items.filter((p) => {
        if (!p || !p.id || deletedIds.has(p.id) || p.status === 'archived') return false;
        if (isAdmin) return true;
        if (p.authorEmail && activeUser.email) {
          return p.authorEmail.toLowerCase() === activeUser.email.toLowerCase();
        }
        if (p.authorId && activeUser.uid) {
          return p.authorId === activeUser.uid;
        }
        const penName = (localStorage.getItem(`current_news_pen_name_${activeUser.uid}`) || '').toLowerCase();
        if (p.authorName && penName && p.authorName.toLowerCase() === penName) {
          return true;
        }
        return false;
      });
    },
    [isAdmin]
  );

  const fetchAdminPosts = useCallback(
    async (options: { filter?: 'all' | 'published' | 'drafts'; cursor?: string | null; append?: boolean } = {}) => {
      const activeUser = user || auth.currentUser;
      if (!activeUser) return;

      const filterToUse = options.filter ?? pubListFilter;
      const append = Boolean(options.append && options.cursor);

      if (append) {
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      } else {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        setFeedLoading(true);
        setHasMore(false);
        setNextCursor(null);
      }

      const fetchSeq = append ? activeFetchSeqRef.current : ++activeFetchSeqRef.current;
      const signal = abortControllerRef.current?.signal;

      try {
        const deletedIds = getDeletedStoryIds();
        const postMap = new Map<string, Post>();

        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          t: String(Date.now()),
        });
        if (filterToUse === 'published') params.set('status', 'published');
        else if (filterToUse === 'drafts') params.set('status', 'draft');
        if (append && options.cursor) {
          params.set('cursor', options.cursor);
        }

        let apiHasMore = false;
        let apiNextCursor: string | null = null;
        let apiCounts: PublicationCounts | null = null;

        // 1. Fetch paginated batch from editorial source of truth (/api/admin/articles)
        try {
          const { ok, data: adminData, error: adminFetchErr } = await adminFetch(
            `/api/admin/articles?${params.toString()}`,
            signal ? { signal } : {}
          );
          if (signal?.aborted || fetchSeq !== activeFetchSeqRef.current) return;

          if (ok && Array.isArray(adminData?.articles)) {
            for (const p of adminData.articles) {
              if (p && p.id && !deletedIds.has(p.id) && p.status !== 'archived') {
                postMap.set(p.id, sanitizePostImages(p));
              }
            }
            apiHasMore = Boolean(adminData.hasMore && adminData.nextCursor);
            apiNextCursor = adminData.nextCursor || null;
            if (adminData.counts && typeof adminData.counts.all === 'number') {
              apiCounts = adminData.counts;
            }
          } else if (!ok && adminFetchErr) {
            setErrorMsg(adminFetchErr);
          }
        } catch (adminErr: any) {
          if (adminErr?.name === 'AbortError') return;
          console.debug('Admin articles fetch notice:', adminErr);
        }

        // 2. Fallback to public feed only on initial load when Neon/API returned empty
        if (!append && postMap.size === 0 && filterToUse !== 'drafts') {
          try {
            const feedRes = await fetch(`/api/articles/feed?t=${Date.now()}`, {
              cache: 'no-store',
              signal,
            });
            if (signal?.aborted || fetchSeq !== activeFetchSeqRef.current) return;
            if (feedRes.ok) {
              const feedData = await feedRes.json();
              if (Array.isArray(feedData.articles)) {
                for (const p of feedData.articles) {
                  if (p && p.id && !deletedIds.has(p.id) && p.status !== 'archived') {
                    postMap.set(p.id, sanitizePostImages(p));
                  }
                }
              }
            }
          } catch (feedErr: any) {
            if (feedErr?.name === 'AbortError') return;
            console.debug('Feed fetch notice:', feedErr);
          }
        }

        // 3. Merge locally compressed stories on initial page so newly saved stories appear at 0ms
        if (!append) {
          try {
            const compressed = getCompressedStories();
            if (compressed && compressed.length > 0) {
              for (const p of compressed) {
                if (p && p.id && !deletedIds.has(p.id) && p.status !== 'archived') {
                  if (filterToUse === 'published' && p.status !== 'published') continue;
                  if (filterToUse === 'drafts' && p.status !== 'draft') continue;
                  if (!postMap.has(p.id)) {
                    postMap.set(p.id, sanitizePostImages(p));
                  }
                }
              }
            }
          } catch (compErr) {
            console.debug('Compressed cache read notice:', compErr);
          }
        }

        if (fetchSeq !== activeFetchSeqRef.current) return;

        const batchPosts = filterVisiblePosts(Array.from(postMap.values()), activeUser);
        setPosts((prev) => mergePublicationPages(prev, batchPosts, !append));
        setHasMore(apiHasMore);
        setNextCursor(apiNextCursor);
        if (apiCounts) {
          setServerCounts(apiCounts);
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.warn('Publications fetch warning:', err);
        }
      } finally {
        if (append) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        } else if (fetchSeq === activeFetchSeqRef.current) {
          setFeedLoading(false);
        }
      }
    },
    [user, pubListFilter, filterVisiblePosts]
  );

  useEffect(() => {
    const activeUser = user || auth.currentUser;
    if (activeUser) {
      fetchAdminPosts({ filter: pubListFilter, append: false });
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [user, isAdmin, pubListFilter, fetchAdminPosts]);

  useEffect(() => {
    const handleStoriesUpdated = (e?: any) => {
      const deletedId = e?.detail?.deletedId;
      const newPost = e?.detail?.newPost;
      if (deletedId) {
        setPosts((prev) => {
          const target = prev.find((p) => p.id === deletedId);
          if (target) {
            setServerCounts((c) => (c ? applyOptimisticDeleteCount(c, target.status) : c));
          }
          return prev.filter((p) => p.id !== deletedId);
        });
      }
      if (newPost && newPost.id && newPost.status !== 'archived') {
        setPosts((prev) => {
          const existing = prev.find((p) => p.id === newPost.id);
          setServerCounts((c) => (c ? applyOptimisticUpsertCount(c, newPost.status, existing?.status || null) : c));
          const sanitized = sanitizePostImages(newPost);
          const filtered = prev.filter((p) => p.id !== newPost.id);
          return [sanitized, ...filtered];
        });
      }
      fetchAdminPosts({ filter: pubListFilter, append: false });
    };
    window.addEventListener('stories-updated', handleStoriesUpdated);
    window.addEventListener('storage', handleStoriesUpdated);
    return () => {
      window.removeEventListener('stories-updated', handleStoriesUpdated);
      window.removeEventListener('storage', handleStoriesUpdated);
    };
  }, [pubListFilter, fetchAdminPosts]);

  // Trigger automatic incremental lazy loading when bottom sentinel enters viewport
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !hasMore || feedLoading) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && hasMore && nextCursor && !loadingMoreRef.current) {
          fetchAdminPosts({ filter: pubListFilter, cursor: nextCursor, append: true });
        }
      },
      { rootMargin: '250px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, nextCursor, feedLoading, pubListFilter, fetchAdminPosts]);

  const handleDeletePost = async (id: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const targetPost = posts.find((p) => p.id === id);

      // 1. Immediately update view state and counts at 0ms
      setPosts((prev) => prev.filter((p) => p.id !== id));
      if (targetPost) {
        setServerCounts((c) => (c ? applyOptimisticDeleteCount(c, targetPost.status) : c));
      }
      setDeleteConfirmId(null);

      // 2. Immediately remove from local compressed memory and mark tombstone
      removeCompressedStory(id);

      // 3. Remove from backend server and editorial repository with Bearer token
      const { ok, error: deleteErr } = await adminFetch(`/api/admin/articles/${id}`, {
        method: 'DELETE'
      });

      if (!ok) {
        throw new Error(deleteErr || 'Failed to delete post');
      }

      setSuccessMsg('Story deleted successfully from storage repository.');

      // 4. Notify all tabs and home view to remove immediately
      window.dispatchEvent(new CustomEvent('stories-updated', { detail: { deletedId: id } }));
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to delete story. Permissions check required.');
      fetchAdminPosts({ filter: pubListFilter, append: false });
    }
  };

  const handleRetrySync = async () => {
    setSyncing(true);
    try {
      const { ok, data, error } = await adminFetch('/api/admin/sync/run', { method: 'POST' });
      if (ok) {
        setSuccessMsg(`Outbox sync complete: ${data?.processed || 0} processed (${data?.succeeded || 0} succeeded, ${data?.failed || 0} failed).`);
        await fetchAdminPosts({ filter: pubListFilter, append: false });
      } else {
        setErrorMsg(error || 'Failed to trigger outbox sync.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const nonArchivedPosts = posts.filter(p => p && p.id && p.status !== 'archived');
  const allCount = serverCounts ? serverCounts.all : nonArchivedPosts.length;
  const publishedCount = serverCounts ? serverCounts.published : nonArchivedPosts.filter(p => p.status === 'published').length;
  const draftsCount = serverCounts ? serverCounts.drafts : nonArchivedPosts.filter(p => p.status === 'draft').length;

  const filteredPosts = nonArchivedPosts.filter(post => {
    if (pubListFilter === 'published') return post.status === 'published';
    if (pubListFilter === 'drafts') return post.status === 'draft';
    return true;
  });

  return (
    <div className="w-full min-h-screen bg-[#f6dfdf] dark:bg-[#1f1717] font-sans" id="current-publications-view">

        {/* Unified Integrated Sub-Tier (Seamlessly fused with main AdminNavbar as ONE single navbar with zero dividing line) */}
        <div className="sticky top-[99px] sm:top-[103px] z-30 bg-[#fbf1e5] dark:bg-[#251e18] -mt-[1px] border-b border-[#ebd7c1] dark:border-[#3d3228] shadow-xs">
          <div className="max-w-5xl mx-auto px-1.5 xs:px-2 sm:px-6 lg:px-8 py-1.5 sm:py-2">
            <div className="flex flex-row items-center justify-center gap-1 xs:gap-1.5 sm:gap-2 md:gap-2.5 w-full flex-nowrap overflow-x-auto no-scrollbar">
              <div 
                className="flex items-center justify-center gap-1 xs:gap-1.5 sm:gap-2 w-auto shrink-0"
                id="publications-filter-tabs"
              >
                {(['all', 'published', 'drafts'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPubListFilter(mode)}
                    className={`inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2 xs:px-2.5 sm:px-4 py-1 sm:py-2 rounded-full text-[11px] xs:text-[11.5px] sm:text-xs font-semibold tracking-normal transition-all cursor-pointer whitespace-nowrap shadow-2xs active:scale-[0.98] border ${
                      pubListFilter === mode
                        ? mode === 'published'
                          ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                          : mode === 'drafts'
                          ? 'bg-indigo-700 text-white border-indigo-800 shadow-xs'
                          : 'bg-[#2b2621] text-white border-[#1b1714] shadow-xs'
                        : mode === 'published'
                        ? 'bg-emerald-50/90 hover:bg-emerald-100 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                        : mode === 'drafts'
                        ? 'bg-indigo-50/90 hover:bg-indigo-100 text-indigo-800 border-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60'
                        : 'bg-[#f5ece3] hover:bg-[#ebdcd0] text-[#3d332a] border-[#e2d4c7] dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <span>
                      {mode === 'all' && 'All'}
                      {mode === 'published' && 'Published'}
                      {mode === 'drafts' && 'Drafts'}
                    </span>
                    <span className={`rounded-full px-1.5 py-0.2 sm:px-2 sm:py-0.5 text-[9.5px] xs:text-[10px] sm:text-[11px] font-mono font-bold ${
                      pubListFilter === mode
                        ? 'bg-white/20 text-white'
                        : mode === 'published'
                        ? 'bg-emerald-100/90 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                        : mode === 'drafts'
                        ? 'bg-indigo-100/90 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200'
                        : 'bg-[#ebdcd0] text-[#3d332a] dark:bg-slate-700 dark:text-slate-200'
                    }`}>
                      ({mode === 'all' ? allCount : mode === 'published' ? publishedCount : draftsCount})
                    </span>
                  </button>
                ))}
              </div>

              {/* Retry sync button */}
              <div className="flex items-center justify-center shrink-0">
                <button
                  type="button"
                  onClick={handleRetrySync}
                  disabled={syncing}
                  className="inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2 xs:px-2.5 sm:px-4 py-1 sm:py-2 rounded-full text-[11px] xs:text-[11.5px] sm:text-xs font-semibold border border-amber-300/90 dark:border-amber-700/80 bg-amber-50/90 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-950/70 text-amber-900 dark:text-amber-200 transition-all shadow-2xs cursor-pointer disabled:opacity-50 active:scale-[0.98] whitespace-nowrap"
                  title="Process pending outbox articles to Cloudflare D1"
                >
                  <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-700 dark:text-amber-300 ${syncing ? 'animate-spin' : ''}`} />
                  <span>{syncing ? 'Syncing...' : 'Retry sync'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Notifications */}
          {warningMsg && (
            <div 
              role="alert"
              className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-500 text-amber-800 dark:text-amber-200 rounded-lg flex items-center justify-between shadow-xs transition-all duration-300 animate-in fade-in"
            >
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium">{warningMsg}</span>
              </div>
              <button 
                type="button"
                onClick={() => setWarningMsg(null)} 
                className="text-amber-600 hover:text-amber-800 dark:text-amber-400 p-1 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded transition-colors cursor-pointer"
                title="Dismiss warning"
                aria-label="Dismiss warning"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {successMsg && (
            <div 
              role="status"
              className="mb-6 p-4 bg-green-50 dark:bg-green-950/40 border-l-4 border-green-500 text-green-800 dark:text-green-200 rounded-lg flex items-center justify-between shadow-xs transition-all duration-300 animate-in fade-in"
            >
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium">{successMsg}</span>
              </div>
              <button 
                type="button"
                onClick={() => setSuccessMsg(null)} 
                className="text-green-600 hover:text-green-800 dark:text-green-400 p-1 hover:bg-green-100 dark:hover:bg-green-900/40 rounded transition-colors cursor-pointer"
                title="Dismiss message"
                aria-label="Dismiss message"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {errorMsg && (
            <div 
              role="alert"
              className="mb-6 p-4 bg-red-50 dark:bg-red-950/40 border-l-4 border-red-500 text-red-800 dark:text-red-200 rounded-lg flex items-center justify-between shadow-xs transition-all duration-300 animate-in fade-in"
            >
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium">{errorMsg}</span>
              </div>
              <button 
                type="button"
                onClick={() => setErrorMsg(null)} 
                className="text-red-600 hover:text-red-800 dark:text-red-400 p-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded transition-colors cursor-pointer"
                title="Dismiss error"
                aria-label="Dismiss error"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Publications List */}
          {feedLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 dark:border-white mb-3" />
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">Loading publications ledger...</span>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="p-12 text-center bg-white/70 dark:bg-slate-900/60 backdrop-blur-xs rounded-2xl border-2 border-dashed border-rose-200/90 dark:border-slate-800">
              <Newspaper className="h-12 w-12 text-slate-400 mx-auto mb-3 opacity-60" />
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                No publications found
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 max-w-sm mx-auto">
                {pubListFilter === 'drafts' 
                  ? 'You currently have no draft manuscripts saved.' 
                  : pubListFilter === 'published'
                  ? 'No published stories found under your editorial byline.'
                  : 'Start reporting by composing your first publication draft.'}
              </p>
              <Link
                to="/admin/draft"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create New Story</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPosts.map((post) => (
                <div
                  key={post.id}
                  className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {/* Thumbnail */}
                    {post.imageUrl ? (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200/60 dark:border-slate-700">
                        <img 
                          src={cleanImageUrl(post.imageUrl)} 
                          alt={post.title} 
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover" 
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center text-slate-400 border border-slate-200/60 dark:border-slate-700">
                        <Newspaper className="w-6 h-6 opacity-40" />
                      </div>
                    )}

                    {/* Metadata & Headline */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {post.status === 'published' ? (
                          post.syncError ? (
                            <span 
                              title={post.syncError}
                              className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 cursor-help"
                            >
                              Sync failed
                            </span>
                          ) : post.syncPending ? (
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                              Sync pending
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                              Live
                            </span>
                          )
                        ) : post.status === 'archived' ? (
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300">
                            Archived
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                            Draft
                          </span>
                        )}
                        <span className="text-[10px] font-mono font-semibold text-indigo-600 dark:text-indigo-400 uppercase">
                          {post.category || 'General'}
                        </span>
                        <span className="text-[10px] text-slate-400">•</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          {safeFormatDate(post.publishedAt || post.createdAt)}
                        </span>
                      </div>

                      <h3 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-snug line-clamp-2">
                        {post.title}
                      </h3>

                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                        By {post.authorName || 'Current News'}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {post.status === 'published' && !post.syncPending && !post.syncError && (
                      <a
                        href={getCanonicalPostUrl(post.id, post.title)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="Open in Reader Site (currentnews.blog)"
                        aria-label={`Open "${post.title}" on reader site`}
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </a>
                    )}

                    {post.status === 'published' && post.syncPending && !post.syncError && (
                      <span
                        className="p-2 text-slate-400 dark:text-slate-500 cursor-not-allowed inline-flex items-center justify-center opacity-75"
                        title="Syncing to reader..."
                        aria-label="Syncing to reader..."
                      >
                        <RefreshCw className="w-4 h-4 animate-spin text-slate-400 dark:text-slate-500" />
                      </span>
                    )}

                    {post.status === 'published' && Boolean(post.syncError) && (
                      <span
                        className="p-2 text-amber-500 dark:text-amber-400 cursor-help inline-flex items-center justify-center"
                        title="Sync failed - open the article and save again"
                        aria-label="Sync failed - open the article and save again"
                      >
                        <AlertCircle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                      </span>
                    )}

                    <Link
                      to={`/admin/draft?id=${post.id}`}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(post.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                      title="Delete Publication"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Lazy-loading scroll sentinel & manual fallback trigger */}
              {hasMore && (
                <div ref={loadMoreRef} className="pt-2 pb-4 flex flex-col items-center justify-center">
                  <button
                    type="button"
                    onClick={() => nextCursor && fetchAdminPosts({ filter: pubListFilter, cursor: nextCursor, append: true })}
                    disabled={loadingMore}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold bg-white/90 hover:bg-white dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700 shadow-2xs transition-all cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingMore ? 'animate-spin' : ''}`} />
                    <span>{loadingMore ? 'Loading more articles...' : 'Load more articles'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {deleteConfirmId && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center">
              <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-base text-slate-900 dark:text-white mb-2">
                Permanently Delete Publication?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                This action is irreversible. The article will be immediately removed from Cloudflare R2 Edge CDN, Firestore, and search feeds.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeletePost(deleteConfirmId)}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}
