import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import sanitizeHtml from 'sanitize-html';
import { query, isNeonConfigured, hasTablePrivilege } from '../db/neon.ts';
import { adminAuth } from '../auth/firebaseAdmin.ts';
import { verifyFirebaseTokenSafely } from '../auth/tokenVerifier.ts';
import { saveArticleToR2, deleteArticleFromR2, getFeedFromR2, loadLocalFeed, extractPlainExcerpt, getArticleFromR2 } from '../../src/server/r2Articles.ts';
import { slugify, toSafeSlug } from '../../src/types.ts';
import { syncSingleArticle, unpublishArticleFromD1, syncPendingArticles, isD1SyncConfigured } from '../sync/d1Publisher.ts';

const ALLOWED_CATEGORIES = [
  'Jharkhand', 'Politics', 'Tech', 'Sports', 'Business', 'Health',
  'World', 'Opinion', 'General', 'National', 'Economy', 'Culture', 'Science'
];

export function sanitizeArticleContent(html: string): string {
  if (!html) return '';
  return sanitizeHtml(html, {
    allowedTags: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br',
      'strong', 'b', 'em', 'i', 'u', 's', 'strike',
      'a', 'ul', 'ol', 'li', 'blockquote',
      'img', 'figure', 'figcaption', 'iframe',
      'div', 'span', 'pre', 'code', 'table', 'tbody', 'tr', 'td', 'th'
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel', 'class'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'class'],
      iframe: ['src', 'width', 'height', 'frameborder', 'allow', 'allowfullscreen', 'title'],
      div: ['class'],
      span: ['class'],
      p: ['class'],
      figure: ['class'],
      figcaption: ['class']
    },
    allowedClasses: {
      '*': [
        /^ql-align-[a-z0-9_-]+$/,
        /^ql-size-[a-z0-9_-]+$/,
        /^ql-font-[a-z0-9_-]+$/,
        /^ql-direction-[a-z0-9_-]+$/,
        /^ql-indent-[0-9]+$/,
        'ql-syntax',
        'ql-video'
      ]
    },
    allowedIframeHostnames: [
      'www.youtube.com',
      'youtube.com',
      'www.youtube-nocookie.com',
      'youtube-nocookie.com'
    ],
    allowedSchemes: ['http', 'https'],
    allowedSchemesByTag: {
      img: ['https'],
      iframe: ['https']
    },
    transformTags: {
      a: (tagName, attribs) => {
        const cleanAttribs: Record<string, string> = {
          ...attribs,
          rel: 'noopener noreferrer nofollow'
        };
        if (cleanAttribs.target) {
          if (cleanAttribs.target !== '_blank') {
            delete cleanAttribs.target;
          }
        }
        return {
          tagName,
          attribs: cleanAttribs
        };
      }
    }
  });
}

function parseJsonOrPgArray(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        return [];
      }
    }
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const inner = trimmed.slice(1, -1);
      if (!inner) return [];
      return inner.split(',').map(s => s.replace(/^"|"$/g, '').trim()).filter(Boolean);
    }
  }
  return [];
}

/**
 * Helper to validate and parse date strings.
 * Must be a valid date, not more than 1 day in the future, and not before 2000-01-01.
 * Otherwise throws an Error('invalid_date').
 */
export function parseDate(val: any): Date {
  if (val === undefined || val === null || val === '') {
    throw new Error('invalid_date');
  }
  const d = new Date(val);
  const time = d.getTime();
  if (isNaN(time)) {
    throw new Error('invalid_date');
  }
  const minDate = new Date('2000-01-01T00:00:00.000Z').getTime();
  const maxDate = Date.now() + 24 * 60 * 60 * 1000; // not more than 1 day in the future
  if (time < minDate || time > maxDate) {
    throw new Error('invalid_date');
  }
  return d;
}

