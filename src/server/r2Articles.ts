import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { cleanImageUrl } from '../utils/imageUrl.ts';

let s3Client: S3Client | null = null;

export interface R2Credentials {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  isS3Valid: boolean;
  apiToken: string | null;
}

export function getR2Credentials(): R2Credentials {
  const accountId = (process.env.R2_ACCOUNT_ID || '').trim();
  let accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim();
  let secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
  const bucket = process.env.R2_BUCKET_NAME || 'currentnews-media';

  // Check if access keys were swapped in environment settings
  if (accessKeyId.length === 64 && secretAccessKey.length === 32) {
    const temp = accessKeyId;
    accessKeyId = secretAccessKey;
    secretAccessKey = temp;
  }

  // AWS S3 / Cloudflare R2 S3 protocol requires accessKeyId to be strictly 32 hex characters
  const isS3Valid = Boolean(
    accountId &&
    accessKeyId &&
    secretAccessKey &&
    accessKeyId.length === 32 &&
    secretAccessKey.length >= 32
  );

  // If user provided a Cloudflare API token (typically 40-60 characters, like length 53)
  const apiToken =
    (accessKeyId.length > 32 ? accessKeyId : (secretAccessKey.length > 32 ? secretAccessKey : null)) ||
    (process.env.CLOUDFLARE_API_TOKEN || '').trim() ||
    null;

  return { accountId, accessKeyId, secretAccessKey, bucket, isS3Valid, apiToken };
}

function getR2Client(): S3Client | null {
  const creds = getR2Credentials();
  if (!creds.isS3Valid) {
    return null;
  }

  if (!s3Client) {
    const endpoint = process.env.R2_ENDPOINT || `https://${creds.accountId}.r2.cloudflarestorage.com`;
    s3Client = new S3Client({
      region: 'auto',
      endpoint: endpoint,
      credentials: {
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
      },
    });
  }
  return s3Client;
}

function getR2BucketName(): string {
  return process.env.R2_BUCKET_NAME || 'currentnews-media';
}

/**
 * Direct Cloudflare REST API fallback for environments where R2 credentials are provided
 * as a Cloudflare API Token (e.g. length > 32) rather than an S3 Access Key ID.
 */
