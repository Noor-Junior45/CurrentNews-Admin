import crypto from 'node:crypto';
import { query, isNeonConfigured } from '../db/neon.ts';

const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 10000;

export interface SignedPostResult {
  ok: boolean;
  status: number;
  data?: any;
  error?: string;
}

/**
 * Sends a cryptographically signed POST request to the Cloudflare Worker internal API.
 * Uses HMAC-SHA256(SYNC_SECRET, timestamp + "." + rawBody).
 * Includes 10s timeout and 3 attempts with exponential backoff.
 */
export async function signedPost(path: string, body: any): Promise<SignedPostResult> {
  const secret = (process.env.SYNC_SECRET || '').trim();
  if (!secret) {
    return { ok: false, status: 500, error: 'SYNC_SECRET environment variable is not configured' };
  }

  const baseUrl = (process.env.WORKER_BASE_URL || '').replace(/\/+$/, '');
  if (!baseUrl) {
    return { ok: false, status: 500, error: 'WORKER_BASE_URL environment variable is not configured' };
  }
  const url = `${baseUrl}${path.startsWith('/') ? path : '/' + path}`;
  const rawBody = JSON.stringify(body);

  let lastError = 'Unknown error';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const timestamp = Date.now().toString();
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(`${timestamp}.${rawBody}`);
    const signature = hmac.digest('hex');

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Timestamp': timestamp,
          'X-Signature': signature,
        },
        body: rawBody,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (res.ok) {
        let data: any = {};
        try {
          data = await res.json();
        } catch (_) {}
        return { ok: true, status: res.status, data };
      }

      let errText = `HTTP ${res.status}`;
      try {
        const errJson: any = await res.json();
        if (errJson && errJson.error) errText = errJson.error;
      } catch (_) {}

      lastError = `Worker error (${res.status}): ${errText}`;

      // Only retry on 5xx or network errors, not on 4xx validation failures
      if (res.status >= 400 && res.status < 500) {
        return { ok: false, status: res.status, error: lastError };
      }
    } catch (err: any) {
      lastError = err?.name === 'AbortError' ? 'Sync request timed out after 10s' : (err?.message || 'Network error');
    }

    if (attempt < MAX_ATTEMPTS) {
      const backoffMs = 500 * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }

  return { ok: false, status: 500, error: lastError };
}

/**
 * Maps a Neon articles table row into the Cloudflare D1 reader schema.
 * Strictly omits author email, author uid, and sync tracking fields.
 */
export function mapNeonToD1Article(row: any): any {
  const parseArray = (val: any): string[] => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try {
        const p = JSON.parse(val);
        return Array.isArray(p) ? p : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const toEpoch = (val: any): number | null => {
    if (val === undefined || val === null || val === '') return null;
    const d = new Date(val);
    const t = d.getTime();
    return isNaN(t) ? null : t;
  };

  const publishedEpoch = toEpoch(row.published_at ?? row.publishedAt)
    ?? toEpoch(row.created_at ?? row.createdAt)
    ?? Date.now();

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt || '',
    content: row.content,
    category: row.category || 'General',
    hashtags: parseArray(row.hashtags),
    youtubeUrl: row.youtube_url || '',
    facebookUrl: row.facebook_url || '',
    customLinks: parseArray(row.custom_links),
    imageUrl: row.image_url || '',
    imageUrlFallback: row.image_url_fallback || '',
    imageUrls: parseArray(row.image_urls),
    imageUrlsFallback: parseArray(row.image_urls_fallback),
    imagePosition: row.image_position || 'top',
    galleryPositions: parseArray(row.gallery_positions),
    authorName: row.author_name || 'Current News',
    publishedAt: publishedEpoch,
    published_at: publishedEpoch,
    updatedAt: toEpoch(row.updated_at) ?? Date.now(),
    version: Number(row.version) || 1,
  };
}

/**
 * Publishes an article to Cloudflare D1 reader table via /internal/publish.
 */
export async function publishArticleToD1(row: any): Promise<{ success: boolean; error?: string }> {
  const d1Article = mapNeonToD1Article(row);
  const result = await signedPost('/internal/publish', { article: d1Article });
  if (result.ok) {
    return { success: true };
  }
  return { success: false, error: result.error || 'Failed to publish to D1' };
}

/**
 * Unpublishes an article from Cloudflare D1 reader table via /internal/unpublish.
 */
export async function unpublishArticleFromD1(id: string): Promise<{ success: boolean; error?: string }> {
  const result = await signedPost('/internal/unpublish', { id });
  if (result.ok) {
    return { success: true };
  }
  return { success: false, error: result.error || 'Failed to unpublish from D1' };
}

/**
 * Syncs a single article row based on its status.
 */
export async function syncSingleArticle(row: any): Promise<{ success: boolean; error?: string }> {
  if (row.status === 'published') {
    return await publishArticleToD1(row);
  } else {
    // Draft or archived articles must not exist in D1 reader table
    return await unpublishArticleFromD1(row.id);
  }
}

/**
 * Processes up to `limit` pending outbox articles from Neon, ordered oldest updated first.
 */
export async function syncPendingArticles(limit: number = 50): Promise<{ processed: number; succeeded: number; failed: number }> {
  if (!isNeonConfigured()) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  const cappedLimit = Math.max(1, Math.min(100, limit));
  const res = await query(
    `SELECT * FROM articles 
     WHERE sync_pending = true 
     ORDER BY updated_at ASC 
     LIMIT $1`,
    [cappedLimit]
  );

  const rows = res.rows || [];
  let succeeded = 0;
  let failed = 0;

  for (const row of rows) {
    const syncRes = await syncSingleArticle(row);
    if (syncRes.success) {
      succeeded++;
      await query(
        `UPDATE articles 
         SET sync_pending = false, 
             synced_at = now(), 
             synced_version = version, 
             sync_error = NULL 
         WHERE id = $1`,
        [row.id]
      );
    } else {
      failed++;
      const cleanError = (syncRes.error || 'Sync error').slice(0, 300);
      await query(
        `UPDATE articles 
         SET sync_pending = true, 
             sync_error = $1 
         WHERE id = $2`,
        [cleanError, row.id]
      );
      console.warn(`[D1 Sync] Pending article ${row.id} sync failed: ${cleanError}`);
    }
  }

  return { processed: rows.length, succeeded, failed };
}
