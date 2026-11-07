import fs from 'fs';
import path from 'path';
import type { Request, Response } from 'express';
import { cleanImageUrl, getFallbackImageUrl } from '../utils/imageUrl.ts';
import { getFeedFromR2, getArticleFromR2, getDeletedArticleIds, registerOnArticleDeletedHook } from './r2Articles.ts';

interface CachedPost {
  id: string;
  title: string;
  content: string;
  category?: string;
  authorName?: string;
  authorEmail?: string;
  authorId?: string;
  createdAt?: string;
  updatedAt?: string;
  imageUrl?: string;
  imageUrlFallback?: string;
  imageUrls?: string[];
  imageUrlsFallback?: string[];
  imagePosition?: string;
  galleryPositions?: string[];
  youtubeUrl?: string;
  facebookUrl?: string;
  customLinks?: string[];
  hashtags?: string[];
  likes?: number;
  dislikes?: number;
  views?: number;
  status?: string;
}

// In-memory server cache to maximize phone loading speed and avoid redundant R2 reads
let inMemoryPostsCache: CachedPost[] = [];
let lastCacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds cache TTL

// Register observer hook to invalidate cache when an article is deleted
registerOnArticleDeletedHook(() => {
  inMemoryPostsCache = [];
  lastCacheTimestamp = 0;
});

export function invalidatePostsCache(): void {
  inMemoryPostsCache = [];
  lastCacheTimestamp = 0;
}

function getDiskFeed(): CachedPost[] {
  try {
    const feedFile = path.join(process.cwd(), 'data', 'feed.json');
    if (fs.existsSync(feedFile)) {
      const data = JSON.parse(fs.readFileSync(feedFile, 'utf-8'));
      if (Array.isArray(data)) {
        const deletedIds = getDeletedArticleIds();
        return data.filter(p => p && p.id && !deletedIds.has(p.id));
      }
    }
  } catch (e) {
    console.warn('[Posts API] Failed to read disk feed fallback:', e);
  }
  return [];
}

function getDiskArticle(id: string): CachedPost | null {
  try {
    const postFile = path.join(process.cwd(), 'data', 'articles', `${id}.json`);
    if (fs.existsSync(postFile)) {
      return JSON.parse(fs.readFileSync(postFile, 'utf-8'));
    }
  } catch (e) {
    console.warn(`[Posts API] Failed to read disk article ${id}:`, e);
  }
  return null;
}

/**
 * GET /api/posts
 * Fast chunked articles API for mobile phones and web.
 * Supports:
 * - limit: Number of articles per chunk (e.g. 10 on phones)
 * - page: 1-indexed page number
 * - category: Optional category filter
 * - search: Optional search text
 */
export async function handleGetPosts(req: Request, res: Response) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');

  const now = Date.now();
  if (inMemoryPostsCache.length === 0 || now - lastCacheTimestamp > CACHE_TTL_MS) {
    try {
      const r2Posts = await getFeedFromR2();
      if (r2Posts && Array.isArray(r2Posts) && r2Posts.length > 0) {
        inMemoryPostsCache = r2Posts;
        lastCacheTimestamp = now;
      } else {
        const diskPosts = getDiskFeed();
        if (diskPosts.length > 0) {
          inMemoryPostsCache = diskPosts;
          lastCacheTimestamp = now;
        }
      }
    } catch (r2Err) {
      console.debug('[Posts API] R2 read deferred, falling back to disk cache:', r2Err);
      const diskPosts = getDiskFeed();
      if (diskPosts.length > 0) {
        inMemoryPostsCache = diskPosts;
        lastCacheTimestamp = now;
      }
    }
  }

  const deletedIds = getDeletedArticleIds();
  let posts = inMemoryPostsCache.filter(p => p && p.id && !deletedIds.has(p.id));

  // Apply category filtering
  const category = (req.query.category as string || '').trim().toLowerCase();
  if (category && category !== 'all') {
    posts = posts.filter(p => (p.category || 'General').toLowerCase() === category);
  }

  // Apply search filtering
  const search = (req.query.search as string || '').trim().toLowerCase();
  if (search) {
    posts = posts.filter(p => {
      const titleMatch = (p.title || '').toLowerCase().includes(search);
      const tagMatch = (p.hashtags || []).some(t => t.toLowerCase().includes(search));
      const contentMatch = (p.content || '').toLowerCase().includes(search);
      return titleMatch || tagMatch || contentMatch;
    });
  }

  // Parse chunk / pagination parameters
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limitParam = req.query.limit as string;
  const limit = limitParam === 'all'
    ? (posts.length || 100)
    : Math.max(1, Math.min(200, parseInt(limitParam, 10) || 100));
  const offset = (page - 1) * limit;

  const chunk = posts.slice(offset, offset + limit);
  const hasMore = offset + limit < posts.length;

  return res.status(200).json({
    success: true,
    posts: chunk,
    total: posts.length,
    page,
    limit,
    hasMore,
    fromCache: now - lastCacheTimestamp < CACHE_TTL_MS
  });
}

/**
 * GET /api/posts/:id
 * Fast single article endpoint with Cloudflare R2 and disk caching (zero Firestore).
 */
export async function handleGetPostById(req: Request, res: Response) {
  const id = req.params.id;
  if (!id) {
    return res.status(400).json({ error: 'Post ID is required' });
  }

  const deletedIds = getDeletedArticleIds();
  if (deletedIds.has(id)) {
    return res.status(404).json({ success: false, error: 'Article not found or deleted' });
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');

  // 1. Check in-memory cache first if it contains content
  let post = inMemoryPostsCache.find(p => p.id === id);
  if (!post || !post.content) {
    // 2. Fetch full article from Cloudflare R2
    try {
      const r2Post = await getArticleFromR2(id);
      if (r2Post && !deletedIds.has(r2Post.id)) {
        post = r2Post;
      }
    } catch (e) {
      console.debug('[Posts API] R2 single article fetch deferred:', e);
    }
  }

  // 3. Fallback to local disk file if missing from R2
  if (!post || !post.content) {
    const diskPost = getDiskArticle(id);
    if (diskPost && !deletedIds.has(diskPost.id)) {
      post = diskPost;
    }
  }

  if (!post || deletedIds.has(post.id)) {
    return res.status(404).json({ error: 'Article not found' });
  }

  // Ensure image URLs are clean
  post.imageUrl = cleanImageUrl(post.imageUrl);
  post.imageUrlFallback = getFallbackImageUrl(post.imageUrl, post.imageUrlFallback);

  return res.status(200).json({
    success: true,
    post
  });
}

/**
 * GET /api/writers
 * Returns the configurable editorial writer bylines from environment variables.
 */
export async function handleGetWriters(_req: Request, res: Response) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');

  const writers = [
    'Current News',
    'Current News Staff Report',
    'Investigative Editorial Bureau',
    'Chief Political Correspondent',
    'Technology & Science Desk',
    'Global Affairs Dispatch',
    'Chronicle Desk'
  ];

  return res.status(200).json({
    success: true,
    writers
  });
}