async function r2RestPut(key: string, body: Buffer | string, contentType: string, cacheControl?: string): Promise<boolean> {
  const creds = getR2Credentials();
  if (!creds.accountId || !creds.apiToken) return false;
  try {
    const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${creds.accountId}/r2/buckets/${creds.bucket}/objects/${key}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${creds.apiToken}`,
      'Content-Type': contentType,
    };
    if (cacheControl) {
      headers['Cache-Control'] = cacheControl;
    }
    const res = await fetch(cfUrl, {
      method: 'PUT',
      headers,
      body: typeof body === 'string' ? Buffer.from(body, 'utf-8') : body,
    });
    return res.ok;
  } catch (err) {
    console.debug(`[R2 REST API] PUT notice for ${key}:`, err);
    return false;
  }
}

async function r2RestDelete(key: string): Promise<boolean> {
  const creds = getR2Credentials();
  if (!creds.accountId || !creds.apiToken) return false;
  try {
    const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${creds.accountId}/r2/buckets/${creds.bucket}/objects/${key}`;
    const res = await fetch(cfUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${creds.apiToken}`,
      },
    });
    return res.ok;
  } catch (err) {
    console.debug(`[R2 REST API] DELETE notice for ${key}:`, err);
    return false;
  }
}

function getLocalDataDir(): string {
  const dir = path.join(process.cwd(), 'data', 'articles');
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (e) {
    // Graceful fallback
  }
  return dir;
}

const DELETED_ARTICLES_FILE = path.join(process.cwd(), 'data', 'deleted_articles.json');

export function getDeletedArticleIds(): Set<string> {
  try {
    if (fs.existsSync(DELETED_ARTICLES_FILE)) {
      const raw = fs.readFileSync(DELETED_ARTICLES_FILE, 'utf-8');
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr.filter(Boolean));
      }
    }
  } catch (err) {
    console.debug('[R2 Articles] Read deleted articles notice:', err);
  }
  return new Set();
}

export function markArticleDeleted(postId: string): void {
  if (!postId) return;
  try {
    const set = getDeletedArticleIds();
    set.add(postId);
    const dir = path.dirname(DELETED_ARTICLES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DELETED_ARTICLES_FILE, JSON.stringify(Array.from(set), null, 2), 'utf-8');
  } catch (err) {
    console.warn('[R2 Articles] Failed to persist deleted article ID:', err);
  }
}

let onArticleDeletedHook: (() => void) | null = null;
export function registerOnArticleDeletedHook(hook: () => void) {
  onArticleDeletedHook = hook;
}

// In-memory light feed cache for instantaneous (0ms) responses
let inMemoryFeedCache: any[] = [];
let inMemoryFeedTimestamp = 0;
const FEED_CACHE_TTL = 30 * 1000; // 30 seconds

/**
 * Strips HTML tags and extracts ~200 characters of plain text for light card previews
 */
export function extractPlainExcerpt(htmlOrText: string, maxLength = 200): string {
  if (!htmlOrText) return '';
  const stripped = htmlOrText
    .replace(/<[^>]*>/g, ' ')
    .replace(/\[fig(?:ure)?(?:\.|\s+)?\s*\d+[^\]]*\]/gi, '')
    .replace(/data:image\/[a-zA-Z0-9+.-]+;base64,[^"'\s]+/g, '')
    .replace(/&nbsp;?/gi, ' ')
    .replace(/&#160;?/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&[a-z0-9#]{1,7};?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length > maxLength ? stripped.slice(0, maxLength).trim() + '...' : stripped;
}

/**
 * Transforms a full post into a light index entry for articles/feed.json.
 * Drops full content and guarantees zero base64 images so the feed index stays tiny (~20-40 KB).
 */
export function toLightArticle(post: any): any {
  if (!post || !post.id) return null;
  const cleanImg = cleanImageUrl(post.imageUrl);

  return {
    id: post.id,
    title: post.title || '',
    category: post.category || 'General',
    authorName: post.authorName || 'Current News',
    authorEmail: post.authorEmail || '',
    authorId: post.authorId || '',
    createdAt: post.createdAt || new Date().toISOString(),
    status: post.status || 'published',
    imageUrl: cleanImg,
    imageUrls: Array.isArray(post.imageUrls) ? post.imageUrls.map(cleanImageUrl) : [],
    youtubeUrl: post.youtubeUrl || '',
    facebookUrl: post.facebookUrl || '',
    hashtags: Array.isArray(post.hashtags) ? post.hashtags : [],
    likes: typeof post.likes === 'number' ? post.likes : 0,
    dislikes: typeof post.dislikes === 'number' ? post.dislikes : 0,
    views: typeof post.views === 'number' ? post.views : 0,
    excerpt: post.excerpt || extractPlainExcerpt(post.content || ''),
  };
}

/**
 * Converts Firestore REST API document fields into a plain JavaScript object
 */
export function parseFirestoreFields(fields: any): any {
  if (!fields) return {};
  const res: any = {};
  for (const [key, val] of Object.entries(fields)) {
    if (!val || typeof val !== 'object') continue;
    const v = val as any;
    if ('stringValue' in v) res[key] = v.stringValue;
    else if ('integerValue' in v) res[key] = parseInt(v.integerValue, 10);
    else if ('doubleValue' in v) res[key] = parseFloat(v.doubleValue);
    else if ('booleanValue' in v) res[key] = v.booleanValue;
    else if ('arrayValue' in v) {
      res[key] = (v.arrayValue?.values || []).map((item: any) => {
        if ('stringValue' in item) return item.stringValue;
        return item;
      });
    } else if ('mapValue' in v) {
      res[key] = parseFirestoreFields(v.mapValue?.fields);
    }
  }
  return res;
}

/**
 * Converts a plain JavaScript object into Firestore REST API document fields
 */
export function toFirestoreFields(obj: any): any {
  const fields: any = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined || val === null) continue;
    if (typeof val === 'string') {
      fields[key] = { stringValue: val };
    } else if (typeof val === 'number') {
      fields[key] = { integerValue: String(Math.round(val)) };
    } else if (typeof val === 'boolean') {
      fields[key] = { booleanValue: val };
    } else if (Array.isArray(val)) {
      fields[key] = {
        arrayValue: {
          values: val.map((item) => ({ stringValue: String(item) }))
        }
      };
    }
  }
  return fields;
}

/**
 * Reads single article from Firestore REST API
 */
export async function getArticleFromFirestoreRest(postId: string): Promise<any | null> {
  if (!postId) return null;
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) return null;
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (!cfg.projectId || !cfg.apiKey) return null;
    const dbId = cfg.firestoreDatabaseId || '(default)';
    const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${dbId}/documents/posts/${postId}?key=${cfg.apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.fields) return null;
    const post = parseFirestoreFields(data.fields);
    post.id = post.id || postId;
    return post;
  } catch (_) {
    return null;
  }
}

/**
 * Saves article to Firestore REST API with provided ID token
 */
export async function saveArticleToFirestoreRest(post: any, authHeader: string): Promise<boolean> {
  if (!post || !post.id || !authHeader) return false;
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) return false;
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (!cfg.projectId) return false;
    const dbId = cfg.firestoreDatabaseId || '(default)';
    const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${dbId}/documents/posts/${post.id}`;
    const fields = toFirestoreFields(post);
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({ fields })
    });
    return res.ok;
  } catch (e) {
    console.debug('[Firestore Server Sync Error]:', e);
    return false;
  }
}

