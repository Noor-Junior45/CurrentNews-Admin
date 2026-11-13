import React, { useState, useEffect, useRef } from 'react';
import { useAuthState } from '../hooks/useAuthState';
import { Post } from '../types';
import { sanitizePostImages } from '../utils/imageUrl';
import { getCompressedStories } from '../utils/compressedStorage';
import { api } from '../utils/api';
import { adminFetch } from '../utils/adminFetch';
import { updateDocumentSEO } from '../utils/seo';
import { 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  X, 
  Edit3, 
  Mail, 
  TrendingUp, 
  Clock, 
  Share2,
  Image as ImageIcon
} from 'lucide-react';

export default function AdminDashboardView(): React.JSX.Element {
  const { user, isAdmin } = useAuthState();

  const [posts, setPosts] = useState<Post[]>([]);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto-dismiss success notification after 4.5 seconds
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Editorial Author Pen Name state
  const [globalPenName, setGlobalPenName] = useState<string>(() => {
    return localStorage.getItem('current_news_pen_name_global') || '';
  });
  const [tempPenName, setTempPenName] = useState<string>(() => {
    return localStorage.getItem('current_news_pen_name_global') || '';
  });
  const [isEditingPenName, setIsEditingPenName] = useState<boolean>(false);
  const [isSavingPenName, setIsSavingPenName] = useState<boolean>(false);

  useEffect(() => {
    updateDocumentSEO({
      title: 'Admin Dashboard — Current News Live',
      description: 'Current News Live autonomous publishing desk and story manager.',
      canonicalPath: '/admin',
      robots: 'noindex, nofollow'
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const loadData = async () => {
    if (!user) return;
    try {
      // 0. Verify admin/writer credentials with server
      try {
        const { ok, error: meErr } = await adminFetch('/api/admin/me');
        if (!ok && meErr) {
          setErrorMsg(meErr);
        }
      } catch (meError: any) {
        console.debug('Admin me verify notice:', meError);
      }

      // 1. Fetch user pen name (Neon staff.pen_name is source of truth; server wins over localStorage)
      try {
        const serverPenName = await api.getUserPenName();
        const resolvedPenName = serverPenName ? serverPenName.trim() : '';
        setGlobalPenName(resolvedPenName);
        setTempPenName(resolvedPenName);
        try {
          if (resolvedPenName) {
            localStorage.setItem(`current_news_pen_name_${user.uid}`, resolvedPenName);
            localStorage.setItem('current_news_pen_name_global', resolvedPenName);
          } else {
            localStorage.removeItem(`current_news_pen_name_${user.uid}`);
            localStorage.removeItem('current_news_pen_name_global');
          }
        } catch (_) {}
      } catch (err: any) {
        console.debug('Could not load pen name from server, checking local cache:', err);
        try {
          const cached = localStorage.getItem(`current_news_pen_name_${user.uid}`) || localStorage.getItem('current_news_pen_name_global') || '';
          setGlobalPenName(cached);
          setTempPenName(cached);
        } catch (_) {}
      }

      // 2. Fetch audience subscribers
      try {
        const fetchedSubs = await api.getSubscribersAdmin();
        setSubscribers(fetchedSubs.map(s => ({ id: s.email, email: s.email, createdAt: s.created_at })));
      } catch (subErr: any) {
        console.debug('Could not load subscribers from Worker D1:', subErr);
      }

      // 3. Fetch posts from Light Feed & Local Disk / R2 Mirror
      let fetched: Post[] = [];
      try {
        const feedRes = await fetch('/api/articles/feed');
        if (feedRes.ok) {
          const feedData = await feedRes.json();
          if (Array.isArray(feedData.articles)) {
            fetched = feedData.articles.map(sanitizePostImages);
          }
        }
        if (fetched.length === 0) {
          const postsRes = await fetch('/api/posts?limit=100');
          if (postsRes.ok) {
            const data = await postsRes.json();
            if (Array.isArray(data.posts)) {
              fetched = data.posts.map(sanitizePostImages);
            }
          }
        }
      } catch (postErr: any) {
        console.debug('Posts query notice, checking local cache:', postErr);
        const compressed = getCompressedStories();
        if (compressed && compressed.length > 0) {
          fetched = compressed.map(sanitizePostImages);
        }
      }

      setPosts(fetched);
    } catch (err: any) {
      console.warn('Dashboard load notice:', err);
      const compressed = getCompressedStories();
      if (compressed && compressed.length > 0) {
        setPosts(compressed.map(sanitizePostImages));
      }
    }
  };

  useEffect(() => {
    if (user && isAdmin) {
      loadData();
    }
  }, [user, isAdmin]);

  const handleSavePenName = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSavingPenName) return;
    if (!tempPenName.trim()) {
      setErrorMsg('Pen name cannot be empty.');
      return;
    }
    if (!user) return;

    const trimmed = tempPenName.trim();
    if (trimmed.length > 100) {
      setErrorMsg('Pen name cannot exceed 100 characters.');
      return;
    }

    setIsSavingPenName(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const saved = await api.setUserPenName(trimmed);
      if (!saved) {
        throw new Error('Failed to save pen name to database.');
      }
      setGlobalPenName(trimmed);
      setTempPenName(trimmed);
      try {
        localStorage.setItem(`current_news_pen_name_${user.uid}`, trimmed);
        localStorage.setItem('current_news_pen_name_global', trimmed);
      } catch (_) {}
      setIsEditingPenName(false);
      setSuccessMsg('Author byline pen name saved successfully.');
    } catch (err: any) {
      console.error('Failed to save pen name:', err);
      setSuccessMsg(null);
      setErrorMsg(err?.message || 'Failed to save pen name to database.');
    } finally {
      setIsSavingPenName(false);
    }
  };

  // Helper to count photos in an article (imageUrl, imageUrls, and inline <img> tags)
  const countPostPhotos = (p: Post): number => {
    let count = 0;
    const seen = new Set<string>();

    if (p.imageUrl && p.imageUrl.trim() && p.imageUrl.trim().startsWith('http')) {
      seen.add(p.imageUrl.trim());
      count++;
    }

    if (Array.isArray(p.imageUrls)) {
      for (const url of p.imageUrls) {
        if (url && url.trim() && url.trim().startsWith('http') && !seen.has(url.trim())) {
          seen.add(url.trim());
          count++;
        }
      }
    }

    if (p.content && typeof p.content === 'string') {
      const imgMatches = p.content.match(/<img[^>]+src=["']([^"']+)["']/gi);
      if (imgMatches) {
        for (const match of imgMatches) {
          const srcMatch = match.match(/src=["']([^"']+)["']/i);
          if (srcMatch && srcMatch[1]) {
            const src = srcMatch[1].trim();
            if (src && !seen.has(src)) {
              seen.add(src);
              count++;
            }
          }
        }
      }
    }

    return count;
  };

  // Check if a post is visible: all published data visible to admin like his post, and author-filtered for writers
  const isPostVisible = (p: Post): boolean => {
    if (!user) return false;
    // All published data must be visible to admin like his post
    if (isAdmin) return true;

    // Non-admin writers see their own dispatches
    if (p.authorEmail && user.email) {
      if (p.authorEmail.trim().toLowerCase() === user.email.trim().toLowerCase()) {
        return true;
      }
    }

    if (p.authorId && user.uid) {
      if (p.authorId.trim() === user.uid.trim()) {
        return true;
      }
    }

    const userPen = (globalPenName || '').trim().toLowerCase();
    const userDisplay = (user.displayName || '').trim().toLowerCase();
    if (p.authorName && !p.authorEmail) {
      const postAuthor = p.authorName.trim().toLowerCase();
      if (userPen && postAuthor === userPen) return true;
      if (userDisplay && postAuthor === userDisplay) return true;
    }

    return false;
  };

  // Compute author/admin metrics
  const visiblePosts = posts.filter(isPostVisible);
  const userPublishedPosts = visiblePosts.filter(p => p.status === 'published' || !p.status);
  const userDraftPosts = visiblePosts.filter(p => p.status === 'draft');
  const userMediaPosts = visiblePosts.filter(p => (!!p.youtubeUrl && p.youtubeUrl.trim() !== '') || (!!p.facebookUrl && p.facebookUrl.trim() !== ''));
  const userPublishedPhotosCount = userPublishedPosts.reduce((acc, p) => acc + countPostPhotos(p), 0);

  const activePenName = globalPenName || user?.displayName || 'Current News';

  return (
    <div className="w-full bg-white dark:bg-slate-950 font-sans" id="admin-dashboard-view">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
          {/* Notifications */}
          {successMsg && (
            <div className="p-4 bg-green-50 dark:bg-green-950/40 border-l-4 border-green-500 text-green-800 dark:text-green-200 rounded-xl flex items-center justify-between shadow-xs">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
                <span className="text-xs sm:text-sm font-medium">{successMsg}</span>
              </div>
              <button 
                onClick={() => setSuccessMsg(null)} 
                className="text-green-600 hover:text-green-800 dark:text-green-400 p-1 cursor-pointer"
                title="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 bg-red-50 dark:bg-red-950/40 border-l-4 border-red-500 text-red-800 dark:text-red-200 rounded-xl flex items-center justify-between shadow-xs">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
                <span className="text-xs sm:text-sm font-medium">{errorMsg}</span>
              </div>
              <button 
                onClick={() => setErrorMsg(null)} 
                className="text-red-600 hover:text-red-800 dark:text-red-400 p-1 cursor-pointer"
                title="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* 1. Editorial Author Byline Box */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs" id="editorial-author-byline-box">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold font-mono uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block mb-1.5">
                  Editorial Author Byline
                </span>

                <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                  <span>Active pen name :</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400 underline decoration-indigo-300 dark:decoration-indigo-700 underline-offset-4">
                    {activePenName}
                  </span>
                </h4>
              </div>

              {!isEditingPenName && (
                <div className="w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setTempPenName(activePenName);
                      setIsEditingPenName(true);
                    }}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-full border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 font-bold text-xs uppercase tracking-wider hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all cursor-pointer flex sm:inline-flex items-center justify-center gap-2 shadow-xs box-border"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Pen Name</span>
                  </button>
                </div>
              )}
            </div>

            {/* When editing: input & save/cancel buttons */}
            {isEditingPenName && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <form onSubmit={handleSavePenName} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 max-w-lg">
                  <input
                    type="text"
                    value={tempPenName}
                    onChange={(e) => setTempPenName(e.target.value)}
                    placeholder="Enter author pen name"
                    maxLength={60}
                    className="flex-1 px-4 py-2 border border-indigo-300 dark:border-indigo-700 rounded-full text-xs font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={isSavingPenName}
                      className="flex-1 sm:flex-none px-5 py-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider transition-all disabled:bg-indigo-400 cursor-pointer shadow-xs inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      {isSavingPenName ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Save Pen Name</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingPenName(false);
                        setTempPenName(activePenName);
                      }}
                      className="px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* 2. Platform Metrics (Author-Isolated User Data) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4" id="platform-metrics-grid">
            {/* Live Active Dispatches */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold font-mono text-slate-400 dark:text-slate-500 tracking-wider block">
                  Live Active Dispatches
                </span>
                <span className="text-2xl font-display font-black text-slate-900 dark:text-white mt-1 block">
                  {userPublishedPosts.length}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 block">
                  Broadcasting in feed
                </span>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>

            {/* Draft Manuscripts */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold font-mono text-slate-400 dark:text-slate-500 tracking-wider block">
                  Draft Manuscripts
                </span>
                <span className="text-2xl font-display font-black text-slate-900 dark:text-white mt-1 block">
                  {userDraftPosts.length}
                </span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-1 block">
                  Saved in work queue
                </span>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-lg border border-amber-100 dark:border-amber-900/50 text-amber-600 dark:text-amber-400">
                <Clock className="h-5 w-5 animate-pulse" />
              </div>
            </div>

            {/* Media Broadcasts */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold font-mono text-slate-400 dark:text-slate-500 tracking-wider block">
                  Media Broadcasts
                </span>
                <span className="text-2xl font-display font-black text-slate-900 dark:text-white mt-1 block">
                  {userMediaPosts.length}
                </span>
                <span className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold mt-1 block">
                  Natively embed feeds
                </span>
              </div>
              <div className="bg-sky-50 dark:bg-sky-950/40 p-2.5 rounded-lg border border-sky-100 dark:border-sky-900/50 text-sky-600 dark:text-sky-400">
                <Share2 className="h-5 w-5" />
              </div>
            </div>

            {/* Audience Subscribers */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold font-mono text-indigo-500 dark:text-indigo-400 tracking-wider block">
                  Audience Subscribers
                </span>
                <span className="text-2xl font-display font-black text-slate-900 dark:text-white mt-1 block">
                  {subscribers.length}
                </span>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1 block">
                  Registered citizen readers
                </span>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-950/40 p-2.5 rounded-lg border border-indigo-100/60 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400">
                <Mail className="h-5 w-5" />
              </div>
            </div>

            {/* Published Image (New Box: only shows photos posted by this user) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold font-mono text-purple-600 dark:text-purple-400 tracking-wider block">
                  Published Image
                </span>
                <span className="text-2xl font-display font-black text-slate-900 dark:text-white mt-1 block">
                  {userPublishedPhotosCount}
                </span>
                <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold mt-1 block">
                  Photos posted by author
                </span>
              </div>
              <div className="bg-purple-50 dark:bg-purple-950/40 p-2.5 rounded-lg border border-purple-100/60 dark:border-purple-900/50 text-purple-600 dark:text-purple-400">
                <ImageIcon className="h-5 w-5" />
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}
