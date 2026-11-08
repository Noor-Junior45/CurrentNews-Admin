import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuthState } from '../hooks/useAuthState';
import { api } from '../utils/api';
import { adminFetch } from '../utils/adminFetch';
import { saveCompressedStory, getCompressedStories, saveCompressedStories } from '../utils/compressedStorage';
import { Post, slugify } from '../types';
import { cleanImageUrl, sanitizePostImages } from '../utils/imageUrl';
import RichTextEditor, { RichTextEditorHandle } from '../components/RichTextEditor';
import PhotoAttachmentSection from '../components/PhotoAttachmentSection';
import { getCanonicalPostUrl } from '../utils/shareUrl';
import { getAvailableWriters } from '../utils/writers';
import { updateDocumentSEO } from '../utils/seo';
import { 
  CheckCircle, 
  AlertCircle, 
  X, 
  Trash2, 
  Clock, 
  Send, 
  PlusCircle, 
  Youtube, 
  Facebook, 
  Share2, 
  ArrowUpRight,
  Link2,
  Sparkles,
  TrendingUp,
  Tag,
  Calendar
} from 'lucide-react';

const getTodayDateString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (isNaN(dateObj.getTime())) return dateStr;
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

const CATEGORY_SUGGESTED_TAGS: Record<string, string[]> = {
  Jharkhand: ['Jharkhand', 'Ranchi', 'Dhanbad', 'Jamshedpur', 'Bokaro', 'JharkhandNews', 'HemantSoren', 'Deoghar'],
  Politics: ['Politics', 'Governance', 'Elections', 'Policy', 'Parliament', 'NationalNews', 'LokSabha'],
  Tech: ['Technology', 'AI', 'Innovation', 'CyberSecurity', 'Science', 'Startups', 'Gadgets'],
  Sports: ['Sports', 'Cricket', 'IPL', 'Football', 'Olympics', 'Championship', 'TeamIndia'],
  Business: ['Business', 'Economy', 'Markets', 'Finance', 'Sensex', 'RBI', 'Corporate'],
  Health: ['Health', 'Wellness', 'Medicine', 'PublicHealth', 'Healthcare', 'Research'],
  World: ['WorldNews', 'GlobalAffairs', 'Geopolitics', 'International', 'Diplomacy', 'UnitedNations'],
  Opinion: ['Editorial', 'Opinion', 'Analysis', 'Investigation', 'Perspective', 'DeepDive'],
  General: ['CurrentNews', 'BreakingNews', 'TopStories', 'LiveUpdates', 'Viral', 'Headline']
};

const POPULAR_TAGS = [
  'BreakingNews',
  'LiveUpdates',
  'CurrentNews',
  'TopStories',
  'India',
  'Exclusive',
  'FactCheck',
  'Ranchi',
  'SpecialReport'
];

