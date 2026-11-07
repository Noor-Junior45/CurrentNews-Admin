import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthState } from '../hooks/useAuthState';
import { Post, slugify } from '../types';
import { cleanImageUrl, sanitizePostImages } from '../utils/imageUrl';
import { getCompressedStories, removeCompressedStory, getDeletedStoryIds } from '../utils/compressedStorage';
import { adminFetch } from '../utils/adminFetch';
import { safeFormatDate } from '../utils/dateHelper';
import { updateDocumentSEO } from '../utils/seo';
import { 
  PlusCircle, 
  Edit3, 
  Trash2, 
  ArrowUpRight, 
  CheckCircle, 
  AlertCircle, 
  X, 
  Clock, 
  Newspaper,
  RefreshCw
} from 'lucide-react';

export default function CurrentPublicationsView(): React.JSX.Element {
  const { user, isAdmin } = useAuthState();
  const navigate = useNavigate();
  const location = useLocation();

  const [posts, setPosts] = useState<Post[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pubListFilter, setPubListFilter] = useState<'all' | 'published' | 'drafts'>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>((location.state as any)?.warning || null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    updateDocumentSEO({
      title: 'Current Publications — Current News Live',
      description: 'Manage and review published dispatches and draft manuscripts.',
      canonicalPath: '/admin/publications',
      robots: 'noindex, nofollow'
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const fetchAdminPosts = async () => {
    if (!user) return;
    setFeedLoading(true);
    try {
      const deletedIds = getDeletedStoryIds();
      const postMap = new Map<string, Post>();

      // 1. Fetch from editorial source of truth (/api/admin/articles)
      try {
        const { ok, data: adminData, error: adminFetchErr } = await adminFetch(`/api/admin/articles?limit=50&t=${Date.now()}`);
        if (ok && Array.isArray(adminData?.articles)) {
          for (const p of adminData.articles) {
            if (p && p.id && !deletedIds.has(p.id)) {
              postMap.set(p.id, sanitizePostImages(p));
            }
          }
        } else if (!ok && adminFetchErr) {
          setErrorMsg(adminFetchErr);
        }
      } catch (adminErr) {
        console.debug('Admin articles fetch notice:', adminErr);
      }

      // 2. Fallback to public feed if Neon is empty or during migration
      if (postMap.size === 0) {
        try {
          const feedRes = await fetch(`/api/articles/feed?t=${Date.now()}`, { cache: 'no-store' });
          if (feedRes.ok) {
            const feedData = await feedRes.json();
            if (Array.isArray(feedData.articles)) {
              for (const p of feedData.articles) {
                if (p && p.id && !deletedIds.has(p.id)) {
                  postMap.set(p.id, sanitizePostImages(p));
                }
              }
            }
          }
        } catch (feedErr) {
          console.debug('Feed fetch notice:', feedErr);
        }
      }

      // 3. Merge locally compressed stories (guarantees 0ms visibility after publishing)
      try {
        const compressed = getCompressedStories();
        if (compressed && compressed.length > 0) {
          for (const p of compressed) {
            if (p && p.id && !deletedIds.has(p.id)) {
              if (!postMap.has(p.id)) {
                postMap.set(p.id, sanitizePostImages(p));
              }
            }
          }
        }
      } catch (compErr) {
        console.debug('Compressed cache read notice:', compErr);
      }

      const allFetched = Array.from(postMap.values()).sort((a, b) => {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });

      const visiblePosts = allFetched.filter(p => {
        if (!p || !p.id || deletedIds.has(p.id)) return false;

        // All published data and drafts must be visible to admin
        if (isAdmin) return true;

        // Non-admin writers see their own dispatches
        if (p.authorEmail && user.email) {
          return p.authorEmail.toLowerCase() === user.email.toLowerCase();
        }
        if (p.authorId && user.uid) {
          return p.authorId === user.uid;
        }
        const penName = (localStorage.getItem(`current_news_pen_name_${user.uid}`) || '').toLowerCase();
        if (p.authorName && penName && p.authorName.toLowerCase() === penName) {
          return true;
        }
        return false;
      });
      setPosts(visiblePosts);
    } catch (err) {
      console.warn('Publications fetch warning:', err);
    } finally {
      setFeedLoading(false);
    }
  };

  useEffect(() => {
    if (user && isAdmin) {
      fetchAdminPosts();
    }
    const handleStoriesUpdated = () => {
      fetchAdminPosts();
    };
    window.addEventListener('stories-updated', handleStoriesUpdated);
    return () => {
      window.removeEventListener('stories-updated', handleStoriesUpdated);
    };
  }, [user, isAdmin]);

  const handleDeletePost = async (id: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      // 1. Immediately remove from local compressed memory and mark tombstone
      removeCompressedStory(id);

      // 2. Remove from backend server and editorial repository with Bearer token
      const { ok, error: deleteErr } = await adminFetch(`/api/admin/articles/${id}`, {
        method: 'DELETE'
      });

      if (!ok) {
        throw new Error(deleteErr || 'Failed to delete post');
      }

      // 3. Update view state
      setPosts(prev => prev.filter(p => p.id !== id));
      setSuccessMsg('Story deleted successfully from storage repository.');
      setDeleteConfirmId(null);

      // 4. Notify all tabs and home view to remove immediately
      window.dispatchEvent(new CustomEvent('stories-updated', { detail: { deletedId: id } }));
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to delete story. Permissions check required.');
    }
  };

  const handleRetrySync = async () => {
    setSyncing(true);
    try {
      const { ok, data, error } = await adminFetch('/api/admin/sync/run', { method: 'POST' });
      if (ok) {
        setSuccessMsg(`Outbox sync complete: ${data?.processed || 0} processed (${data?.succeeded || 0} succeeded, ${data?.failed || 0} failed).`);
        await fetchAdminPosts();
      } else {
        setErrorMsg(error || 'Failed to trigger outbox sync.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const filteredPosts = posts.filter(post => {
    if (pubListFilter === 'published') return post.status === 'published';
    if (pubListFilter === 'drafts') return post.status === 'draft';
    return true;
  });

  return (
    <div className="w-full bg-white dark:bg-slate-950 font-sans" id="current-publications-view">

        {/* Persistent Sticky Filter Bar (Anchored flush beneath AdminNavbar) */}
        <div className="sticky top-[104px] sm:top-[112px] z-30 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800/90 shadow-2xs">
          <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div 
                className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl w-full sm:w-auto sm:flex sm:items-center shadow-inner"
                id="publications-filter-tabs"
              >
                {(['all', 'published', 'drafts'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPubListFilter(mode)}
                    className={`px-1.5 sm:px-4 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-tight sm:tracking-wider transition-all cursor-pointer text-center truncate whitespace-nowrap ${
                      pubListFilter === mode
                        ? 'bg-slate-950 dark:bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {mode === 'all' && `All (${posts.length})`}
                    {mode === 'published' && `Published (${posts.filter(p => p.status === 'published').length})`}
                    {mode === 'drafts' && `Drafts (${posts.filter(p => p.status === 'draft').length})`}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400 font-sans">
                  Manage, edit, or delete your publications and drafts.
                </p>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleRetrySync}
                    disabled={syncing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                    title="Process pending outbox articles to Cloudflare D1"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                    <span>{syncing ? 'Syncing...' : 'Retry sync'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Notifications */}
          {warningMsg && (
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-500 text-amber-800 dark:text-amber-200 rounded-lg flex items-center justify-between shadow-xs">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium">{warningMsg}</span>
              </div>
              <button onClick={() => setWarningMsg(null)} className="text-amber-600 hover:text-amber-800 dark:text-amber-400 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {successMsg && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-950/40 border-l-4 border-green-500 text-green-800 dark:text-green-200 rounded-lg flex items-center justify-between shadow-xs">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium">{successMsg}</span>
              </div>
              <button onClick={() => setSuccessMsg(null)} className="text-green-600 hover:text-green-800 dark:text-green-400">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/40 border-l-4 border-red-500 text-red-800 dark:text-red-200 rounded-lg flex items-center justify-between shadow-xs">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium">{errorMsg}</span>
              </div>
              <button onClick={() => setErrorMsg(null)} className="text-red-600 hover:text-red-800 dark:text-red-400">
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
            <div className="p-12 text-center bg-slate-50/60 dark:bg-slate-900/40 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
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
                          {safeFormatDate(post.createdAt)}
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
                    {post.status === 'published' && (
                      <Link
                        to={`/post/${post.id}/${slugify(post.title)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title="View Live Article"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </Link>
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
