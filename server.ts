import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import multer from 'multer';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

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
  handleGetSubscribersCount,
  handleGetDevices,
  handleDeleteDevice
} from './src/server/pushNotifications.ts';
import { handleGetPosts, handleGetPostById, handleGetWriters } from './src/server/postsApi.ts';
import { ensureR2ArticlesWarmup, getFeedFromR2, getDeletedArticleIds } from './src/server/r2Articles.ts';
import { handleGetAppVersion, handleUpdateAppVersion } from './src/server/appVersionApi.ts';
import { requireRole } from './server/auth/requireRole.ts';
import { logFirebaseAdminProjectId } from './server/auth/firebaseAdmin.ts';
import { ensureDatabaseSchema } from './server/db/neon.ts';
import {
  handleAdminCreateOrUpdateArticle,
  handleAdminGetArticles,
  handleAdminGetArticleById,
  handleAdminDeleteArticle,
  handleAdminGetMe,
  handleAdminGetPenName,
  handleAdminPutPenName,
  handleAdminRunSync,
  handleAdminSyncTick,
  handleAdminGetUsers,
  handleAdminDeleteUser,
  handleAdminSyncUser
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
        res.status(500).send('Internal Server Error');
      }
    }
  };
};

async function startServer() {
  const app = express();
  // Dev server must run on port 3000 per AI Studio runtime environment requirements.
  // In production (Cloud Run), dynamically read process.env.PORT (defaulting to 8080).
  const PORT = process.env.NODE_ENV === 'production'
    ? (process.env.PORT ? parseInt(process.env.PORT, 10) : 8080)
    : 3000;

  // Trust proxy headers for Cloudflare (hop 1) + Cloud Run load balancer (hop 2)
  app.set('trust proxy', 2);

  // Security headers — helmet configured to permit AI Studio preview iframes
  app.use(helmet({
    frameguard: false, // Disables X-Frame-Options: SAMEORIGIN so AI Studio and parent frames can embed the app
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://apis.google.com', 'https://*.firebaseapp.com', 'https://www.googletagmanager.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], // 'unsafe-inline' required by Quill editor & Tailwind
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'https://media.currentnews.blog', 'https:', 'data:', 'blob:'],
        connectSrc: [
          "'self'",
          'https://identitytoolkit.googleapis.com',
          'https://securetoken.googleapis.com',
          'https://*.googleapis.com',
          'https://*.firebaseio.com',
          'https://*.firebaseapp.com',
          'https://accounts.google.com',
          'https://api.currentnews.blog',
          'https://*.run.app',
          'ws:',
          'wss:',
        ],
        frameSrc: [
          "'self'",
          'https://*.firebaseapp.com',
          'https://*.google.com',
          'https://accounts.google.com',
          'https://www.youtube.com',
          'https://youtube.com',
          'https://www.youtube-nocookie.com',
        ],
        frameAncestors: ["'self'", 'https://*.google.com', 'https://*.run.app', 'http://localhost:*'],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
    } : false,
    hsts: process.env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));

  // Permissions-Policy header (not covered by helmet by default)
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  // ---------------------------------------------------------------------------
  // Rate limiters — must be registered BEFORE route handlers
  // ---------------------------------------------------------------------------

  // 300 req / 15 min per IP on /api/*
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', apiLimiter);

  // 20 req / 15 min on /api/admin/* writes (POST/PUT/DELETE) and /api/upload
  const adminWriteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.post('/api/admin/*', adminWriteLimiter);
  app.put('/api/admin/*', adminWriteLimiter);
  app.delete('/api/admin/*', adminWriteLimiter);
  app.post('/api/upload', adminWriteLimiter);

  // 10 req / hour on push subscribe/unsubscribe
  const pushSubscribeLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
  });

  // 5 req / hour on /api/mail/send-alert
  const mailAlertLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
  });

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

  // Dedicated route to serve brand logo reliably across all hosts, subdomains, and case variations
  app.get([
    '/CurrentNews.png', 
    '/currentnews.png', 
    '/current-news.png', 
    '/logo.png', 
    '/favicon.png',
    '/pwa-192x192.png',
    '/pwa-512x512.png',
    '/assets/CurrentNews.png',
    '/assets/currentnews.png',
    /^\/assets\/CurrentNews-.*\.png$/i
  ], (req, res) => {
    let baseName = path.basename(req.path);
    let filePath = path.join(process.cwd(), 'dist', 'assets', baseName);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(process.cwd(), 'dist', baseName);
    }
    if (!fs.existsSync(filePath)) {
      filePath = path.join(process.cwd(), 'public', baseName);
    }
    if (!fs.existsSync(filePath)) {
      filePath = path.join(process.cwd(), 'public', 'CurrentNews.png');
    }
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.type('image/png').sendFile(filePath);
  });

  // Multi-Host Routing & Admin Segregation (admin.currentnews.blog vs reader apex/www)
  app.use((req, res, next) => {
    const rawHost = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
    const host = rawHost.split(':')[0].trim().toLowerCase();
    const pathName = req.path || '';

    // In development mode (AI Studio preview, local dev, container testing),
    // bypass domain segregation so all preview hosts have full access to the editorial workspace
    if (process.env.NODE_ENV !== 'production') {
      return next();
    }

    const extraAdminHosts = (process.env.EXTRA_ADMIN_HOSTS || '')
      .split(',')
      .map(h => h.trim().toLowerCase())
      .filter(Boolean);
    const isExtraAdminHost = extraAdminHosts.includes(host);

    // In production, block /api/admin/* on any host other than admin.currentnews.blog, currentnews.blog, www.currentnews.blog, or EXTRA_ADMIN_HOSTS
    const isProduction = process.env.NODE_ENV === 'production';
    const isKnownHost = host === 'admin.currentnews.blog' || host === 'currentnews.blog' || host === 'www.currentnews.blog' || isExtraAdminHost;
    if (isProduction && !isKnownHost) {
      if (pathName === '/api/admin' || pathName.startsWith('/api/admin/')) {
        return res.status(404).json({
          success: false,
          error: 'Not found'
        });
      }
    }

    // 1. Host: admin.currentnews.blog or any extra admin host (Dedicated Admin Workspace)
    if (host === 'admin.currentnews.blog' || isExtraAdminHost) {
      // Inject X-Robots-Tag to ensure zero indexing of the administrative portal
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');

      // Do not cache admin HTML page or admin API responses, but preserve caching for static assets
      const isStaticAsset = /\.(png|jpe?g|webp|gif|svg|ico|css|js|map|woff2?|ttf|eot)$/i.test(pathName) || pathName.startsWith('/assets/');
      if (!isStaticAsset) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }

      // Allow GET /healthz and /readyz on the admin host
      if (pathName === '/healthz' || pathName === '/readyz') {
        return next();
      }

      // Admin host API gating: permit administrative actions, push broadcasts, alert dispatches, and uploads
      if (pathName.startsWith('/api/')) {
        const isAllowedAdminApi = 
          pathName === '/api/admin' || 
          pathName.startsWith('/api/admin/') ||
          pathName.startsWith('/api/push/') ||
          pathName.startsWith('/api/mail/') ||
          pathName === '/api/upload';
        if (isAllowedAdminApi) {
          return next();
        }
        return res.status(404).json({ error: 'Not found' });
      }

      // Allow admin paths and static assets (never redirect assets or images to /admin)
      const isAllowedAdminPath = 
        pathName === '/' ||
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
        pathName === '/favicon.png' ||
        pathName === '/robots.txt' ||
        pathName === '/sitemap.xml' ||
        pathName === '/ads.txt' ||
        pathName === '/app-ads.txt' ||
        pathName.toLowerCase() === '/currentnews.png' ||
        pathName.toLowerCase() === '/logo.png' ||
        pathName.startsWith('/pwa-') ||
        isStaticAsset;

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

  // Enable JSON and URL-encoded request body parsing (strict 1MB limit)
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Configure Multer for Cloudflare R2 image upload (20MB max, flexible image types and extensions)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB max file size
    },
    fileFilter: (_req, file, cb) => {
      const originalName = file.originalname || '';
      const mime = (file.mimetype || '').toLowerCase();

      // Reject SVG by MIME or extension
      if (mime === 'image/svg+xml' || /\.svg$/i.test(originalName)) {
        return cb(new Error('SVG files are strictly prohibited. Only JPEG, PNG, WebP, GIF, and AVIF are permitted.'));
      }

      const isAllowedMime = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
        'application/octet-stream', 'binary/octet-stream'
      ].includes(mime);
      const hasAllowedExt = /\.(jpe?g|png|webp|gif|avif)$/i.test(originalName);

      if (isAllowedMime || hasAllowedExt) {
        cb(null, true);
      } else {
        cb(new Error(`Only image files (JPEG, PNG, WebP, GIF, AVIF) are permitted. Received: ${file.mimetype || 'unknown'}`));
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
  app.get('/api/admin/pen-name', requireRole('admin', 'writer'), asyncHandler(handleAdminGetPenName));
  app.put('/api/admin/pen-name', requireRole('admin', 'writer'), asyncHandler(handleAdminPutPenName));
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

  app.get('/api/writers', asyncHandler(handleGetWriters));
  app.use('/img', express.static(path.join(process.cwd(), 'data', 'img'), { maxAge: '1y', immutable: true }));

  // Server-driven App Update endpoints (Google Play Store / Cloud Run dynamic update triggers)
  app.get('/api/app/version', asyncHandler(handleGetAppVersion));
  app.post('/api/app/version', requireRole('admin'), asyncHandler(handleUpdateAppVersion));

  // Backend mail endpoint for automated subscriber alerting (admin and writer testing)
  app.post('/api/mail/send-alert', mailAlertLimiter, requireRole('admin', 'writer'), asyncHandler(sendAlertHandler));

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
  app.get(['/api/push/public-key', '/api/admin/push/public-key'], handleGetVapidPublicKey);
  app.post(['/api/push/subscribe', '/api/admin/push/subscribe'], pushSubscribeLimiter, handleSubscribe);
  app.post(['/api/push/unsubscribe', '/api/admin/push/unsubscribe'], pushSubscribeLimiter, handleUnsubscribe);
  app.post(['/api/push/broadcast', '/api/admin/push/broadcast'], requireRole('admin'), handleBroadcast);
  app.get(['/api/push/subscribers-count', '/api/admin/push/subscribers-count'], requireRole('admin', 'writer'), handleGetSubscribersCount);
  app.get('/api/admin/push/devices', requireRole('admin', 'writer'), asyncHandler(handleGetDevices));
  app.delete('/api/admin/push/devices/:id', requireRole('admin', 'writer'), asyncHandler(handleDeleteDevice));
  app.post('/api/admin/push/delete-device', requireRole('admin', 'writer'), asyncHandler(handleDeleteDevice));

  // User Management & Audience Registry Endpoints (Neon PostgreSQL & Firebase source of truth)
  app.get('/api/admin/users', requireRole('admin'), asyncHandler(handleAdminGetUsers));
  app.delete('/api/admin/users/:email', requireRole('admin'), asyncHandler(handleAdminDeleteUser));
  app.post(['/api/users/sync', '/api/admin/users/sync'], asyncHandler(handleAdminSyncUser));

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
      const status = err.status || 500;
      res.status(status).json({
        success: false,
        error: status < 500 ? (err.message || 'API Error') : 'Internal API Server Error',
      });
    }
  });

  // Dynamic Open Graph and Twitter Card tags injection for social crawlers (Facebook, X, WhatsApp, LinkedIn, Discord, Telegram, etc.)
  app.use(handleSocialPreview);

  // Serve uploaded media files directly from local storage
  app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

  // Fallback image asset handler preventing SPA index.html from ever masking a missing image
  app.get(['/assets/*.(png|jpg|jpeg|svg|webp|ico|gif)', '/*.(png|jpg|jpeg|svg|webp|ico|gif)'], (req, res, _next) => {
    const rawPath = req.path;
    const cleanPath = rawPath.replace(/^\//, '');
    const inDist = path.join(process.cwd(), 'dist', cleanPath);
    if (fs.existsSync(inDist)) {
      return res.sendFile(inDist);
    }
    const inPublic = path.join(process.cwd(), 'public', cleanPath);
    if (fs.existsSync(inPublic)) {
      return res.sendFile(inPublic);
    }
    if (cleanPath.toLowerCase().includes('logo') || cleanPath.toLowerCase().includes('currentnews')) {
      const logoPath = path.join(process.cwd(), 'public', 'CurrentNews.png');
      if (fs.existsSync(logoPath)) {
        res.type('image/png');
        return res.sendFile(logoPath);
      }
    }
    return res.status(404).send('Not found');
  });

  // Bypass Vite connect by serving prebuilt production bundle directly from dist/
  const distPath = path.join(process.cwd(), 'dist');
  const distIndexHtml = path.join(distPath, 'index.html');
  const hasDist = fs.existsSync(distIndexHtml);

  if (hasDist) {
    console.log('[Serving Mode] Prebuilt production bundle detected — serving directly from dist/ (Vite connect completely bypassed)');
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      const url = req.originalUrl || req.url;
      if (url.startsWith('/api/') || url.startsWith('/healthz') || url.startsWith('/readyz')) {
        return next();
      }
      res.sendFile(distIndexHtml);
    });
  } else {
    // Dynamic Vite server fallback only if dist has not yet been built
    console.log('[Serving Mode] dist/ not found — initializing fallback dynamic Vite dev server');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: "custom",
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl || req.url;
      if (url.startsWith('/api/') || url.startsWith('/healthz') || url.startsWith('/readyz')) {
        return next();
      }
      try {
        const indexHtmlPath = path.resolve(process.cwd(), 'index.html');
        if (!fs.existsSync(indexHtmlPath)) {
          return next();
        }
        const template = fs.readFileSync(indexHtmlPath, 'utf-8');
        const html = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully started. Running on http://localhost:${PORT}`);
    // Log active firebase-admin projectId and warn if it differs from env
    logFirebaseAdminProjectId();
    // Non-blocking schema verification for Neon PostgreSQL (push_subscriptions, users, subscribers)
    ensureDatabaseSchema().catch(err => console.debug('[Neon Schema Warmup]:', err));
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