/**
 * Load light feed from all local disk sources: data/feed.json and any individual articles
 */
export function loadLocalFeed(): any[] {
  const map = new Map<string, any>();
  const deletedIds = getDeletedArticleIds();
  const localDir = getLocalDataDir();

  // 1. Read data/feed.json
  try {
    const feedFile = path.join(process.cwd(), 'data', 'feed.json');
    if (fs.existsSync(feedFile)) {
      const content = fs.readFileSync(feedFile, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        for (const p of parsed) {
          if (p && p.id && !deletedIds.has(p.id)) {
            map.set(p.id, toLightArticle(p));
          }
        }
      }
    }
  } catch (err) {
    console.debug('[R2 Articles] Local feed cache read error:', err);
  }

  // 2. Scan data/articles/ directory for any individual articles not yet in feed.json
  try {
    if (fs.existsSync(localDir)) {
      const files = fs.readdirSync(localDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        const id = file.replace(/\.json$/, '');
        if (deletedIds.has(id)) continue;
        try {
          const articlePath = path.join(localDir, file);
          const fullArticle = JSON.parse(fs.readFileSync(articlePath, 'utf-8'));
          if (fullArticle && fullArticle.id && !deletedIds.has(fullArticle.id)) {
            const light = toLightArticle(fullArticle);
            if (light) {
              if (map.has(fullArticle.id)) {
                // Merge enriched fields like authorEmail, authorId
                const existing = map.get(fullArticle.id);
                map.set(fullArticle.id, {
                  ...existing,
                  authorEmail: existing.authorEmail || light.authorEmail || '',
                  authorId: existing.authorId || light.authorId || '',
                  authorName: existing.authorName || light.authorName || 'Current News',
                });
              } else {
                map.set(fullArticle.id, light);
              }
            }
          }
        } catch (_) {}
      }
    }
  } catch (_) {}

  return Array.from(map.values())
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}


/**
 * Safely extracts the canonical public base URL from process.env.R2_PUBLIC_DOMAIN.
 * Strips any protocol, path, or port typos, keeping strictly the hostname,
 * with media.currentnews.blog as fallback.
 * Always returns "https://" + host (e.g. "https://media.currentnews.blog").
 */
