import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { query, isNeonConfigured } from '../server/db/neon.ts';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).send('Method Not Allowed');
  }

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=59');

  if (req.method === 'HEAD') {
    return res.status(200).end();
  }

  try {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    // Always prefer the canonical domain with www to avoid redirect loops
    const host = req.headers.host || 'www.currentnews.blog';
    const siteUrl = `${protocol}://${host.includes('localhost') ? host : 'www.currentnews.blog'}`;

    let items: any[] = [];

    // 1. Fetch published articles from Neon PostgreSQL (primary system-of-record)
    if (isNeonConfigured()) {
      try {
        const dbRes = await query<{
          id: string;
          slug: string | null;
          title: string;
          content: string;
          category: string | null;
          created_at: string;
          updated_at: string;
          published_at: string | null;
        }>(
          `SELECT id, slug, title, content, category, created_at, updated_at, published_at
           FROM articles
           WHERE status = 'published'
           ORDER BY COALESCE(published_at, created_at) DESC
           LIMIT 100`
        );
        if (dbRes.rows && dbRes.rows.length > 0) {
          items = dbRes.rows.map(r => ({
            id: r.id,
            slug: r.slug,
            title: r.title,
            content: r.content,
            category: r.category,
            createdAt: r.published_at || r.created_at,
            updatedAt: r.updated_at,
            status: 'published'
          }));
        }
      } catch (dbErr) {
        console.warn('[Sitemap] Neon articles query notice:', dbErr);
      }
    }

    // 2. Fallback to Firestore REST if Neon is empty or not configured
    if (items.length === 0) {
      try {
        let projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '';
        let firestoreDatabaseId = process.env.FIRESTORE_DATABASE_ID || process.env.VITE_FIREBASE_DATABASE_ID || '';

        try {
          const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
          if (fs.existsSync(configPath)) {
            const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            projectId = projectId || cfg.projectId || '';
            firestoreDatabaseId = firestoreDatabaseId || cfg.firestoreDatabaseId || '(default)';
          }
        } catch (_) {}

        const config = {
          projectId: projectId || '(default)',
          firestoreDatabaseId: firestoreDatabaseId || '(default)'
        };

        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents:runQuery`;
        const queryBody = {
          structuredQuery: {
            from: [{ collectionId: "posts" }],
            orderBy: [{ field: { fieldPath: "createdAt" }, direction: "DESCENDING" }]
          }
        };

        const response = await fetch(firestoreUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(queryBody)
        });

        if (response.ok) {
          const queryResult = await response.json();
          const parseFirestoreFields = (fields: any) => {
            const result: any = {};
            if (!fields) return result;
            for (const key of Object.keys(fields)) {
              const valObj = fields[key];
              if ('stringValue' in valObj) {
                result[key] = valObj.stringValue;
              } else if ('timestampValue' in valObj) {
                result[key] = valObj.timestampValue;
              } else if ('integerValue' in valObj) {
                result[key] = parseInt(valObj.integerValue, 10);
              } else if ('booleanValue' in valObj) {
                result[key] = valObj.booleanValue;
              }
            }
            return result;
          };

          if (Array.isArray(queryResult)) {
            for (const item of queryResult) {
              if (item.document) {
                const fields = parseFirestoreFields(item.document.fields);
                const id = item.document.name.split("/").pop();
                if (!fields.status || fields.status === 'published') {
                  items.push({ id, ...fields });
                }
              }
            }
          }
        }
      } catch (fetchErr) {
        console.warn('Failed to fetch posts for sitemap from Firestore REST, using fallback:', fetchErr);
      }
    }

    const escapeXml = (unsafe: string) => {
      return (unsafe || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const slugify = (text: string) => {
      return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
    };

    const todayIso = new Date().toISOString().split('T')[0];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <lastmod>${todayIso}</lastmod>
    <changefreq>always</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${siteUrl}/?category=Jharkhand</loc>
    <lastmod>${todayIso}</lastmod>
    <changefreq>always</changefreq>
    <priority>0.95</priority>
  </url>
  <url>
    <loc>${siteUrl}/about</loc>
    <lastmod>${todayIso}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${siteUrl}/editorial-policy</loc>
    <lastmod>${todayIso}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${siteUrl}/contact</loc>
    <lastmod>${todayIso}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${siteUrl}/privacy</loc>
    <lastmod>${todayIso}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${siteUrl}/terms</loc>
    <lastmod>${todayIso}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
`;

    for (const post of items) {
      const slug = slugify(post.title || '');
      const postUrl = slug ? `${siteUrl}/post/${post.id}/${slug}` : `${siteUrl}/post/${post.id}`;
      let lastmod = todayIso;
      let pubDateIso = new Date().toISOString();
      if (post.updatedAt || post.createdAt) {
        try {
          const d = new Date(post.updatedAt || post.createdAt);
          if (!isNaN(d.getTime())) {
            lastmod = d.toISOString().split('T')[0];
            pubDateIso = d.toISOString();
          }
        } catch {
          // fallback
        }
      }

      const isJharkhand = /jharkhand|ranchi|dhanbad|jamshedpur|bokaro|deoghar/i.test(`${post.title} ${post.category || ''} ${post.content || ''}`);
      const newsKeywords = isJharkhand
        ? 'news near Jharkhand, Jharkhand news, Ranchi news, India news'
        : 'breaking news, current news, live reporting';

      xml += `  <url>
    <loc>${escapeXml(postUrl)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
    <news:news>
      <news:publication>
        <news:name>Current News Live</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${pubDateIso}</news:publication_date>
      <news:title>${escapeXml(post.title || 'Breaking Dispatch')}</news:title>
      <news:keywords>${escapeXml(newsKeywords)}</news:keywords>
    </news:news>
  </url>
`;
    }

    xml += `</urlset>`;

    return res.status(200).send(xml);
  } catch (err: any) {
    console.error('Sitemap generation error:', err);
    res.setHeader('Content-Type', 'text/plain');
    return res.status(500).send(`Unable to generate sitemap: ${err.message}`);
  }
}
