import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import multer from 'multer';

// Modular route handlers
import sendAlertHandler from './api/mail/send-alert.ts';
import inboundHandler from './api/mail/inbound.ts';
import rssHandler from './api/rss.xml.ts';
import adsHandler from './api/ads.txt.ts';
import appAdsHandler from './api/app-ads.txt.ts';
import sitemapHandler from './api/sitemap.xml.ts';
import { handleR2Upload } from './src/server/r2Upload.ts';
import { handleSocialPreview } from './src/server/socialPreview.ts';
import {
  handleGetVapidPublicKey,
  handleSubscribe,
  handleUnsubscribe,
  handleBroadcast,
  handleGetSubscribersCount
} from './src/server/pushNotifications.ts';
import { handleGetPosts, handleGetPostById, handleGetWriters } from './src/server/postsApi.ts';
import { handleSaveArticle, handleDeleteArticle, handleSyncArticles, handleMigrateImages, ensureR2ArticlesWarmup, getFeedFromR2, getDeletedArticleIds } from './src/server/r2Articles.ts';
import { handleGetAppVersion, handleUpdateAppVersion } from './src/server/appVersionApi.ts';
import { requireRole } from './server/auth/requireRole.ts';
import { logFirebaseAdminProjectId } from './server/auth/firebaseAdmin.ts';
import {
  handleAdminCreateOrUpdateArticle,
  handleAdminGetArticles,
  handleAdminGetArticleById,
  handleAdminDeleteArticle,
  handleAdminGetMe,
  handleAdminRunSync,
  handleAdminSyncTick
} from './server/api/adminArticles.ts';

// Load environment variables
dotenv.config();