export function getPublicBase(): string {
  const raw = process.env.R2_PUBLIC_DOMAIN || 'media.currentnews.blog';
  let host = raw.trim();
  // Strip any protocol
  host = host.replace(/^[a-zA-Z]+:\/\//, '');
  // Strip any path components or query strings (e.g. /uploads/photo.jpg)
  host = host.split('/')[0].split('?')[0].split('#')[0].trim();
  // Strip trailing slashes
  host = host.replace(/\/+$/, '');
  if (!host) {
    host = 'media.currentnews.blog';
  }
  return `https://${host}`;
}

/**
 * Decodes a base64 data URL and uploads it directly to Cloudflare R2 as a standalone webp image file
 * with immutable 1-year cache headers, saving local mirror copy as fallback.
 * CRITICAL: If R2 credentials are missing or the upload fails, this function throws
 * so articles are never rewritten to point to non-existent uploaded images.
 */
export async function uploadBase64ImageToR2(base64DataUrl: string, key: string): Promise<string> {
  const client = getR2Client();
  const bucket = getR2BucketName();

  const match = base64DataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!match) {
    return cleanImageUrl(base64DataUrl);
  }

  const rawFormat = match[1].toLowerCase();
  const base64Data = match[2];
  const buffer = Buffer.from(base64Data, 'base64');
  const contentType = key.endsWith('.webp') ? 'image/webp' : (rawFormat === 'png' ? 'image/png' : 'image/jpeg');

  let uploadedToCloud = false;

  // 1. Upload via S3 client if valid S3 credentials exist (strictly 32-char access key)
  if (client) {
    try {
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, s-maxage=31536000, immutable',
      }));
      uploadedToCloud = true;
      console.log(`[R2 Image] Uploaded ${key} (${Math.round(buffer.length / 1024)} KB) to Cloudflare R2 (S3)`);
    } catch (s3Err: any) {
      console.warn(`[R2 Image] S3 PutObject notice for ${key}:`, s3Err?.message || s3Err);
    }
  }

  // 2. Fallback to Cloudflare REST API if S3 is not configured or failed
  if (!uploadedToCloud) {
    uploadedToCloud = await r2RestPut(key, buffer, contentType, 'public, max-age=31536000, s-maxage=31536000, immutable');
    if (uploadedToCloud) {
      console.log(`[R2 Image] Uploaded ${key} (${Math.round(buffer.length / 1024)} KB) to Cloudflare R2 (REST API)`);
    }
  }

  // 3. Save to local mirror in data/img as persistent fallback
  try {
    const localImgDir = path.join(process.cwd(), 'data', 'img');
    if (!fs.existsSync(localImgDir)) {
      fs.mkdirSync(localImgDir, { recursive: true });
    }
    const filename = path.basename(key);
    fs.writeFileSync(path.join(localImgDir, filename), buffer);
  } catch (err) {
    console.debug(`[R2 Image] Local write notice for ${key}:`, err);
  }

  const publicUrl = `${getPublicBase()}/${key}`;
  return cleanImageUrl(publicUrl);
}

/**
 * Uploads an already-validated image Buffer to the existing Cloudflare R2 bucket using
 * the existing R2 S3 client (or REST API token fallback) and returns its https:// URL
 * built from process.env.R2_PUBLIC_DOMAIN. Throws on failure so callers return 400.
 */
export async function uploadArticleImageBufferToR2(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const client = getR2Client();
  const bucket = getR2BucketName();
  const cacheControl = 'public, max-age=31536000, s-maxage=31536000, immutable';

  let uploadedToCloud = false;
  let lastErrorMessage = '';

  if (client) {
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          CacheControl: cacheControl,
        })
      );
      uploadedToCloud = true;
    } catch (s3Err: any) {
      lastErrorMessage = s3Err?.message || String(s3Err);
      console.warn(`[R2 Article Image] S3 PutObject failed for ${key}:`, lastErrorMessage);
    }
  }

  if (!uploadedToCloud) {
    uploadedToCloud = await r2RestPut(key, buffer, contentType, cacheControl);
  }

  if (!uploadedToCloud) {
    const creds = getR2Credentials();
    if (!creds.isS3Valid && !(creds.accountId && creds.apiToken)) {
      throw new Error('Image upload failed: Cloudflare R2 storage is not configured');
    }
    throw new Error(
      `Image upload failed: Could not upload image to Cloudflare R2${lastErrorMessage ? ` (${lastErrorMessage})` : ''}`
    );
  }

  const publicBase = getPublicBase();
  const cleanKey = key.replace(/^\/+/, '');
  return `${publicBase}/${cleanKey}`;
}

/**
 * Scans imageUrl, imageUrlFallback, imageUrls, imageUrlsFallback, and <img src="data:..."> in content.
 * For every base64 image found, decodes it, uploads to R2 as img/{postId}-{n}.webp,
 * and replaces the inline string with https://media.currentnews.blog/img/{postId}-{n}.webp.
 */