const articleSchema = z.object({
  id: z.string().trim().optional(),
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title cannot exceed 200 characters'),
  content: z.string().min(1, 'Content is required').max(500 * 1024, 'Content cannot exceed 500KB'),
  category: z.string().trim().refine(val => !val || ALLOWED_CATEGORIES.some(c => c.toLowerCase() === val.toLowerCase()), {
    message: 'Category must be from the allowed category taxonomy'
  }).default('General'),
  youtubeUrl: z.string().trim().refine(val => !val || /^https?:\/\//i.test(val), { message: 'YouTube URL must be http/https' }).optional().default(''),
  facebookUrl: z.string().trim().refine(val => !val || /^https?:\/\//i.test(val), { message: 'Facebook URL must be http/https' }).optional().default(''),
  customLinks: z.array(z.string().trim().refine(val => !val || /^https?:\/\//i.test(val), { message: 'Custom links must be valid URLs' })).max(20).optional().default([]),
  hashtags: z.array(z.string().trim().max(50)).max(20).optional().default([]),
  imageUrl: z.string().trim().optional().default(''),
  imageUrlFallback: z.string().trim().optional().default(''),
  imageUrls: z.array(z.string().trim()).max(10).optional().default([]),
  imageUrlsFallback: z.array(z.string().trim()).max(10).optional().default([]),
  imagePosition: z.string().optional().default('top'),
  galleryPositions: z.array(z.string()).max(10).optional().default([]),
  authorName: z.string().trim().max(100).optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  version: z.number().int().min(1).optional(),
  createdAt: z.string().optional().nullable(),
  publishedAt: z.string().optional().nullable(),
});

export function mapRowToArticle(row: any): any {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content,
    category: row.category || 'General',
    hashtags: parseJsonOrPgArray(row.hashtags),
    youtubeUrl: row.youtube_url || '',
    facebookUrl: row.facebook_url || '',
    customLinks: parseJsonOrPgArray(row.custom_links),
    imageUrl: row.image_url || '',
    imageUrlFallback: row.image_url_fallback || '',
    imageUrls: parseJsonOrPgArray(row.image_urls),
    imageUrlsFallback: parseJsonOrPgArray(row.image_urls_fallback),
    imagePosition: row.image_position || 'top',
    galleryPositions: parseJsonOrPgArray(row.gallery_positions),
    authorId: row.author_uid,
    authorName: row.author_name || 'Current News',
    authorEmail: row.author_email || '',
    status: row.status,
    version: typeof row.version === 'number' ? row.version : 1,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
    syncedAt: row.synced_at ? new Date(row.synced_at).toISOString() : null,
    syncPending: Boolean(row.sync_pending),
    syncedVersion: row.synced_version || 0,
    syncError: row.sync_error || null,
  };
}

async function recordAuditLog(
  actorUid: string,
  actorEmail: string,
  action: string,
  entity: string,
  entityId: string,
  meta: any,
  ip: string
) {
  if (!isNeonConfigured()) return;
  try {
    await query(
      `INSERT INTO audit_log (actor_uid, actor_email, action, entity, entity_id, meta, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [actorUid, actorEmail, action, entity, entityId, JSON.stringify(meta), ip]
    );
  } catch (err: any) {
    console.debug('[Audit Log] Notice:', err?.message || err);
  }
}

/**
 * POST /api/admin/articles
 * Create or update an article in Neon, then sync to R2 if published.
 */
export async function handleAdminCreateOrUpdateArticle(req: Request, res: Response) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const parseResult = articleSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: parseResult.error.format()
    });
  }

  const data = parseResult.data;
  const isAdmin = user.role === 'admin';

  let adminPublishedAt: Date | null = null;
  let adminCreatedAt: Date | null = null;
  let hasAdminPublishedAt = false;
  let hasAdminCreatedAt = false;

  if (isAdmin) {
    if (data.publishedAt !== undefined && data.publishedAt !== null && String(data.publishedAt).trim() !== '') {
      try {
        adminPublishedAt = parseDate(data.publishedAt);
        hasAdminPublishedAt = true;
      } catch (err: any) {
        return res.status(400).json({
          success: false,
          error: 'invalid_date',
          code: 'invalid_date'
        });
      }
    }
    if (data.createdAt !== undefined && data.createdAt !== null && String(data.createdAt).trim() !== '') {
      try {
        adminCreatedAt = parseDate(data.createdAt);
        hasAdminCreatedAt = true;
      } catch (err: any) {
        return res.status(400).json({
          success: false,
          error: 'invalid_date',
          code: 'invalid_date'
        });
      }
    }
  }

  // Only admins may set status = 'published'. Writers may only save 'draft'.
  if (!isAdmin && data.status !== 'draft') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Only administrators can publish articles',
      code: 'forbidden'
    });
  }

  // Never accept authorName from a writer. Take it from the staff pen name (staff table, or fall back to user's display name). Admins may override it.
  let authorName: string;
  if (isAdmin && data.authorName && data.authorName.trim()) {
    authorName = data.authorName.trim();
  } else {
    let staffPenName: string | null = null;
    if (isNeonConfigured()) {
      try {
        const staffRes = await query('SELECT pen_name FROM staff WHERE uid = $1', [user.uid]);
        if (staffRes.rows.length > 0 && staffRes.rows[0].pen_name && staffRes.rows[0].pen_name.trim()) {
          staffPenName = staffRes.rows[0].pen_name.trim();
        }
      } catch (err) {
        console.warn('[Admin API] Notice: could not load staff pen name:', err);
      }
    }

    let displayName = user.name?.trim() || '';
    if (!displayName) {
      try {
        const fbUser = await adminAuth.getUser(user.uid);
        if (fbUser.displayName && fbUser.displayName.trim()) {
          displayName = fbUser.displayName.trim();
        }
      } catch (_) {}
    }

    authorName = staffPenName || displayName || (user.email ? user.email.split('@')[0] : 'Current News');
  }

  // Determine if this request is an UPDATE vs an INSERT (new article)
  const isDraftComposerNewPost = (body: any, id: string): boolean => {
    if (!id || !id.startsWith('post_')) return false;
    if (
      body.createdAt &&
      body.updatedAt &&
      body.createdAt === body.updatedAt &&
      Number(body.likes || 0) === 0 &&
      Number(body.dislikes || 0) === 0
    ) {
      return true;
    }
    return false;
  };

  let isUpdate: boolean;
  if (req.body.isUpdate !== undefined) {
    isUpdate = Boolean(req.body.isUpdate);
  } else if (req.body.action) {
    isUpdate = req.body.action === 'update';
  } else if (req.query.action) {
    isUpdate = req.query.action === 'update';
  } else if (req.query.isUpdate !== undefined) {
    isUpdate = req.query.isUpdate === 'true';
  } else if (!data.id) {
    isUpdate = false;
  } else if (isDraftComposerNewPost(req.body, data.id)) {
    isUpdate = false;
  } else if (data.version === undefined) {
    isUpdate = false;
  } else {
    isUpdate = true;
  }

  const articleId = data.id || ('post_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'));
  const rawSlug = toSafeSlug(slugify(data.title)) || toSafeSlug(articleId) || 'post';
  const idSuffix = toSafeSlug(articleId.slice(-6));
  let slug = idSuffix
    ? `${rawSlug.slice(0, 120 - 1 - idSuffix.length).replace(/-+$/, '')}-${idSuffix}`.replace(/^-+/, '')
    : rawSlug.slice(0, 120);
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) {
    slug = toSafeSlug(articleId).slice(0, 120) || crypto.randomBytes(4).toString('hex');
  }
  const sanitizedContent = sanitizeArticleContent(data.content);
  const excerpt = extractPlainExcerpt(sanitizedContent, 200);
  const now = new Date();

  let neonArticle: any = null;
  let syncError: string | null = null;
  let syncedAt: Date | null = null;
  let rawDbRow: any = null;

  const insertPublishedAt = (data.status === 'published')
    ? (adminPublishedAt ?? adminCreatedAt ?? now)
    : null;
  const insertCreatedAt = adminCreatedAt ?? now;

  if (isNeonConfigured()) {
    const executeInsert = async (slugToUse: string) => {
      const insertSql = `
        INSERT INTO articles (
          id, slug, title, excerpt, content, category, hashtags,
          youtube_url, facebook_url, custom_links,
          image_url, image_url_fallback, image_urls, image_urls_fallback,
          image_position, gallery_positions,
          author_uid, author_name, author_email,
          status, version, sync_pending, created_at, updated_at, published_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10,
          $11, $12, $13, $14,
          $15, $16,
          $17, $18, $19,
          $20, 1, true, $21, $22, $23
        )
        ON CONFLICT (id) DO NOTHING
        RETURNING *;
      `;
      const values = [
        articleId,
        slugToUse,
        data.title,
        excerpt,
        sanitizedContent,
        data.category,
        data.hashtags,
        data.youtubeUrl,
        data.facebookUrl,
        data.customLinks,
        data.imageUrl,
        data.imageUrlFallback,
        data.imageUrls,
        data.imageUrlsFallback,
        data.imagePosition,
        data.galleryPositions,
        user.uid,
        authorName,
        user.email || '',
        data.status,
        insertCreatedAt,
        now,
        insertPublishedAt
      ];
      return query(insertSql, values);
    };

    const runInsert = async () => {
      let dbRes;
      try {
        dbRes = await executeInsert(slug);
      } catch (err: any) {
        if (err?.code === '23505') {
          // Slug UNIQUE constraint violation: retry once with random suffix
          const retryHex = crypto.randomBytes(3).toString('hex');
          slug = `${slug.slice(0, 120 - 1 - retryHex.length).replace(/-+$/, '')}-${retryHex}`.replace(/^-+/, '');
          try {
            dbRes = await executeInsert(slug);
          } catch (retryErr: any) {
            console.error('[Admin API] Neon insert retry error:', retryErr);
            return res.status(500).json({
              success: false,
              error: 'Database insert failed on slug retry. Please try again.'
            });
          }
        } else {
          console.error('[Admin API] Neon insert error:', err);
          return res.status(500).json({
            success: false,
            error: 'Database insert failed. Please try again.'
          });
        }
      }

      if (dbRes.rows.length === 0) {
        // ON CONFLICT (id) DO NOTHING hit an existing row
        return res.status(409).json({
          success: false,
          error: 'An article with this ID already exists',
          code: 'conflict'
        });
      }

      rawDbRow = dbRes.rows[0];
      neonArticle = mapRowToArticle(rawDbRow);
      return null;
    };

    if (isUpdate) {
      const expectedVersion = data.version ?? 1;

      const executeUpdate = async (slugToUse: string) => {
        const updateSql = `
          UPDATE articles SET
            slug = $2,
            title = $3,
            excerpt = $4,
            content = $5,
            category = $6,
            hashtags = $7,
            youtube_url = $8,
            facebook_url = $9,
            custom_links = $10,
            image_url = $11,
            image_url_fallback = $12,
            image_urls = $13,
            image_urls_fallback = $14,
            image_position = $15,
            gallery_positions = $16,
            author_name = $17,
            status = $18,
            version = version + 1,
            sync_pending = true,
            updated_at = $19,
            published_at = CASE
              WHEN $23 = true THEN $24
              WHEN articles.published_at IS NOT NULL THEN articles.published_at
              WHEN $18 = 'published' THEN $19
              ELSE articles.published_at
            END,
            created_at = CASE
              WHEN $25 = true THEN $26
              ELSE articles.created_at
            END
          WHERE id = $1 AND version = $20 AND (author_uid = $21 OR $22)
          RETURNING *;
        `;
        const values = [
          articleId,              // $1
          slugToUse,              // $2
          data.title,             // $3
          excerpt,                // $4
          sanitizedContent,       // $5
          data.category,          // $6
          data.hashtags,          // $7
          data.youtubeUrl,        // $8
          data.facebookUrl,       // $9
          data.customLinks,       // $10
          data.imageUrl,          // $11
          data.imageUrlFallback,  // $12
          data.imageUrls,         // $13
          data.imageUrlsFallback, // $14
          data.imagePosition,     // $15
          data.galleryPositions,  // $16
          authorName,             // $17
          data.status,            // $18
          now,                    // $19
          expectedVersion,        // $20
          user.uid,               // $21
          isAdmin,                // $22
          hasAdminPublishedAt,    // $23
          adminPublishedAt,       // $24
          hasAdminCreatedAt,      // $25
          adminCreatedAt          // $26
        ];
        return query(updateSql, values);
      };

      let dbRes;
      try {
        dbRes = await executeUpdate(slug);
      } catch (err: any) {
        if (err?.code === '23505') {
          // Slug UNIQUE constraint violation: retry once with random suffix
          const retryHex = crypto.randomBytes(3).toString('hex');
          slug = `${slug.slice(0, 120 - 1 - retryHex.length).replace(/-+$/, '')}-${retryHex}`.replace(/^-+/, '');
          try {
            dbRes = await executeUpdate(slug);
          } catch (retryErr: any) {
            console.error('[Admin API] Neon update retry error:', retryErr);
            return res.status(500).json({
              success: false,
              error: 'Database update failed on slug retry. Please try again.'
            });
          }
        } else {
          console.error('[Admin API] Neon update error:', err);
          return res.status(500).json({
            success: false,
            error: 'Database update failed. Please try again.'
          });
        }
      }

      if (dbRes.rows.length === 0) {
        // Re-select the id to determine exact failure condition
        const selectRes = await query('SELECT id, author_uid, version FROM articles WHERE id = $1', [articleId]);
        if (selectRes.rows.length === 0) {
          const isExplicitIsUpdate = req.body.isUpdate !== undefined;
          const isAuthor = !req.body.authorId || req.body.authorId === user.uid || req.body.author_uid === user.uid;
          if (!isExplicitIsUpdate && (isAdmin || isAuthor)) {
            // Safety net: Treat as INSERT instead of returning 404
            const insertErr = await runInsert();
            if (insertErr) return insertErr;
          } else {
            return res.status(404).json({
              success: false,
              error: 'Article not found',
              code: 'not_found'
            });
          }
        } else {
          const existing = selectRes.rows[0];
          if (!isAdmin && existing.author_uid !== user.uid) {
            return res.status(403).json({
              success: false,
              error: 'Forbidden: You can only edit your own articles',
              code: 'forbidden'
            });
          }
          return res.status(409).json({
            success: false,
            error: 'This article was changed elsewhere, please reload',
            code: 'version_conflict',
            serverVersion: existing.version,
            clientVersion: expectedVersion
          });
        }
      } else {
        rawDbRow = dbRes.rows[0];
        neonArticle = mapRowToArticle(rawDbRow);
      }
    } else {
      // INSERT new article
      const insertErr = await runInsert();
      if (insertErr) return insertErr;
    }

  }

  const postPayloadForR2 = {
    id: articleId,
    slug,
    title: data.title,
    content: sanitizedContent,
    excerpt,
    category: data.category,
    hashtags: data.hashtags,
    youtubeUrl: data.youtubeUrl,
    facebookUrl: data.facebookUrl,
    customLinks: data.customLinks,
    imageUrl: data.imageUrl,
    imageUrlFallback: data.imageUrlFallback,
    imageUrls: data.imageUrls,
    imageUrlsFallback: data.imageUrlsFallback,
    imagePosition: data.imagePosition,
    galleryPositions: data.galleryPositions,
    authorId: user.uid,
    authorName,
    authorEmail: '',
    status: data.status,
    version: neonArticle?.version ?? (isUpdate ? (data.version ? data.version + 1 : 2) : 1),
    createdAt: (neonArticle?.createdAt) ?? (adminCreatedAt ? adminCreatedAt.toISOString() : now.toISOString()),
    updatedAt: now.toISOString(),
    publishedAt: (neonArticle?.publishedAt) ?? (insertPublishedAt ? insertPublishedAt.toISOString() : (adminPublishedAt ? adminPublishedAt.toISOString() : null)),
  };

  // Run live Cloudflare D1 edge sync and legacy R2 sync in parallel to minimize latency
  const d1SyncTask = async () => {
    if (!rawDbRow || !isD1SyncConfigured()) return;
    try {
      const d1SyncRes = await syncSingleArticle(rawDbRow);
      if (d1SyncRes.success) {
        syncedAt = new Date();
        await query(
          `UPDATE articles 
           SET sync_pending = false, 
               synced_at = $1, 
               synced_version = version, 
               sync_error = NULL 
           WHERE id = $2`,
          [syncedAt, articleId]
        );
        if (neonArticle) {
          neonArticle.syncPending = false;
          neonArticle.syncedAt = syncedAt.toISOString();
          neonArticle.syncError = null;
        }
      } else {
        syncError = (d1SyncRes.error || 'D1 sync failed').slice(0, 300);
        await query(
          `UPDATE articles 
           SET sync_pending = true, 
               sync_error = $1 
           WHERE id = $2`,
          [syncError, articleId]
        );
        if (neonArticle) {
          neonArticle.syncPending = true;
          neonArticle.syncError = syncError;
        }
      }
    } catch (d1Err: any) {
      syncError = (d1Err?.message || 'D1 sync error').slice(0, 300);
      await query(
        `UPDATE articles 
         SET sync_pending = true, 
             sync_error = $1 
         WHERE id = $2`,
        [syncError, articleId]
      ).catch(() => {});
      if (neonArticle) {
        neonArticle.syncPending = true;
        neonArticle.syncError = syncError;
      }
    }
  };

  const r2SyncTask = async () => {
    if (data.status === 'published') {
      try {
        await saveArticleToR2(postPayloadForR2);
      } catch (r2Err: any) {
        console.warn('[Admin API] Legacy R2 sync warning:', r2Err?.message || r2Err);
      }
    } else if (data.status === 'draft' || data.status === 'archived') {
      try {
        await deleteArticleFromR2(articleId);
      } catch (_) {}
    }
  };

  await Promise.all([d1SyncTask(), r2SyncTask()]);

  // Audit log
  await recordAuditLog(
    user.uid,
    user.email || '',
    isUpdate ? 'article.update' : 'article.create',
    'article',
    articleId,
    { title: data.title, status: data.status, syncError },
    req.ip || ''
  );

  const returnedArticle = neonArticle || postPayloadForR2;

  if (syncError) {
    return res.status(200).json({
      success: true,
      article: returnedArticle,
      synced: false,
      warning: 'Saved. Live sync will retry automatically.',
      syncError
    });
  }

  return res.status(200).json({
    success: true,
    article: returnedArticle,
    synced: true
  });
}

/**
 * GET /api/admin/articles
 * Lists articles with cursor pagination and role filtering.
 */
export async function handleAdminGetArticles(req: Request, res: Response) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const statusParam = (req.query.status as string || '').trim().toLowerCase();
  const limitParam = parseInt(req.query.limit as string, 10);
  const limit = Math.max(1, Math.min(50, isNaN(limitParam) ? 20 : limitParam));
  const cursor = (req.query.cursor as string || '').trim();

  if (isNeonConfigured()) {
    try {
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // Role check: Writers only see their own articles; Admins see all
      if (user.role === 'writer') {
        conditions.push(`author_uid = $${paramIndex++}`);
        params.push(user.uid);
      }

      // Status filter
      if (statusParam && ['draft', 'published', 'archived'].includes(statusParam)) {
        conditions.push(`status = $${paramIndex++}`);
        params.push(statusParam);
      } else if (statusParam === 'live' || statusParam === 'published_only') {
        conditions.push(`status = 'published'`);
      } else {
        // Exclude archived/deleted articles by default
        conditions.push(`status != 'archived'`);
      }

      // Cursor pagination (by updated_at DESC, id DESC)
      if (cursor) {
        try {
          const [cursorTime, cursorId] = cursor.split('_');
          if (cursorTime && cursorId) {
            conditions.push(`(updated_at, id) < ($${paramIndex++}, $${paramIndex++})`);
            params.push(new Date(parseInt(cursorTime, 10)), cursorId);
          }
        } catch (_) {}
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      params.push(limit + 1);
      const querySql = `
        SELECT * FROM articles
        ${whereClause}
        ORDER BY updated_at DESC, id DESC
        LIMIT $${paramIndex};
      `;

      const dbRes = await query(querySql, params);
      const rows = dbRes.rows;
      const hasMore = rows.length > limit;
      const resultRows = hasMore ? rows.slice(0, limit) : rows;

      let nextCursor: string | null = null;
      if (hasMore && resultRows.length > 0) {
        const last = resultRows[resultRows.length - 1];
        nextCursor = `${new Date(last.updated_at).getTime()}_${last.id}`;
      }

      const articles = resultRows.map(mapRowToArticle);

      return res.status(200).json({
        success: true,
        articles,
        hasMore,
        nextCursor,
        count: articles.length
      });
    } catch (err: any) {
      console.error('[Admin API] Get articles Neon error:', err?.message || err);
      // Fall through to fallback
    }
  }

  // Graceful fallback if Neon is not yet provisioned
  try {
    const rawFeed = await getFeedFromR2();
    const localFeed = loadLocalFeed();
    const map = new Map<string, any>();
    for (const p of [...rawFeed, ...localFeed]) {
      if (p && p.id) map.set(p.id, p);
    }
    let articles = Array.from(map.values()).map(p => ({
      ...p,
      syncPending: Boolean(p.syncPending),
      syncError: p.syncError || null,
      publishedAt: p.publishedAt || p.createdAt || null,
    }));

    if (user.role === 'writer') {
      articles = articles.filter(p => p.authorId === user.uid || (p.authorEmail && p.authorEmail.toLowerCase() === (user.email || '').toLowerCase()));
    }

    if (statusParam) {
      articles = articles.filter(p => (p.status || 'published').toLowerCase() === statusParam);
    }

    return res.status(200).json({
      success: true,
      articles: articles.slice(0, limit),
      hasMore: articles.length > limit,
      fallback: true
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to list articles' });
  }
}

/**
 * GET /api/admin/articles/:id
 * Retrieve a single article by ID from Neon (or R2 fallback) for admin/writer editing.
 * Enforces:
 * - 404 { error: 'Article not found', code: 'not_found' } when missing
 * - 403 { error: 'You can only edit your own articles', code: 'forbidden' } when a writer asks for someone else's article
 * - Returns full article from Neon mapped to camelCase Post shape
 */
export async function handleAdminGetArticleById(req: Request, res: Response) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ success: false, error: 'Unauthorized', code: 'no_token' });
  }

  const { id } = req.params;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ success: false, error: 'Article ID is required', code: 'invalid_id' });
  }

  if (isNeonConfigured()) {
    try {
      const result = await query('SELECT * FROM articles WHERE id = $1 LIMIT 1', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Article not found', code: 'not_found' });
      }

      const row = result.rows[0];
      if (user.role === 'writer' && row.author_uid !== user.uid) {
        return res.status(403).json({
          success: false,
          error: 'You can only edit your own articles',
          code: 'forbidden'
        });
      }

      const article = mapRowToArticle(row);
      return res.status(200).json({
        success: true,
        article
      });
    } catch (err: any) {
      console.error('[Admin Articles] Error loading article by ID from Neon:', err);
      return res.status(500).json({ success: false, error: 'Failed to query database', code: 'db_error' });
    }
  }

  // Fallback if Neon is not yet configured: load from R2 / local disk
  try {
    const post = await getArticleFromR2(id);
    if (!post) {
      return res.status(404).json({ success: false, error: 'Article not found', code: 'not_found' });
    }
    if (user.role === 'writer' && post.authorId && post.authorId !== user.uid) {
      return res.status(403).json({
        success: false,
        error: 'You can only edit your own articles',
        code: 'forbidden'
      });
    }
    return res.status(200).json({
      success: true,
      article: {
        ...post,
        version: post.version || 1,
        status: post.status || 'published'
      }
    });
  } catch (err: any) {
    console.error('[Admin Articles] Error in R2 fallback for article by ID:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve article', code: 'storage_error' });
  }
}

/**
 * DELETE /api/admin/articles/:id
 * Soft-delete an article (admin only, or writer for their own draft).
 */
export async function handleAdminDeleteArticle(req: Request, res: Response) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const id = req.params.id;
  if (!id) {
    return res.status(400).json({ success: false, error: 'Article ID required' });
  }

  if (isNeonConfigured()) {
    try {
      const checkRes = await query('SELECT id, author_uid, status FROM articles WHERE id = $1', [id]);
      if (checkRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Article not found' });
      }

      const article = checkRes.rows[0];

      // Permission check: Writer can only delete their own DRAFTS; Admins can delete anything
      if (user.role === 'writer') {
        if (article.author_uid !== user.uid) {
          return res.status(403).json({ success: false, error: 'Forbidden: Writers may only delete their own articles' });
        }
        if (article.status !== 'draft') {
          return res.status(403).json({ success: false, error: 'Forbidden: Only administrators can archive published articles' });
        }
      }

      // Soft delete: status = 'archived', sync_pending = true, version = version + 1
      await query(
        `UPDATE articles 
         SET status = 'archived', 
             version = version + 1, 
             sync_pending = true, 
             updated_at = now() 
         WHERE id = $1`,
        [id]
      );

      // Unpublish from D1 reader table
      try {
        const unpubRes = await unpublishArticleFromD1(id);
        if (unpubRes.success) {
          await query(
            `UPDATE articles 
             SET sync_pending = false, 
                 synced_at = now(), 
                 synced_version = version, 
                 sync_error = NULL 
             WHERE id = $1`,
            [id]
          );
        } else {
          await query(
            `UPDATE articles 
             SET sync_pending = true, 
                 sync_error = $1 
             WHERE id = $2`,
            [(unpubRes.error || 'Failed to unpublish from D1').slice(0, 300), id]
          );
        }
      } catch (d1Err: any) {
        await query(
          `UPDATE articles 
           SET sync_pending = true, 
               sync_error = $1 
           WHERE id = $2`,
          [(d1Err?.message || 'D1 unpublish error').slice(0, 300), id]
        ).catch(() => {});
      }

      // Legacy R2 removal
      if (article.status === 'published') {
        await deleteArticleFromR2(id);
      }

      await recordAuditLog(
        user.uid,
        user.email || '',
        'article.delete',
        'article',
        id,
        { previousStatus: article.status },
        req.ip || ''
      );

      return res.status(200).json({
        success: true,
        message: 'Article archived successfully'
      });
    } catch (err: any) {
      console.error('[Admin API] Delete article error:', err?.message || err);
      return res.status(500).json({ success: false, error: err?.message || 'Failed to delete article' });
    }
  }

  // Fallback: delete from R2 and local mirror
  await deleteArticleFromR2(id);
  return res.status(200).json({ success: true, message: 'Article removed' });
}

/**
 * GET /api/admin/me
 * Returns authenticated staff identity and role, and automatically syncs the user to Neon.
 */
export async function handleAdminGetMe(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized', code: 'no_token' });
  }

  // Automatically record / sync logged in user into Neon database (staff table)
  if (req.user.uid && req.user.email && isNeonConfigured()) {
    const role = req.user.role === 'writer' ? 'writer' : 'admin';
    query(
      `INSERT INTO staff (uid, email, role, pen_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (uid) DO UPDATE
         SET email = EXCLUDED.email,
             role = EXCLUDED.role,
             pen_name = COALESCE(EXCLUDED.pen_name, staff.pen_name)`,
      [req.user.uid, req.user.email, role, req.user.name || null]
    ).catch(err => console.debug('[Neon Staff Sync on Me]:', err?.message));
  }

  return res.status(200).json({
    success: true,
    uid: req.user.uid,
    role: req.user.role,
    email: req.user.email
  });
}

/**
 * POST /api/users/sync and POST /api/admin/users/sync
 * Authenticated endpoint called upon login or sign-in to guarantee user is stored in staff table.
 * Ignores uid, email and role from request body. Uses only verified token values.
 * Only writes the caller's own row in the staff table.
 * Role stored must be exactly the token role ('admin' or 'writer'), never defaulting to admin.
 * Returns 400 if the token has no email.
 */
export async function handleUserSync(req: Request, res: Response) {
  let userUid = req.user?.uid;
  let userEmail = req.user?.email;
  let userRole = req.user?.role;
  let userName = req.user?.name;

  // If request has not already passed requireRole middleware, verify Bearer token directly
  if (!userUid) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Missing token', code: 'no_token' });
    }
    const token = authHeader.substring(7).trim();
    if (!token) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Empty token', code: 'no_token' });
    }
    try {
      const decoded = await verifyFirebaseTokenSafely(token);
      userUid = decoded.uid;
      userEmail = decoded.email;
      userRole = decoded.role;
      userName = decoded.name || decoded.displayName;
    } catch (err: any) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid token', code: 'invalid_token' });
    }
  }

  // Strictly use token values only; ignore req.body uid, email, and role
  const uid = userUid;
  const email = (userEmail || '').trim().toLowerCase();
  const role = userRole; // Exactly the token role, never defaulting to admin

  if (!email) {
    return res.status(400).json({ success: false, error: 'Token has no email address' });
  }

  if (role !== 'admin' && role !== 'writer') {
    return res.status(403).json({ success: false, error: 'Forbidden: Valid staff role required (admin or writer)' });
  }

  const penName = req.body?.displayName || req.body?.penName || userName || null;

  if (isNeonConfigured()) {
    try {
      // Only write the caller's own row in the staff table
      const canAccessStaff = await hasTablePrivilege('staff', 'INSERT');
      if (canAccessStaff) {
        await query(
          `INSERT INTO staff (uid, email, role, pen_name)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (uid) DO UPDATE
             SET email = EXCLUDED.email,
                 role = EXCLUDED.role,
                 pen_name = COALESCE(EXCLUDED.pen_name, staff.pen_name)`,
          [uid, email, role, penName]
        );
      }
    } catch (err: any) {
      console.warn('[Neon Users] Sync notice:', err?.message || err);
      return res.status(500).json({ success: false, error: err?.message || 'Database error during staff sync' });
    }
  }

  return res.json({ success: true, message: 'User synced successfully.' });
}

export const handleAdminSyncUser = handleUserSync;

/**
 * GET /api/admin/users
 * Returns all registered/logged-in users from Firebase Authentication and Neon database.
 */
export async function handleAdminGetUsers(_req: Request, res: Response) {
  const userMap = new Map<string, {
    id: string;
    email: string;
    role: string;
    displayName: string;
    lastLoginAt?: string;
    createdAt?: string;
  }>();

  // 1. Fetch all users from Firebase Authentication (if Firebase Admin has credentials)
  try {
    if (adminAuth) {
      const list = await adminAuth.listUsers(1000);
      for (const u of (list.users || [])) {
        if (u.email) {
          const emailLower = u.email.toLowerCase();
          const role = (u.customClaims?.role as string) || 'reader';
          userMap.set(emailLower, {
            id: u.uid,
            email: emailLower,
            role,
            displayName: u.displayName || '',
            lastLoginAt: u.metadata?.lastSignInTime || u.metadata?.creationTime,
            createdAt: u.metadata?.creationTime,
          });
        }
      }
    }
  } catch (fbErr: any) {
    console.debug('[handleAdminGetUsers] Firebase Admin listUsers notice:', fbErr?.message || fbErr);
  }

  // 2. Query Neon Database users table & staff table
  if (isNeonConfigured()) {
    try {
      const canSelectUsers = await hasTablePrivilege('users', 'SELECT');
      if (canSelectUsers) {
        const dbUsers = await query<{
          uid: string;
          email: string;
          role: string;
          display_name: string | null;
          last_login_at: string;
          created_at: string;
        }>(`
          SELECT uid, email, role, display_name, last_login_at, created_at
          FROM users
          ORDER BY last_login_at DESC NULLS LAST
          LIMIT 1000
        `);

        for (const r of (dbUsers.rows || [])) {
          if (!r.email) continue;
          const emailLower = r.email.toLowerCase();
          const existing = userMap.get(emailLower);
          if (existing) {
            if (r.display_name && !existing.displayName) existing.displayName = r.display_name;
            if (r.role && r.role !== 'reader') existing.role = r.role;
            if (r.last_login_at) existing.lastLoginAt = r.last_login_at;
          } else {
            userMap.set(emailLower, {
              id: r.uid,
              email: emailLower,
              role: r.role || 'reader',
              displayName: r.display_name || '',
              lastLoginAt: r.last_login_at || r.created_at,
              createdAt: r.created_at,
            });
          }
        }
      }

      // Also incorporate staff table if present and accessible
      const canSelectStaff = await hasTablePrivilege('staff', 'SELECT');
      if (canSelectStaff) {
        const staffUsers = await query<{
          uid: string;
          email: string;
          role: string;
          pen_name: string | null;
          created_at: string;
        }>(`
          SELECT uid, email, role, pen_name, created_at
          FROM staff
          ORDER BY created_at DESC
          LIMIT 500
        `);

        for (const r of (staffUsers.rows || [])) {
          if (!r.email) continue;
          const emailLower = r.email.toLowerCase();
          const existing = userMap.get(emailLower);
          if (existing) {
            if (r.role) existing.role = r.role;
            if (r.pen_name && !existing.displayName) existing.displayName = r.pen_name;
          } else {
            userMap.set(emailLower, {
              id: r.uid,
              email: emailLower,
              role: r.role || 'writer',
              displayName: r.pen_name || '',
              lastLoginAt: r.created_at,
              createdAt: r.created_at,
            });
          }
        }
      }
    } catch (err: any) {
      console.warn('[handleAdminGetUsers] Database query notice:', err?.message || err);
    }
  }

  const users = Array.from(userMap.values()).sort((a, b) => {
    const timeA = new Date(a.lastLoginAt || a.createdAt || 0).getTime();
    const timeB = new Date(b.lastLoginAt || b.createdAt || 0).getTime();
    return timeB - timeA;
  });

  return res.json({
    success: true,
    count: users.length,
    users
  });
}

/**
 * DELETE /api/admin/users/:email
 * Removes a user/subscriber email from Neon database and Firebase Auth.
 */
export async function handleAdminDeleteUser(req: Request, res: Response) {
  const email = (req.params.email || req.body?.email || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email parameter is required' });
  }

  // An admin must not be able to delete their own account
  const callerEmail = (req.user?.email || '').trim().toLowerCase();
  const callerUid = (req.user?.uid || '').trim();
  if ((callerEmail && email === callerEmail) || (callerUid && email === callerUid.toLowerCase())) {
    return res.status(400).json({ success: false, error: 'An admin cannot delete their own account' });
  }

  // 1. Delete the staff row (and optional tables if accessible)
  if (isNeonConfigured()) {
    try {
      if (await hasTablePrivilege('staff', 'DELETE')) {
        await query('DELETE FROM staff WHERE lower(email) = $1 OR uid = $1', [email]);
      }
      if (await hasTablePrivilege('users', 'DELETE')) {
        await query('DELETE FROM users WHERE lower(email) = $1 OR uid = $1', [email]);
      }
      if (await hasTablePrivilege('subscribers', 'DELETE')) {
        await query('DELETE FROM subscribers WHERE lower(email) = $1', [email]);
      }
    } catch (err: any) {
      console.error('[Neon Users] Delete error:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Failed to delete user' });
    }
  }

  // 2. Look up the Firebase user by email with adminAuth.getUserByEmail, remove role claim and revoke refresh tokens
  let targetUid: string | null = null;
  if (adminAuth) {
    try {
      const userRecord = await adminAuth.getUserByEmail(email).catch(() => null);
      if (userRecord) {
        targetUid = userRecord.uid;
        if (callerUid && targetUid === callerUid) {
          return res.status(400).json({ success: false, error: 'An admin cannot delete their own account' });
        }
        await adminAuth.setCustomUserClaims(userRecord.uid, { role: null });
        await adminAuth.revokeRefreshTokens(userRecord.uid);
      }
    } catch (fbErr: any) {
      console.debug('[handleAdminDeleteUser] Firebase Auth notice:', fbErr?.message || fbErr);
    }
  }

  // 3. Record an audit log entry like the other admin actions
  await recordAuditLog(
    req.user?.uid || '',
    req.user?.email || '',
    'user.delete',
    'staff',
    email,
    { targetEmail: email, targetUid },
    req.ip || ''
  );

  return res.json({ success: true, message: `User ${email} removed successfully.` });
}

/**
 * POST /api/admin/sync/run
 * Requires admin role. Processes up to 50 pending outbox rows oldest first.
 */
export async function handleAdminRunSync(req: Request, res: Response) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Forbidden: Admin role required' });
  }

  if (!isD1SyncConfigured()) {
    return res.status(200).json({
      success: true,
      message: 'D1 edge sync skipped: SYNC_SECRET or WORKER_BASE_URL is not configured yet.',
      processed: 0,
      succeeded: 0,
      failed: 0,
    });
  }

  try {
    const result = await syncPendingArticles(50);
    return res.status(200).json({
      success: true,
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
    });
  } catch (err: any) {
    console.error('[Admin API] Run sync error:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Sync failed: ' + (err?.message || 'Internal error') });
  }
}

/**
 * POST /api/admin/sync-tick
 * Cloud Scheduler trigger. NOT behind requireRole; requires header X-Sync-Token matching
 * SYNC_TICK_TOKEN in constant time.
 */
export async function handleAdminSyncTick(req: Request, res: Response) {
  const syncTokenHeader = req.headers['x-sync-token'] || req.headers['X-Sync-Token'];
  const expectedToken = (process.env.SYNC_TICK_TOKEN || '').trim();

  if (!expectedToken || typeof syncTokenHeader !== 'string') {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const bufA = Buffer.from(syncTokenHeader);
  const bufB = Buffer.from(expectedToken);
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const result = await syncPendingArticles(50);
    return res.status(200).json({
      success: true,
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
    });
  } catch (err: any) {
    console.error('[Admin API] Sync tick error:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Sync tick failed' });
  }
}
