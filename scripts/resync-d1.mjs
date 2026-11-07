#!/usr/bin/env node
/**
 * scripts/resync-d1.mjs
 * 
 * Performs a complete reconciliation between Neon PostgreSQL (source of truth)
 * and Cloudflare D1 (edge reader replica).
 * 
 * Usage:
 *   node scripts/resync-d1.mjs [--dry-run]
 * 
 * Environment variables:
 *   NEON_DATABASE_URL or DATABASE_URL
 *   SYNC_SECRET
 *   WORKER_BASE_URL (default: https://api.currentnews.blog)
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'node:dotenv';
import pg from 'pg';

const { Client } = pg;

// Load environment variables
dotenv.config();
const envLocal = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envLocal)) {
  dotenv.config({ path: envLocal });
}

const isDryRun = process.argv.includes('--dry-run');
const connectionString = (process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || '').trim();
const syncSecret = (process.env.SYNC_SECRET || '').trim();
const workerBaseUrl = (process.env.WORKER_BASE_URL || 'https://api.currentnews.blog').replace(/\/+$/, '');

console.log('\n======================================================');
console.log(' CURRENT NEWS - Neon to Cloudflare D1 Full Resync');
console.log(` Mode: ${isDryRun ? 'DRY RUN (no changes applied)' : 'LIVE EXECUTION'}`);
console.log(` Worker Base URL: ${workerBaseUrl}`);
console.log('======================================================\n');

if (!connectionString) {
  console.error('[ERROR] NEON_DATABASE_URL (or DATABASE_URL) is not set in environment or .env');
  process.exit(1);
}

if (!syncSecret && !isDryRun) {
  console.error('[ERROR] SYNC_SECRET is not set in environment or .env');
  process.exit(1);
}

async function signedPost(endpoint, body) {
  const url = `${workerBaseUrl}${endpoint}`;
  const rawBody = JSON.stringify(body);
  const timestamp = Date.now().toString();

  const hmac = crypto.createHmac('sha256', syncSecret);
  hmac.update(`${timestamp}.${rawBody}`);
  const signature = hmac.digest('hex');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Timestamp': timestamp,
      'X-Signature': signature,
    },
    body: rawBody,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Worker returned HTTP ${res.status}: ${text}`);
  }

  return await res.json();
}

function mapRowToD1Article(row) {
  const parseArray = (val) => {
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

  const toEpoch = (val) => {
    if (!val) return Date.now();
    const d = new Date(val);
    const t = d.getTime();
    return isNaN(t) ? Date.now() : t;
  };

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
    publishedAt: toEpoch(row.published_at || row.created_at),
    updatedAt: toEpoch(row.updated_at),
    version: Number(row.version) || 1,
  };
}

async function run() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('[1/4] Connected to Neon PostgreSQL.');

    const res = await client.query(
      `SELECT * FROM articles 
       WHERE status = 'published' 
       ORDER BY published_at DESC, id DESC`
    );

    const publishedRows = res.rows || [];
    const totalNeonPublished = publishedRows.length;
    console.log(`[2/4] Retrieved ${totalNeonPublished} published articles from Neon.`);

    if (totalNeonPublished === 0) {
      console.error('\n[SAFETY ABORT] Neon returned 0 published articles.');
      console.error('Refusing to reconcile D1 because this would wipe all reader articles.\n');
      process.exit(1);
    }

    const d1Articles = publishedRows.map(mapRowToD1Article);
    const allIds = d1Articles.map((a) => a.id);

    console.log(`[3/4] Streaming articles to D1 in batches of 25...`);
    const BATCH_SIZE = 25;
    let syncedCount = 0;

    for (let i = 0; i < d1Articles.length; i += BATCH_SIZE) {
      const batch = d1Articles.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(d1Articles.length / BATCH_SIZE);

      if (isDryRun) {
        console.log(`  [DRY-RUN] Batch ${batchNum}/${totalBatches}: ${batch.length} articles (e.g. ${batch[0].id})`);
        syncedCount += batch.length;
      } else {
        process.stdout.write(`  Syncing batch ${batchNum}/${totalBatches} (${batch.length} items)... `);
        const result = await signedPost('/internal/bulk', { articles: batch });
        console.log(`OK (count: ${result.count})`);
        syncedCount += batch.length;
      }
    }

    console.log(`[4/4] Reconciling orphaned articles in D1...`);
    let deletedCount = 0;

    if (isDryRun) {
      console.log(`  [DRY-RUN] Would call /internal/reconcile with ${allIds.length} valid article IDs.`);
    } else {
      process.stdout.write(`  Reconciling D1 against ${allIds.length} canonical IDs... `);
      const reconcileRes = await signedPost('/internal/reconcile', { ids: allIds });
      deletedCount = reconcileRes.deleted || 0;
      console.log(`OK (deleted ${deletedCount} obsolete articles)`);
    }

    console.log('\n======================================================');
    console.log(' RESYNC SUMMARY');
    console.log('======================================================');
    console.log(` Neon Published Articles: ${totalNeonPublished}`);
    console.log(` Synced to D1:           ${syncedCount}`);
    console.log(` Pruned from D1:         ${deletedCount}`);
    console.log(` Status:                 SUCCESS`);
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n[FATAL ERROR during resync]:', err?.message || err);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

run();