// Helper to safely execute async route handlers with standard error catching
const asyncHandler = (handler: any) => {
  return async (req: express.Request, res: express.Response) => {
    try {
      await handler(req, res);
    } catch (error: any) {
      console.error('Error in route handler:', error);
      if (!res.headersSent) {
        res.status(500).send(error?.message || 'Internal Server Error');
      }
    }
  };
};

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Trust proxy headers for Google Cloud Load Balancer (GCLB) and Cloudflare Anycast CDN
  app.set('trust proxy', true);

  // Health-check (liveness) endpoint for Google Cloud Run / Container orchestrators
  app.get('/healthz', (_req, res) => {
    res.status(200).type('text/plain; charset=utf-8').send('OK');
  });

  // Readiness probe endpoint for Google Cloud Load Balancer (GCLB) backend health checks
  app.get('/readyz', (_req, res) => {
    const memory = process.memoryUsage();
    res.status(200).json({
      status: 'ready',
      uptimeSec: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      heapUsedMb: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
      service: 'currentnews-web-applet',
      platform: 'google-cloud-run',
    });
  });

  // Client load balancer telemetry status endpoint
  app.get('/api/lb/status', (_req, res) => {
    res.status(200).json({
      status: 'healthy',
      node: 'gcp-cloud-run-primary',
      region: process.env.K_REVISION ? 'gcp-serverless' : 'local-node',
      uptime: process.uptime(),
      timestamp: Date.now(),
    });
  });

  // Multi-Host Routing & Admin Segregation (admin.currentnews.blog vs reader apex/www)
  app.use((req, res, next) => {
    const rawHost = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
    const host = rawHost.split(':')[0].trim().toLowerCase();
    const pathName = req.path || '';

    // Development & Cloud Run test URL bypass (localhost, 127.0.0.1, ::1, and *.run.app)
    const isDevOrPreview = !host ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.endsWith('.run.app');

    if (isDevOrPreview) {
      return next();
    }

    // 1. Host: admin.currentnews.blog (Dedicated Admin Workspace)
    if (host === 'admin.currentnews.blog') {
      // Inject X-Robots-Tag to ensure zero indexing of the administrative portal
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');

      // Do not cache any admin page or admin API response
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      // Allow GET /healthz and /readyz on the admin host
      if (pathName === '/healthz' || pathName === '/readyz') {
        return next();
      }

      // Any path that starts with /api/ and is not /api/admin/* must return a JSON 404 { error: "Not found" }, never a redirect to /admin and never HTML
      if (pathName.startsWith('/api/')) {
        if (pathName === '/api/admin' || pathName.startsWith('/api/admin/')) {
          return next();
        }
        return res.status(404).json({ error: 'Not found' });
      }

      // Allow admin paths and static assets
      const isAllowedAdminPath = 
        pathName === '/admin' ||
        pathName.startsWith('/admin/') ||
        pathName === '/signin' ||
        pathName === '/login' ||
        pathName === '/privacy' ||
        pathName === '/terms' ||
        pathName.startsWith('/assets') ||
        pathName.startsWith('/@vite') ||
        pathName.startsWith('/@fs') ||
        pathName.startsWith('/@id') ||
        pathName.startsWith('/src') ||
        pathName.startsWith('/img') ||
        pathName.startsWith('/uploads') ||
        pathName.startsWith('/.well-known') ||
        pathName === '/favicon.ico' ||
        pathName === '/robots.txt';

      if (!isAllowedAdminPath) {
        return res.redirect(302, '/admin');
      }

      return next();
    }

    // 2. Host: currentnews.blog or www.currentnews.blog (Public Reader Site)
    if (host === 'currentnews.blog' || host === 'www.currentnews.blog') {
      // Redirect all admin panel visits (301 permanent) to the dedicated admin host
      if (pathName === '/admin' || pathName.startsWith('/admin/')) {
        const targetUrl = `https://admin.currentnews.blog${req.originalUrl || '/admin'}`;
        return res.redirect(301, targetUrl);
      }

      // Shield admin API endpoints: return 404 JSON if called on public reader host
      if (pathName === '/api/admin' || pathName.startsWith('/api/admin/')) {
        return res.status(404).json({
          success: false,
          error: 'Not found'
        });
      }
    }

    return next();
  });

  // Enable JSON and URL-encoded request body parsing
  // Dedicated 25MB parser exclusively for bulk article sync
  app.use('/api/articles/sync', express.json({ limit: '25mb' }));
  // Strict 1MB body limit for admin and all other routes to thwart DoS memory exhaustion
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Configure Multer for Cloudflare R2 image upload (20MB max, flexible image types and extensions)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB max file size
    },
    fileFilter: (_req, file, cb) => {
      const isImageMime = file.mimetype && (
        file.mimetype.startsWith('image/') ||
        file.mimetype === 'application/octet-stream' ||
        file.mimetype === 'application/x-zip-compressed' ||
        file.mimetype === 'binary/octet-stream'
      );
      const hasImageExt = /\.(jpe?g|png|webp|gif|svg|bmp|tiff|heic|heif|avif)$/i.test(file.originalname || '');

      if (isImageMime || hasImageExt) {
        cb(null, true);
      } else {
        cb(new Error(`Only image files (JPEG, PNG, WebP, GIF, SVG, AVIF, HEIC) are permitted. Received: ${file.mimetype || 'unknown'}`));
      }
    },
  });

  // Cloudflare R2 image upload endpoint (Protected with requireRole)
  app.post('/api/upload', requireRole('admin', 'writer'), (req, res) => {
    upload.single('image')(req, res, (err: any) => {
      if (err) {
        console.error('[Upload Middleware Error]:', err);
        const isLimit = err.code === 'LIMIT_FILE_SIZE';
        const msg = isLimit
          ? 'Image file size exceeds the 20MB limit. Please select a smaller photo.'
          : (err.message || 'Failed to process image upload.');
        return res.status(400).json({
          success: false,
          error: msg,
        });
      }
      handleR2Upload(req, res);
    });
  });

  // Admin API endpoints (Neon Postgres editorial source of truth + audit log)
  app.post('/api/admin/articles', requireRole('admin', 'writer'), asyncHandler(handleAdminCreateOrUpdateArticle));
  app.get('/api/admin/articles', requireRole('admin', 'writer'), asyncHandler(handleAdminGetArticles));
  app.get('/api/admin/articles/:id', requireRole('admin', 'writer'), asyncHandler(handleAdminGetArticleById));
  app.delete('/api/admin/articles/:id', requireRole('admin', 'writer'), asyncHandler(handleAdminDeleteArticle));
  app.get('/api/admin/me', requireRole('admin', 'writer'), asyncHandler(handleAdminGetMe));
  app.post('/api/admin/sync/run', requireRole('admin'), asyncHandler(handleAdminRunSync));
  app.post('/api/admin/sync-tick', asyncHandler(handleAdminSyncTick));

  // High-performance Cloudflare R2 articles endpoints (zero Firestore read quota consumption)
  app.get('/api/posts', asyncHandler(handleGetPosts));
  app.get('/api/posts/:id', asyncHandler(handleGetPostById));
  app.get('/api/articles/feed', asyncHandler(async (_req: express.Request, res: express.Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const feed = await getFeedFromR2();
    res.json({ success: true, articles: feed });
  }));
  app.get('/api/articles/deleted', asyncHandler(async (_req: express.Request, res: express.Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const deleted = Array.from(getDeletedArticleIds());
    res.json({ success: true, deletedIds: deleted });
  }));

  // Protected write endpoints for articles
  app.post('/api/articles/save', requireRole('admin', 'writer'), asyncHandler(handleSaveArticle));
  app.delete('/api/articles/:id', requireRole('admin', 'writer'), asyncHandler(handleDeleteArticle));
  app.post('/api/articles/sync', requireRole('admin', 'writer'), asyncHandler(handleSyncArticles));
  app.post('/api/articles/migrate-images', requireRole('admin', 'writer'), asyncHandler(handleMigrateImages));
  app.get('/api/writers', asyncHandler(handleGetWriters));
  app.use('/img', express.static(path.join(process.cwd(), 'data', 'img'), { maxAge: '1y', immutable: true }));

  // Server-driven App Update endpoints (Google Play Store / Cloud Run dynamic update triggers)
  app.get('/api/app/version', asyncHandler(handleGetAppVersion));
  app.post('/api/app/version', requireRole('admin'), asyncHandler(handleUpdateAppVersion));

  // Backend mail endpoint for automated subscriber alerting (Protected with requireRole)
  app.post('/api/mail/send-alert', requireRole('admin', 'writer'), asyncHandler(sendAlertHandler));

  // Inbound mail endpoint for webhook notifications and recipient autofill
  app.all('/api/mail/inbound', asyncHandler(inboundHandler));

  // Dynamically serve dynamic XML Sitemap endpoint
  app.all('/sitemap.xml', asyncHandler(sitemapHandler));

  // Dynamically serve dynamic RSS Feed endpoint
  app.all('/rss.xml', asyncHandler(rssHandler));

  // Serve the ads.txt file
  app.all('/ads.txt', asyncHandler(adsHandler));

  // Serve the app-ads.txt file for Google AdMob app verification
  app.all('/app-ads.txt', asyncHandler(appAdsHandler));

  // Explicitly serve robots.txt with text/plain
  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain; charset=utf-8').sendFile(path.join(process.cwd(), 'public', 'robots.txt'));
  });

  // Explicitly serve Android App Links Digital Asset Links JSON (.well-known/assetlinks.json)
  app.get(['/.well-known/assetlinks.json', '/.well-known/assetlinks'], (_req, res) => {
    res.type('application/json').sendFile(path.join(process.cwd(), 'public', '.well-known', 'assetlinks.json'));
  });

  // Automated Push Notification API routes (100% background alerts to Android devices & browsers)
  app.get('/api/push/public-key', handleGetVapidPublicKey);
  app.post('/api/push/subscribe', handleSubscribe);
  app.post('/api/push/unsubscribe', handleUnsubscribe);
  app.post('/api/push/broadcast', requireRole('admin'), handleBroadcast);
  app.get('/api/push/subscribers-count', handleGetSubscribersCount);

  // Fallback 404 handler for any unmatched /api/* route so it NEVER returns HTML to API clients
  app.all('/api/*', (_req, res) => {
    res.status(404).json({
      success: false,
      error: 'API endpoint not found',
    });
  });

  // Error middleware for /api/* ensuring all unhandled API errors respond with JSON, never HTML
  app.use('/api', (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Unhandled API Error]:', err);
    if (!res.headersSent) {
      res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal API Server Error',
      });
    }
  });

  // Dynamic Open Graph and Twitter Card tags injection for social crawlers (Facebook, X, WhatsApp, LinkedIn, Discord, Telegram, etc.)
  app.use(handleSocialPreview);

  // Serve uploaded media files directly from local storage
  app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

  // Connect Vite configuration dynamically to support dev vs prod modes
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully started. Running on http://localhost:${PORT}`);
    // Log active firebase-admin projectId and warn if it differs from env
    logFirebaseAdminProjectId();
    // Non-blocking warmup check to guarantee Cloudflare R2 articles feed is primed
    ensureR2ArticlesWarmup().catch(err => console.debug('[R2 Warmup Background]:', err));
  });

  // Google Cloud Load Balancer (GCLB) keep-alive alignment to prevent 502 Bad Gateway race conditions
  // GFE timeout is 600s; backend must exceed this (650s / 660s)
  server.keepAliveTimeout = 650000;
  server.headersTimeout = 660000;

  // Graceful shutdown handling for Cloud Run container lifecycle (SIGTERM/SIGINT)
  const shutdown = (signal: string) => {
    console.log(`[Lifecycle] Received ${signal}. Draining connections and shutting down gracefully...`);
    server.close(() => {
      console.log('[Lifecycle] HTTP server successfully closed.');
      process.exit(0);
    });
    // Force close after 10 seconds if connections are hanging
    setTimeout(() => {
      console.error('[Lifecycle] Forcefully terminating after timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer();