export async function processAndExtractBase64Images(post: any): Promise<{ post: any; migratedCount: number }> {
  if (!post || !post.id) return { post, migratedCount: 0 };
  const postId = String(post.id).replace(/[^a-zA-Z0-9_-]/g, '_');
  let migratedCount = 0;
  let counter = 1;

  // 1. Scan imageUrl
  if (typeof post.imageUrl === 'string') {
    if (post.imageUrl.includes('data:image/')) {
      const dataMatch = post.imageUrl.match(/data:image\/[a-zA-Z0-9+.-]+;base64,[^"'\s]+/);
      if (dataMatch) {
        const key = `img/${postId}-${counter++}.webp`;
        post.imageUrl = await uploadBase64ImageToR2(dataMatch[0], key);
        migratedCount++;
      }
    }
    post.imageUrl = cleanImageUrl(post.imageUrl);
  }

  // 2. Scan imageUrlFallback
  if (typeof post.imageUrlFallback === 'string') {
    if (post.imageUrlFallback.includes('data:image/')) {
      const dataMatch = post.imageUrlFallback.match(/data:image\/[a-zA-Z0-9+.-]+;base64,[^"'\s]+/);
      if (dataMatch) {
        const key = `img/${postId}-${counter++}.webp`;
        post.imageUrlFallback = await uploadBase64ImageToR2(dataMatch[0], key);
        migratedCount++;
      }
    }
    post.imageUrlFallback = cleanImageUrl(post.imageUrlFallback);
  }

  // 3. Scan imageUrls array
  if (Array.isArray(post.imageUrls)) {
    const updatedUrls: string[] = [];
    for (let url of post.imageUrls) {
      if (typeof url === 'string') {
        if (url.includes('data:image/')) {
          const dataMatch = url.match(/data:image\/[a-zA-Z0-9+.-]+;base64,[^"'\s]+/);
          if (dataMatch) {
            const key = `img/${postId}-${counter++}.webp`;
            url = await uploadBase64ImageToR2(dataMatch[0], key);
            migratedCount++;
          }
        }
        updatedUrls.push(cleanImageUrl(url));
      }
    }
    post.imageUrls = updatedUrls.filter(Boolean);
  }

  // 4. Scan imageUrlsFallback array
  if (Array.isArray(post.imageUrlsFallback)) {
    const updatedUrls: string[] = [];
    for (let url of post.imageUrlsFallback) {
      if (typeof url === 'string') {
        if (url.includes('data:image/')) {
          const dataMatch = url.match(/data:image\/[a-zA-Z0-9+.-]+;base64,[^"'\s]+/);
          if (dataMatch) {
            const key = `img/${postId}-${counter++}.webp`;
            url = await uploadBase64ImageToR2(dataMatch[0], key);
            migratedCount++;
          }
        }
        updatedUrls.push(cleanImageUrl(url));
      }
    }
    post.imageUrlsFallback = updatedUrls.filter(Boolean);
  }

  // 5. Scan <img src="data:image/..."> inside post.content
  if (typeof post.content === 'string') {
    // Repair any previously corrupted /uploads/.../img/ references
    post.content = post.content.replace(
      /https:\/\/(?:https\/\/)?media\.currentnews\.blog\/uploads\/[^"'\s]+\/img\//gi,
      `${getPublicBase()}/img/`
    );

    if (post.content.includes('data:image/')) {
      const regex = /src=["'](data:image\/[a-zA-Z0-9+.-]+;base64,[^"']+)["']/g;
      let match: RegExpExecArray | null;
      const matches: string[] = [];
      while ((match = regex.exec(post.content)) !== null) {
        matches.push(match[1]);
      }

      for (const dataUrl of matches) {
        const key = `img/${postId}-${counter++}.webp`;
        const uploadedUrl = await uploadBase64ImageToR2(dataUrl, key);
        post.content = post.content.split(dataUrl).join(uploadedUrl);
        migratedCount++;
      }
    }
  }

  return { post, migratedCount };
}

/**
 * Save article JSON directly to Cloudflare R2 and local mirror.
 * Extracts any base64 images into standalone webp files on R2 first,
 * saves the FULL article to articles/{id}.json, and updates the LIGHT feed.json.
 */
export async function saveArticleToR2(post: any): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!post || !post.id) {
    return { success: false, error: 'Invalid post object' };
  }

  // Ensure default author name is Current News
  if (!post.authorName || !post.authorName.trim()) {
    post.authorName = 'Current News';
  }

  // Extract excerpt if not already set
  if (!post.excerpt) {
    post.excerpt = extractPlainExcerpt(post.content || '');
  }

  // Scan and migrate any base64 images to R2 img/{postId}-{n}.webp
  await processAndExtractBase64Images(post);

  // 1. Save full article to local disk cache for instant fallback
  try {
    const localDir = getLocalDataDir();
    const filePath = path.join(localDir, `${post.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(post, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[R2 Articles] Failed to save local article backup:', err);
  }

  // 2. Upload full article JSON to Cloudflare R2
  const client = getR2Client();
  const bucket = getR2BucketName();
  const r2Key = `articles/${post.id}.json`;
  let uploadedArticle = false;

  if (client) {
    try {
      const bodyBuffer = Buffer.from(JSON.stringify(post), 'utf-8');
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: r2Key,
        Body: bodyBuffer,
        ContentType: 'application/json; charset=utf-8',
        CacheControl: 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
      }));
      uploadedArticle = true;
      console.log(`[R2 Articles] Successfully saved full article ${post.id} to Cloudflare R2 (S3)`);
    } catch (r2Err: any) {
      console.warn(`[R2 Articles] S3 PutObject failed for ${post.id}:`, r2Err?.message || r2Err);
    }
  }

  if (!uploadedArticle) {
    uploadedArticle = await r2RestPut(
      r2Key,
      JSON.stringify(post),
      'application/json; charset=utf-8',
      'public, max-age=60, s-maxage=300, stale-while-revalidate=86400'
    );
    if (uploadedArticle) {
      console.log(`[R2 Articles] Successfully saved full article ${post.id} to Cloudflare R2 (REST API)`);
    }
  }

  // 3. Update the aggregated light feed.json in R2
  await updateFeedIndexInR2(post);

  const publicUrl = `${getPublicBase()}/${r2Key}`;

  return { success: true, url: publicUrl };
}

/**
 * Update the public aggregated LIGHT feed in Cloudflare R2 and memory.
 * articles/feed.json stores ONLY light index objects: id, title, category,
 * authorName, createdAt, status, imageUrl, hashtags, likes, dislikes, views, excerpt.
 * No full content, no base64 strings.
 */
async function updateFeedIndexInR2(updatedPost: any): Promise<void> {
  try {
    let feed = inMemoryFeedCache.length > 0 ? [...inMemoryFeedCache] : loadLocalFeed();
    
    // Upsert or remove if draft
    const existingIndex = feed.findIndex(p => p.id === updatedPost.id);
    if (updatedPost.status === 'draft') {
      if (existingIndex >= 0) {
        feed.splice(existingIndex, 1);
      }
    } else {
      const lightPost = toLightArticle(updatedPost);
      if (existingIndex >= 0) {
        feed[existingIndex] = lightPost;
      } else {
        feed.unshift(lightPost);
      }
    }

    // Ensure all items in feed are light
    feed = feed.map(toLightArticle).filter(Boolean);

    // Sort by createdAt descending
    feed.sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    inMemoryFeedCache = feed;
    inMemoryFeedTimestamp = Date.now();

    // Save local light feed copy
    try {
      const feedFile = path.join(process.cwd(), 'data', 'feed.json');
      fs.writeFileSync(feedFile, JSON.stringify(feed), 'utf-8');
    } catch (e) {}

    // Upload light feed.json to Cloudflare R2
    const client = getR2Client();
    const bucket = getR2BucketName();
    const feedBody = Buffer.from(JSON.stringify(feed));
    let feedUploaded = false;

    if (client) {
      try {
        await client.send(new PutObjectCommand({
          Bucket: bucket,
          Key: 'articles/feed.json',
          Body: feedBody,
          ContentType: 'application/json; charset=utf-8',
          CacheControl: 'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
        }));
        feedUploaded = true;
      } catch (err) {
        console.warn('[R2 Articles] Failed to update light articles/feed.json on R2 (S3):', err);
      }
    }

    if (!feedUploaded) {
      await r2RestPut(
        'articles/feed.json',
        feedBody,
        'application/json; charset=utf-8',
        'public, max-age=30, s-maxage=60, stale-while-revalidate=300'
      );
    }
  } catch (err) {
    console.error('[R2 Articles] Error updating feed index:', err);
  }
}

/**
 * Delete article from Cloudflare R2 and feed index
 */
export async function deleteArticleFromR2(postId: string): Promise<boolean> {
  if (!postId) return false;

  // 1. Mark in persistent tombstone registry
  markArticleDeleted(postId);

  // 2. Delete full article from local mirror
  try {
    const localDir = getLocalDataDir();
    const filePath = path.join(localDir, `${postId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn('[R2 Articles] Error unlinking local file:', err);
  }

  // 3. Delete full article from R2
  const client = getR2Client();
  const bucket = getR2BucketName();
  const key = `articles/${postId}.json`;
  let deleted = false;

  if (client) {
    try {
      await client.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }));
      deleted = true;
    } catch (err: any) {
      console.warn('[R2 Articles] Error deleting S3 object from R2:', err?.message || err);
    }
  }

  if (!deleted) {
    try {
      await r2RestDelete(key);
    } catch (restErr) {
      console.debug('[R2 Articles] REST API delete notice:', restErr);
    }
  }

  // 4. Update in-memory and R2 light feed
  const deletedIds = getDeletedArticleIds();
  let feed = inMemoryFeedCache.length > 0 ? inMemoryFeedCache : loadLocalFeed();
  feed = feed.filter((p: any) => p && p.id && p.id !== postId && !deletedIds.has(p.id));
  inMemoryFeedCache = feed;
  inMemoryFeedTimestamp = Date.now();

  try {
    const feedFile = path.join(process.cwd(), 'data', 'feed.json');
    fs.writeFileSync(feedFile, JSON.stringify(inMemoryFeedCache, null, 2), 'utf-8');
  } catch (e) {}

  // 5. Trigger external caches invalidation (e.g. postsApi)
  if (onArticleDeletedHook) {
    try {
      onArticleDeletedHook();
    } catch (_) {}
  }

  const feedBody = Buffer.from(JSON.stringify(inMemoryFeedCache));
  if (client) {
    try {
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: 'articles/feed.json',
        Body: feedBody,
        ContentType: 'application/json; charset=utf-8',
        CacheControl: 'public, max-age=30, s-maxage=60',
      }));
    } catch (e) {}
  } else {
    await r2RestPut('articles/feed.json', feedBody, 'application/json; charset=utf-8', 'public, max-age=30, s-maxage=60');
  }

  return true;
}

/**
 * Retrieve FULL article JSON from local disk, R2, or Firestore.
 * Guarantees that returned object includes full article content.
 */
export async function getArticleFromR2(postId: string): Promise<any | null> {
  if (!postId) return null;
  const deletedIds = getDeletedArticleIds();
  if (deletedIds.has(postId)) {
    return null;
  }

  // 1. Check local disk mirror first (contains full post with content)
  try {
    const localDir = getLocalDataDir();
    const filePath = path.join(localDir, `${postId}.json`);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && (parsed.content || parsed.title)) {
        return parsed;
      }
    }
  } catch (e) {}

  // 2. Check S3 R2 GetObject
  const client = getR2Client();
  const bucket = getR2BucketName();
  if (client) {
    try {
      const resp = await client.send(new GetObjectCommand({
        Bucket: bucket,
        Key: `articles/${postId}.json`
      }));
      if (resp.Body) {
        const str = await resp.Body.transformToString();
        const parsed = JSON.parse(str);
        if (parsed && (parsed.content || parsed.title) && !deletedIds.has(parsed.id)) {
          return parsed;
        }
      }
    } catch (err) {
      // Key may not exist in R2 yet
    }
  }

  // 3. Check Public R2 CDN HTTP URL
  const customBase = getPublicBase();
  const rawDev = process.env.R2_DEV_DOMAIN || '';
  const devHost = rawDev.replace(/^[a-zA-Z]+:\/\//, '').split('/')[0].trim();
  const candidateBases = [customBase];
  if (devHost) {
    candidateBases.push(`https://${devHost}`);
  }

  for (const base of candidateBases) {
    try {
      const cdnUrl = `${base}/articles/${postId}.json`;
      const res = await fetch(cdnUrl, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        if (data && (data.content || data.title) && !deletedIds.has(data.id)) {
          return data;
        }
      }
    } catch (e) {}
  }

  // 4. Firestore REST API fallback: ensures article is found across Cloud Run container scale-downs
  try {
    const firestorePost = await getArticleFromFirestoreRest(postId);
    if (firestorePost && (firestorePost.content || firestorePost.title) && !deletedIds.has(firestorePost.id)) {
      // Cache locally to container disk
      try {
        const localDir = getLocalDataDir();
        fs.writeFileSync(path.join(localDir, `${postId}.json`), JSON.stringify(firestorePost, null, 2), 'utf-8');
      } catch (_) {}
      return firestorePost;
    }
  } catch (_) {}

  return null;
}

/**
 * Merges remote CDN articles with local disk and memory cache so newly posted articles
 * are NEVER wiped out by stale CDN responses.
 */
function mergeFeedWithLocalAndCache(remoteArticles: any[]): any[] {
  const deletedIds = getDeletedArticleIds();
  const localArticles = loadLocalFeed();
  const currentInMem = inMemoryFeedCache.filter(p => p && p.id && !deletedIds.has(p.id));

  const postMap = new Map<string, any>();

  // 1. Add remote CDN articles
  if (Array.isArray(remoteArticles)) {
    for (const p of remoteArticles) {
      if (p && p.id && !deletedIds.has(p.id)) {
        postMap.set(p.id, toLightArticle(p));
      }
    }
  }

  // 2. Merge local disk articles and in-memory cache
  // Any article present locally that is not in the CDN is preserved!
  for (const p of [...currentInMem, ...localArticles]) {
    if (!p || !p.id || deletedIds.has(p.id)) continue;
    const light = toLightArticle(p);
    if (!light) continue;

    if (!postMap.has(p.id)) {
      postMap.set(p.id, light);
    } else {
      // Enrich existing CDN item with authorEmail and authorId if CDN had stripped them
      const existing = postMap.get(p.id);
      postMap.set(p.id, {
        ...existing,
        authorEmail: existing.authorEmail || light.authorEmail || '',
        authorId: existing.authorId || light.authorId || '',
        authorName: existing.authorName || light.authorName || 'Current News',
      });
    }
  }

  return Array.from(postMap.values())
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

/**
 * Retrieve light published articles feed from Cloudflare R2 and merge with local disk.
 * Guaranteed never to overwrite newly posted local articles with stale CDN data.
 */
export async function getFeedFromR2(): Promise<any[]> {
  const deletedIds = getDeletedArticleIds();
  const now = Date.now();
  if (inMemoryFeedCache.length > 0 && now - inMemoryFeedTimestamp < FEED_CACHE_TTL) {
    return inMemoryFeedCache.filter(p => p && p.id && !deletedIds.has(p.id));
  }

  // 1. Try S3 client GetObject
  const client = getR2Client();
  const bucket = getR2BucketName();
  if (client) {
    try {
      const resp = await client.send(new GetObjectCommand({
        Bucket: bucket,
        Key: 'articles/feed.json'
      }));
      if (resp.Body) {
        const str = await resp.Body.transformToString();
        const parsed = JSON.parse(str);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = mergeFeedWithLocalAndCache(parsed);
          inMemoryFeedCache = merged;
          inMemoryFeedTimestamp = now;
          return merged;
        }
      }
    } catch (err) {
      // Fall through to public CDN or local cache
    }
  }

  // 2. Try Public R2 CDN
  const customBase = getPublicBase();
  const rawDev = process.env.R2_DEV_DOMAIN || '';
  const devHost = rawDev.replace(/^[a-zA-Z]+:\/\//, '').split('/')[0].trim();
  const candidateBases = [customBase];
  if (devHost) {
    candidateBases.push(`https://${devHost}`);
  }

  for (const base of candidateBases) {
    try {
      const cdnUrl = `${base}/articles/feed.json`;
      const res = await fetch(cdnUrl, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const merged = mergeFeedWithLocalAndCache(data);
          inMemoryFeedCache = merged;
          inMemoryFeedTimestamp = now;
          return merged;
        }
      }
    } catch (e) {}
  }

  // 3. Fallback to local disk feed
  const localFeed = loadLocalFeed();
  if (localFeed.length > 0) {
    const merged = mergeFeedWithLocalAndCache(localFeed);
    inMemoryFeedCache = merged;
    inMemoryFeedTimestamp = now;
    return merged;
  }

  return inMemoryFeedCache.filter(p => p && p.id && !deletedIds.has(p.id));
}

/**
 * Bulk sync an array of articles into Cloudflare R2
 */
export async function syncArticlesToR2(posts: any[]): Promise<{ synced: number; total: number }> {
  if (!Array.isArray(posts) || posts.length === 0) {
    return { synced: 0, total: 0 };
  }

  let count = 0;
  for (const post of posts) {
    try {
      await saveArticleToR2(post);
      count++;
    } catch (err) {
      console.warn(`[R2 Sync] Failed to sync post ${post.id}:`, err);
    }
  }

  // Update in-memory light feed
  inMemoryFeedCache = mergeFeedWithLocalAndCache(posts.filter(p => p.status !== 'draft'));
  inMemoryFeedTimestamp = Date.now();

  return { synced: count, total: posts.length };
}



/**
 * Startup bootloader to ensure Cloudflare R2 articles feed is warm and light feed is loaded.
 */
export async function ensureR2ArticlesWarmup(): Promise<void> {
  try {
    const feed = await getFeedFromR2();
    console.log(`[R2 Bootloader] Cloudflare R2 light feed active with ${feed.length} dispatches (~${Math.round(JSON.stringify(feed).length / 1024)} KB) ready for instant delivery.`);
  } catch (err) {
    console.warn('[R2 Bootloader] Warmup check deferred:', err);
  }
}