export default function DraftPublicationView(): React.JSX.Element {
  const { user, isAdmin } = useAuthState();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editingId = searchParams.get('id');

  const [isEditing, setIsEditing] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [loadedVersion, setLoadedVersion] = useState<number>(1);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [customLinks, setCustomLinks] = useState<string[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState('');

  const availableWriters = getAvailableWriters();
  const [selectedWriter, setSelectedWriter] = useState<string>(availableWriters[0] || 'Current News');
  const [authorName, setAuthorName] = useState(user?.displayName || availableWriters[0] || 'Current News');
  const [category, setCategory] = useState('General');
  const [targetStatus, setTargetStatus] = useState<'published' | 'draft'>('published');
  const [sendEmailAlert, setSendEmailAlert] = useState(true);
  const [publishDate, setPublishDate] = useState<string>(getTodayDateString());
  const [isCustomDate, setIsCustomDate] = useState<boolean>(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Images state — all photos default to end of story
  const [imageUrl, setImageUrl] = useState('');
  const [imageUrlFallback, setImageUrlFallback] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageUrlsFallback, setImageUrlsFallback] = useState<string[]>([]);
  const [imagePosition, setImagePosition] = useState<'top' | 'middle' | 'bottom'>('bottom');
  const [galleryPositions, setGalleryPositions] = useState<('gallery' | 'top' | 'middle' | 'bottom' | 'inline')[]>([]);

  const editorRef = useRef<RichTextEditorHandle>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [subscribersCount, setSubscribersCount] = useState<number>(0);

  useEffect(() => {
    updateDocumentSEO({
      title: isEditing ? 'Edit Publication — Current News Live' : 'Draft New Publication — Current News Live',
      description: 'Current News Live autonomous article composer and publishing desk.',
      canonicalPath: '/admin/draft',
      robots: 'noindex, nofollow'
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [isEditing]);

  // Load subscriber count for alert notice
  useEffect(() => {
    api.getSubscribersAdmin().then(subs => {
      setSubscribersCount(subs.length);
    }).catch(() => {});
  }, []);

  // If editing an existing article, fetch its record from editorial source of truth
  useEffect(() => {
    if (!editingId) {
      setIsEditing(false);
      setEditingPost(null);
      setLoadedVersion(1);
      return;
    }

    const fetchPostToEdit = async () => {
      try {
        setErrorMsg(null);
        const { ok, status, data, error, code } = await adminFetch(`/api/admin/articles/${encodeURIComponent(editingId)}`);
        if (!ok) {
          console.error('[DraftPublicationView] Failed to load article details:', { status, body: data, error, code });
          let message = 'Failed to load article details.';
          if (status === 404 || code === 'not_found') {
            message = 'Article not found (404)';
          } else if (status === 403 || code === 'forbidden') {
            message = 'You can only edit your own articles (403)';
          } else if (status === 401 || code === 'no_token' || code === 'token_expired' || code === 'token_revoked') {
            message = 'Session expired, please sign in again (401)';
          } else if (error) {
            message = `${error} (${status})`;
          }
          setErrorMsg(message);
          return;
        }

        const rawArticle = data?.article || data?.post || data;
        if (rawArticle) {
          const p = sanitizePostImages(rawArticle as Post);
          setEditingPost(p);
          setIsEditing(true);
          const ver = typeof rawArticle.version === 'number' ? rawArticle.version : 1;
          setLoadedVersion(ver);

          setTitle(p.title || '');
          setContent(p.content || '');
          setCategory(p.category || 'General');
          setYoutubeUrl(p.youtubeUrl || '');
          setFacebookUrl(p.facebookUrl || '');
          setCustomLinks(p.customLinks || []);
          setHashtags(p.hashtags || []);
          setImageUrl(p.imageUrl || '');
          setImageUrlFallback(p.imageUrlFallback || '');
          setImageUrls(p.imageUrls || []);
          setImageUrlsFallback(p.imageUrlsFallback || []);
          setImagePosition(p.imagePosition || 'top');
          setGalleryPositions(p.galleryPositions || []);
          if (p.status === 'draft' || p.status === 'published') {
            setTargetStatus(p.status);
          }

          if (p.authorName) {
            setAuthorName(p.authorName);
            setSelectedWriter(availableWriters.includes(p.authorName) ? p.authorName : 'custom');
          }

          const dateToDisplay = p.publishedAt || p.createdAt;
          if (dateToDisplay) {
            try {
              const parsedDate = new Date(dateToDisplay);
              if (!isNaN(parsedDate.getTime())) {
                const year = parsedDate.getFullYear();
                const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
                const day = String(parsedDate.getDate()).padStart(2, '0');
                const formatted = `${year}-${month}-${day}`;
                setPublishDate(formatted);
                setIsCustomDate(formatted !== getTodayDateString());
              }
            } catch (_) {}
          }
        } else {
          console.error('[DraftPublicationView] Empty article response:', { status, body: data });
          setErrorMsg('Article not found (404)');
        }
      } catch (err: any) {
        console.error('[DraftPublicationView] Failed to load post for editing:', err);
        setErrorMsg('Failed to load article details. Please check your network connection.');
      }
    };

    fetchPostToEdit();
  }, [editingId]);

  const handleResetForm = () => {
    setTitle('');
    setContent('');
    setYoutubeUrl('');
    setFacebookUrl('');
    setCustomLinks([]);
    setHashtags([]);
    setHashtagInput('');
    setImageUrl('');
    setImageUrlFallback('');
    setImageUrls([]);
    setImageUrlsFallback([]);
    setImagePosition('bottom');
    setGalleryPositions([]);
    setIsEditing(false);
    setEditingPost(null);
    setLoadedVersion(1);
    setTargetStatus('published');
    setSelectedWriter(availableWriters[0] || 'Current News');
    setAuthorName(user?.displayName || availableWriters[0] || 'Current News');
    setPublishDate(getTodayDateString());
    setIsCustomDate(false);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Publication headline cannot be blank.');
      return;
    }
    if (!content.trim()) {
      setErrorMsg('Publication manuscript cannot be empty.');
      return;
    }

    setSubmitLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const filteredCustomLinks = customLinks.filter(link => link.trim() !== '');
    const filteredHashtags = hashtags.filter(tag => tag.trim() !== '');
    const cleanPrimaryImg = cleanImageUrl(imageUrl);
    const cleanPrimaryFallback = cleanImageUrl(imageUrlFallback);
    const filteredImageUrls = imageUrls.map(cleanImageUrl).filter(url => url.length > 0);
    const filteredImageUrlsFallback = imageUrlsFallback.map(cleanImageUrl).filter(url => url.length > 0);

    const resolvedAuthor = (isEditing && editingPost?.authorName) 
      ? editingPost.authorName 
      : (authorName.trim() || user?.displayName || availableWriters[0] || 'Current News');

    const resolvedDate = (() => {
      if (publishDate) {
        try {
          const [y, m, d] = publishDate.split('-').map(Number);
          const now = new Date();
          const chosenDate = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
          if (!isNaN(chosenDate.getTime())) {
            return chosenDate.toISOString();
          }
        } catch (_) {}
      }
      return (isEditing && (editingPost?.publishedAt || editingPost?.createdAt))
        ? (editingPost.publishedAt || editingPost.createdAt)
        : new Date().toISOString();
    })();

    const postPayload: any = {
      title: title.trim(),
      content: content,
      youtubeUrl: youtubeUrl.trim(),
      facebookUrl: facebookUrl.trim(),
      customLinks: filteredCustomLinks,
      hashtags: filteredHashtags,
      authorName: resolvedAuthor,
      authorEmail: user?.email || '',
      authorId: user?.uid || '',
      category: category,
      status: targetStatus,
      imageUrl: cleanPrimaryImg,
      imageUrlFallback: cleanPrimaryFallback,
      imageUrls: filteredImageUrls,
      imageUrlsFallback: filteredImageUrlsFallback,
      imagePosition: imagePosition,
      galleryPositions: galleryPositions,
      ...(isAdmin ? { createdAt: resolvedDate, publishedAt: resolvedDate } : {}),
    };

    let publishedPostId = (isEditing && editingId) ? editingId : (`post_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);

    try {
      if (isEditing && editingId && editingPost) {
        postPayload.authorEmail = editingPost.authorEmail || user?.email || '';
        postPayload.authorId = editingPost.authorId || user?.uid || '';
      } else {
        postPayload.authorEmail = user?.email || '';
        postPayload.authorId = user?.uid || '';
      }

      const fullPostToSave: Post = {
        id: publishedPostId,
        ...postPayload,
        status: targetStatus,
        version: isEditing ? (loadedVersion || editingPost?.version || 1) : 1,
        createdAt: isAdmin ? resolvedDate : (editingPost?.createdAt || new Date().toISOString()),
        publishedAt: isAdmin ? resolvedDate : (editingPost?.publishedAt || null),
        updatedAt: new Date().toISOString(),
        likes: editingPost?.likes || 0,
        dislikes: editingPost?.dislikes || 0,
        views: editingPost?.views || 0,
      };

      // 1. Immediately cache in client-side compressed storage for instant offline persistence
      try {
        saveCompressedStory(fullPostToSave);
        const currentFeed = getCompressedStories() || [];
        const existingIdx = currentFeed.findIndex(p => p.id === publishedPostId);
        let updatedFeed: Post[];
        if (existingIdx >= 0) {
          updatedFeed = [...currentFeed];
          updatedFeed[existingIdx] = fullPostToSave;
        } else {
          updatedFeed = [fullPostToSave, ...currentFeed];
        }
        saveCompressedStories(updatedFeed);
      } catch (cacheErr) {
        console.debug('Local storage cache notice:', cacheErr);
      }

      // 2. Save to server repository (Neon Postgres + R2 dual-write) with auto-refreshing Bearer token
      const { ok, status, data: savedData, error: saveErr, code: saveCode } = await adminFetch('/api/admin/articles', {
        method: 'POST',
        body: JSON.stringify(fullPostToSave)
      });

      if (!ok) {
        console.error('[DraftPublicationView] Save article error:', { status, body: savedData, error: saveErr, code: saveCode });
        if (status === 409 || saveCode === 'version_conflict') {
          setErrorMsg('This article was changed elsewhere, please reload');
          return;
        }
        let message = saveErr || 'Failed to save article to storage repository.';
        if (status === 403 || saveCode === 'forbidden') {
          message = 'You can only edit your own articles (403)';
        } else if (status === 401 || saveCode === 'no_token' || saveCode === 'token_expired' || saveCode === 'token_revoked') {
          message = 'Session expired, please sign in again (401)';
        }
        setErrorMsg(message);
        return;
      }

      if (savedData?.article?.version) {
        setLoadedVersion(savedData.article.version);
      }

      if (savedData?.syncWarning) {
        console.warn('Storage sync warning:', savedData.syncWarning);
      }

      let warningText: string | undefined = undefined;
      if (savedData?.synced === false && savedData?.warning) {
        warningText = savedData.warning;
        setSuccessMsg(savedData.warning);
      } else {
        setSuccessMsg(targetStatus === 'draft' ? 'Draft saved successfully!' : (isEditing ? 'Story updated and published successfully!' : 'Story published successfully!'));
      }

      // Dispatch alert to subscribers if checked and published
      if (targetStatus === 'published' && sendEmailAlert) {
        try {
          const subs = await api.getSubscribersAdmin();
          const emails = subs.map(s => s.email).filter(Boolean);

          if (emails.length > 0) {
            const postLink = getCanonicalPostUrl(publishedPostId, title.trim());
            const emailPromises = emails.map(emailAddr => 
              adminFetch('/api/mail/send-alert', {
                method: 'POST',
                body: JSON.stringify({
                  email: emailAddr,
                  title: `Breaking News: ${title.trim()}`,
                  link: postLink
                })
              }).catch(() => {})
            );
            await Promise.all(emailPromises);
          }
        } catch (emailErr) {
          console.warn('Failed to dispatch alerts:', emailErr);
        }
      }

      // Dispatch background push notification if published
      if (targetStatus === 'published') {
        try {
          const cleanSnippet = content.replace(/<[^>]*>/g, ' ').replace(/\[fig\.\s*\d+\]/gi, ' ').replace(/\s+/g, ' ').trim();
          const notifBody = cleanSnippet.length > 120 ? cleanSnippet.substring(0, 117) + '...' : (cleanSnippet || 'A new article has just been published on Current News. Tap to read.');
          const notifTitle = `Breaking News: ${title.trim()}`;
          const safeNotifImage = (imageUrl && imageUrl.startsWith('http')) ? imageUrl : undefined;

          adminFetch('/api/push/broadcast', {
            method: 'POST',
            body: JSON.stringify({
              title: notifTitle,
              body: notifBody,
              url: `/post/${publishedPostId}/${slugify(title.trim())}`,
              postId: publishedPostId,
              image: safeNotifImage,
              icon: 'https://i.imgur.com/gFgShoZ.jpeg'
            })
          }).catch(() => {});
        } catch {}
      }

      // Notify all tabs and home view immediately
      try {
        window.dispatchEvent(new CustomEvent('stories-updated', { detail: { newPost: fullPostToSave } }));
      } catch (_) {}

      handleResetForm();
      navigate('/admin/publications', { state: { warning: warningText } });
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to submit publication.');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="w-full bg-white dark:bg-slate-950 font-sans" id="draft-publication-view">
      <div className="w-full max-w-5xl lg:max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Notifications */}
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

          <div className="py-2" id="story-form-inner-container">
            {isEditing && (
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
                <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800 uppercase tracking-wider">
                  Editing Existing Dispatch
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/admin/publications')}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
                >
                  Back to Publications
                </button>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-6">
              {/* Title input — Full width auto-expanding so writer can see and edit long titles */}
              <div className="w-full">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono" htmlFor="post-title">
                    Title *
                  </label>
                  <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                    {title.length}/200
                  </span>
                </div>
                <textarea
                  id="post-title"
                  rows={2}
                  placeholder="e.g. BREAKING: New Infrastructure Project Approved"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.max(54, e.target.scrollHeight)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                  className="w-full px-4 py-3 sm:py-3.5 border border-slate-300 dark:border-slate-700 rounded-xl text-sm sm:text-base bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block placeholder:text-slate-400 font-semibold shadow-2xs box-border resize-y min-h-[54px] leading-relaxed transition-all"
                  maxLength={200}
                  required
                />
              </div>

              {/* Category selector & Publishing Date — In-line on larger screens/tabs, stacked on phone screens */}
              <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {/* Category selector */}
                <div className="w-full">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 font-mono" htmlFor="post-category">
                    Category *
                  </label>
                  <select
                    id="post-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block font-semibold text-slate-800 dark:text-slate-200 shadow-2xs box-border cursor-pointer transition-colors"
                  >
                    <option value="General">General News</option>
                    <option value="Jharkhand">Jharkhand & Regional News</option>
                    <option value="Politics">Politics & Government</option>
                    <option value="Tech">Technology & Science</option>
                    <option value="Sports">Sports</option>
                    <option value="Opinion">Editorial & Opinion</option>
                    <option value="Business">Business & Finance</option>
                    <option value="Health">Health & Lifestyle</option>
                    <option value="World">World Dispatches</option>
                  </select>
                </div>

                {/* Publishing Date button/box */}
                <div className="w-full">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5" htmlFor="post-publish-date">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Publish Date</span>
                    </label>
                    {isCustomDate && (
                      <button
                        type="button"
                        onClick={() => {
                          setPublishDate(getTodayDateString());
                          setIsCustomDate(false);
                        }}
                        className="text-[11px] font-mono font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        title="Reset back to current date"
                      >
                        Reset to Today
                      </button>
                    )}
                  </div>
                  <div className="relative group">
                    <div
                      id="choose-publish-date-display"
                      className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/60 group-focus-within:ring-2 group-focus-within:ring-indigo-500/20 group-focus-within:border-indigo-500 flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200 shadow-2xs box-border transition-all pointer-events-none"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span className="truncate">
                          {formatDisplayDate(publishDate)}
                          {!isCustomDate && (
                            <span className="ml-2 text-[11px] font-mono font-medium px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                              Today
                            </span>
                          )}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-semibold shrink-0 ml-2">
                        Choose Date
                      </span>
                    </div>
                    <input
                      ref={dateInputRef}
                      id="post-publish-date"
                      type="date"
                      value={publishDate}
                      onChange={(e) => {
                        if (e.target.value) {
                          setPublishDate(e.target.value);
                          setIsCustomDate(e.target.value !== getTodayDateString());
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                      aria-label="Choose publishing date"
                    />
                  </div>
                </div>
              </div>

              {/* Photo Attachment Section — Moved above manuscript section per editorial workflow */}
              <div className="w-full">
                <PhotoAttachmentSection
                  primaryImageUrl={imageUrl}
                  onPrimaryImageUrlChange={setImageUrl}
                  primaryImageUrlFallback={imageUrlFallback}
                  onPrimaryImageUrlFallbackChange={setImageUrlFallback}
                  galleryUrls={imageUrls}
                  onGalleryUrlsChange={setImageUrls}
                  galleryUrlsFallback={imageUrlsFallback}
                  onGalleryUrlsFallbackChange={setImageUrlsFallback}
                  imagePosition={imagePosition}
                  onImagePositionChange={setImagePosition}
                  galleryPositions={galleryPositions}
                  onGalleryPositionsChange={setGalleryPositions}
                  onInsertFigureIntoContent={(figureTag, figNum, url) => {
                    if (url && editorRef.current?.insertPhoto) {
                      editorRef.current.insertPhoto(url);
                    } else if (editorRef.current?.insertFigure) {
                      editorRef.current.insertFigure(figNum || 1);
                    } else if (editorRef.current && figureTag) {
                      editorRef.current.insertText(figureTag);
                    }
                  }}
                />
              </div>

              {/* Rich Text Editor — Manuscript */}
              <div className="w-full">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 font-mono">
                  Manuscript *
                </label>
                <RichTextEditor
                  ref={editorRef}
                  value={content}
                  onChange={setContent}
                  placeholder="Compose your article dispatch..."
                  availablePhotos={[imageUrl, ...imageUrls].filter(Boolean)}
                  availablePhotoCount={[imageUrl, ...imageUrls].filter(Boolean).length}
                />
              </div>

              {/* Media Embeds */}
              <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl box-border">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 font-mono flex items-center gap-1.5">
                    <Youtube className="w-4 h-4 text-red-500" />
                    <span>YouTube Broadcast URL (Optional)</span>
                  </label>
                  <input
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 font-mono flex items-center gap-1.5">
                    <Facebook className="w-4 h-4 text-blue-600" />
                    <span>Facebook Video / Reel URL (Optional)</span>
                  </label>
                  <input
                    type="url"
                    placeholder="https://www.facebook.com/.../videos/..."
                    value={facebookUrl}
                    onChange={(e) => setFacebookUrl(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Reference Link Section */}
              <div className="w-full">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 font-mono flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Reference Link</span>
                </label>
                
                {/* Empty box space / links container */}
                <div className="w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 min-h-[64px] box-border">
                  {customLinks.length === 0 ? (
                    <div className="py-3 text-center text-xs text-slate-400 dark:text-slate-500 font-mono italic">
                      No reference links added yet. Click &quot;Add Hyperlink&quot; below to add links.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {customLinks.map((link, idx) => (
                        <div key={idx} className="flex items-center gap-2.5">
                          <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 w-5 text-right shrink-0">
                            {idx + 1}.
                          </span>
                          <input
                            type="url"
                            placeholder="https://example.com/reference-source"
                            value={link}
                            onChange={(e) => {
                              const copy = [...customLinks];
                              copy[idx] = e.target.value;
                              setCustomLinks(copy);
                            }}
                            className="flex-1 px-3.5 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => setCustomLinks(customLinks.filter((_, i) => i !== idx))}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer shrink-0"
                            title="Delete link"
                            aria-label="Delete link"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Full-width pill shape button matching Discard Draft height ratio and font */}
                <div className="mt-3.5 w-full">
                  <button
                    type="button"
                    onClick={() => setCustomLinks([...customLinks, ''])}
                    className="w-full py-2.5 px-5 border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors flex items-center justify-center gap-2 cursor-pointer box-border"
                  >
                    <PlusCircle className="h-4 w-4 shrink-0" />
                    <span>Add Hyperlink</span>
                  </button>
                </div>
              </div>

              {/* Topic Hashtags with Suggested & Popular Hashtags */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Topic Hashtags</span>
                  </label>
                  {hashtags.length > 0 && (
                    <span className="text-[11px] font-mono text-slate-400">
                      {hashtags.length} tag{hashtags.length > 1 ? 's' : ''} added
                    </span>
                  )}
                </div>

                {/* Active selected hashtags */}
                {hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {hashtags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                      >
                        <span>#{tag.replace(/^#/, '')}</span>
                        <button
                          type="button"
                          onClick={() => setHashtags(hashtags.filter((_, i) => i !== idx))}
                          className="hover:text-rose-500 transition-colors cursor-pointer"
                          title="Remove tag"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Input to type custom tag */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. BreakingNews, Politics, Jharkhand"
                    value={hashtagInput}
                    onChange={(e) => setHashtagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const clean = hashtagInput.trim().replace(/^#/, '');
                        if (clean && !hashtags.some(t => t.toLowerCase() === clean.toLowerCase())) {
                          setHashtags([...hashtags, clean]);
                          setHashtagInput('');
                        }
                      }
                    }}
                    className="flex-1 px-3.5 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const clean = hashtagInput.trim().replace(/^#/, '');
                      if (clean && !hashtags.some(t => t.toLowerCase() === clean.toLowerCase())) {
                        setHashtags([...hashtags, clean]);
                        setHashtagInput('');
                      }
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Add Tag
                  </button>
                </div>

                {/* Suggested Hashtags (Context-aware based on selected Category) */}
                {CATEGORY_SUGGESTED_TAGS[category] && (
                  <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
                    <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-slate-600 dark:text-slate-400 font-mono">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>Suggested for {category}:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {CATEGORY_SUGGESTED_TAGS[category].map((tag) => {
                        const isSelected = hashtags.some(t => t.toLowerCase() === tag.toLowerCase());
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              if (!isSelected) {
                                setHashtags([...hashtags, tag]);
                              } else {
                                setHashtags(hashtags.filter(t => t.toLowerCase() !== tag.toLowerCase()));
                              }
                            }}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600 text-white border border-indigo-600 shadow-2xs'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400'
                            }`}
                          >
                            <span>#{tag}</span>
                            {isSelected ? <CheckCircle className="w-3 h-3" /> : <span className="text-slate-400">+</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Popular Hashtags */}
                <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
                  <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-slate-600 dark:text-slate-400 font-mono">
                    <TrendingUp className="w-3.5 h-3.5 text-rose-500" />
                    <span>Popular Hashtags:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR_TAGS.map((tag) => {
                      const isSelected = hashtags.some(t => t.toLowerCase() === tag.toLowerCase());
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            if (!isSelected) {
                              setHashtags([...hashtags, tag]);
                            } else {
                              setHashtags(hashtags.filter(t => t.toLowerCase() !== tag.toLowerCase()));
                            }
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-rose-600 text-white border border-rose-600 shadow-2xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-rose-400 hover:text-rose-600 dark:hover:text-rose-400'
                          }`}
                        >
                          <span>#{tag}</span>
                          {isSelected ? <CheckCircle className="w-3 h-3" /> : <span className="text-slate-400">+</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Automated Email Alert Toggle */}
              <div className="flex items-center space-x-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60 rounded-xl p-4">
                <input
                  type="checkbox"
                  id="send-email-alert-checkbox"
                  checked={sendEmailAlert}
                  onChange={(e) => setSendEmailAlert(e.target.checked)}
                  className="h-4.5 w-4.5 rounded-md border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="send-email-alert-checkbox" className="text-xs font-semibold text-slate-700 dark:text-slate-300 select-none cursor-pointer flex flex-col">
                  <span>Send Breaking News Email & Push Alert</span>
                  <span className="text-[10px] text-slate-400 font-normal mt-0.5">
                    Notify {subscribersCount} active subscribers and connected mobile devices
                  </span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-5 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    handleResetForm();
                    navigate('/admin/publications');
                  }}
                  className="px-5 py-2.5 border border-red-200 dark:border-red-950 bg-red-50/50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs font-bold rounded-full hover:bg-red-100 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4 shrink-0" />
                  <span>{isEditing ? 'Discard Changes' : 'Discard Draft'}</span>
                </button>

                <button
                  type="submit"
                  disabled={submitLoading}
                  onClick={() => setTargetStatus('draft')}
                  className="px-5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Clock className="h-4 w-4 text-slate-500 font-bold" />
                  <span>Save as Draft</span>
                </button>

                <button
                  type="submit"
                  disabled={submitLoading}
                  onClick={() => setTargetStatus('published')}
                  className="px-6 py-2.5 bg-slate-950 dark:bg-indigo-600 hover:bg-slate-900 dark:hover:bg-indigo-500 text-white text-xs font-bold rounded-full shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:bg-slate-400"
                >
                  <Send className="h-4 w-4" />
                  <span>{submitLoading ? 'Transmitting...' : isEditing ? 'Update & Broadcast' : 'Publish Story'}</span>
                </button>
              </div>
            </form>
          </div>
      </div>
    </div>
  );
}
