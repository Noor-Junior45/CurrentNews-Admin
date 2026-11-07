import fs from 'fs';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';
import { cleanImageUrl, getYoutubeThumbnailUrl } from '../utils/imageUrl.ts';

// Recognized social platform & search web crawlers (including Google AdSense review bots)
const SOCIAL_BOT_REGEX = /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|TelegramBot|Discordbot|Slackbot|Pinterest|Applebot|Googlebot|Mediapartners-Google|AdsBot-Google|Google-Adwords-Instant|bingbot|SkypeUriPreview|vkShare|redditbot|YandexBot|DuckDuckBot|Baiduspider/i;

const escapeHtml = (unsafe: string) => {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export async function handleSocialPreview(req: Request, res: Response, next: NextFunction) {
  const userAgent = req.headers['user-agent'] || '';
  const isBot = SOCIAL_BOT_REGEX.test(userAgent) || req.query.social_preview === '1';

  // If not a crawler and not explicitly requesting preview inspection, yield to standard SPA router
  if (!isBot) {
    return next();
  }

  const reqPath = req.path.toLowerCase();

  // Read index.html template
  const indexPath = process.env.NODE_ENV === 'production'
    ? path.join(process.cwd(), 'dist', 'index.html')
    : path.join(process.cwd(), 'index.html');

  if (!fs.existsSync(indexPath)) {
    return next();
  }

  let html = fs.readFileSync(indexPath, 'utf-8');

  let fbConfig: any = {};
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      fbConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (e) {
    console.error('[Social Preview] Failed to read firebase-applet-config.json:', e);
  }

  const config = {
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || fbConfig.projectId || '',
    firestoreDatabaseId: process.env.VITE_FIREBASE_DATABASE_ID || fbConfig.firestoreDatabaseId || '(default)',
    apiKey: process.env.VITE_FIREBASE_API_KEY || fbConfig.apiKey || ''
  };

  // 1. Check for Article route: /post/:id or /post/:id/:slug
  const postMatch = req.path.match(/^\/post\/([^/?#]+)/);
  if (postMatch) {
    const postId = postMatch[1];
    try {
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents:runQuery?key=${config.apiKey}`;
      const queryBody = {
        structuredQuery: {
          from: [{ collectionId: "posts" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "__name__" },
              op: "EQUAL",
              value: {
                referenceValue: `projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents/posts/${postId}`
              }
            }
          },
          limit: 1
        }
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const resp = await fetch(firestoreUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queryBody),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        return next();
      }

      const data = await resp.json();
      const docItem = Array.isArray(data) && data[0]?.document ? data[0].document : null;
      if (!docItem || !docItem.fields) {
        return next();
      }

      const fields = docItem.fields;
      const title = fields.title?.stringValue || 'Current News Live - Independent Ledger';
      const rawContent = fields.content?.stringValue || '';
      const plainContent = rawContent
        .replace(/&nbsp;|&#160;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#039;|&apos;/gi, "'")
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const summary = plainContent.length > 160 ? plainContent.substring(0, 160).trim() + '...' : plainContent;
      const rawImage = fields.imageUrl?.stringValue || '';
      const youtubeUrl = fields.youtubeUrl?.stringValue || '';
      const ytThumb = getYoutubeThumbnailUrl(youtubeUrl);
      const mainImg = cleanImageUrl(rawImage) || ytThumb || 'https://i.imgur.com/gFgShoZ.jpeg';
      const secureImg = mainImg.startsWith('http:') ? mainImg.replace('http:', 'https:') : mainImg;
      const authorName = fields.authorName?.stringValue || 'Current News';
      const category = fields.category?.stringValue || 'General';
      const canonicalUrl = `https://www.currentnews.blog/post/${postId}`;
      const pubDate = fields.createdAt?.timestampValue || new Date().toISOString();
      let formattedPubDate = 'Recent Post';
      try {
        const d = new Date(pubDate);
        if (!isNaN(d.getTime())) {
          formattedPubDate = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        }
      } catch (e) {}

      // Replace Title & Description
      html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)} | Current News Live</title>`);
      html = html.replace(/<meta name="description"[^>]*>/gi, `<meta name="description" content="${escapeHtml(summary)}" />`);
      html = html.replace(/<link rel="canonical"[^>]*>/gi, `<link rel="canonical" href="${canonicalUrl}" />`);

      // Open Graph & Twitter Tags + Schema.org NewsArticle JSON-LD
      const metaTags = `
    <!-- Open Graph (Article Specific for Social Media & Google) -->
    <meta property="og:site_name" content="Current News Live" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(summary)}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:image" content="${escapeHtml(mainImg)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(secureImg)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="article:author" content="${escapeHtml(authorName)}" />
    <meta property="article:section" content="${escapeHtml(category)}" />
    <meta property="article:published_time" content="${pubDate}" />
    <meta property="article:publisher" content="https://www.currentnews.blog" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(summary)}" />
    <meta name="twitter:image" content="${escapeHtml(mainImg)}" />

    <!-- Schema.org NewsArticle Structured Data for Googlebot & AdSense -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "headline": ${JSON.stringify(title)},
      "description": ${JSON.stringify(summary)},
      "image": [${JSON.stringify(mainImg)}],
      "datePublished": ${JSON.stringify(pubDate)},
      "dateModified": ${JSON.stringify(pubDate)},
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": ${JSON.stringify(canonicalUrl)}
      },
      "author": [{
        "@type": "Person",
        "name": ${JSON.stringify(authorName)},
        "url": "https://www.currentnews.blog/about"
      }],
      "publisher": {
        "@type": "NewsMediaOrganization",
        "name": "Current News Live",
        "url": "https://www.currentnews.blog",
        "logo": {
          "@type": "ImageObject",
          "url": "https://www.currentnews.blog/CurrentNews.png"
        }
      }
    }
    </script>
      `;

      html = html.replace('</head>', `${metaTags}\n  </head>`);

      // CRITICAL: Inject substantive, authentic publisher article content into <div id="root">
      // so Googlebot and Mediapartners-Google NEVER see an empty screen without content!
      const articlePreRenderHtml = `
      <header class="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <a href="/" class="font-bold text-lg text-slate-900 tracking-tight uppercase">Current News Live</a>
        <nav class="flex items-center space-x-4 text-xs font-semibold text-slate-600">
          <a href="/">Home</a>
          <a href="/about">About</a>
          <a href="/editorial-policy">Editorial Policy</a>
          <a href="/contact">Contact</a>
        </nav>
      </header>
      <main class="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <nav class="text-xs font-semibold text-slate-500 mb-4">
          <a href="/">Home</a> / <a href="/">${escapeHtml(category)}</a> / <span>Article</span>
        </nav>
        <span class="text-xs font-bold uppercase text-emerald-600 tracking-wider">${escapeHtml(category)}</span>
        <h1 class="text-3xl sm:text-4xl font-black text-slate-900 mt-2 mb-4 leading-tight">${escapeHtml(title)}</h1>
        <div class="flex items-center space-x-3 text-xs text-slate-500 mb-6">
          <span>By <strong>${escapeHtml(authorName)}</strong></span>
          <span>&bull;</span>
          <span>Published: ${formattedPubDate}</span>
        </div>
        ${mainImg ? `<div class="my-6"><img src="${escapeHtml(mainImg)}" alt="${escapeHtml(title)}" class="w-full max-h-[420px] object-cover rounded-xl" /></div>` : ''}
        <div class="prose max-w-none text-slate-800 text-base leading-relaxed space-y-4 my-6">
          ${rawContent}
        </div>
      </main>
      <footer class="bg-slate-900 text-slate-300 py-8 px-6 text-xs text-center border-t border-slate-800 mt-12">
        <p>&copy; ${new Date().getFullYear()} Current News. All rights reserved.</p>
        <p class="mt-2 text-slate-400">
          <a href="/about" class="underline">About Us</a> &bull;
          <a href="/editorial-policy" class="underline">Editorial Policy</a> &bull;
          <a href="/contact" class="underline">Contact</a> &bull;
          <a href="/privacy" class="underline">Privacy Policy</a> &bull;
          <a href="/terms" class="underline">Terms of Service</a>
        </p>
      </footer>
      `;

      html = html.replace(/<div id="root">[\s\S]*?<\/div>/i, `<div id="root">${articlePreRenderHtml}</div>`);

      return res.status(200).type('html').send(html);
    } catch (err) {
      console.error('Error serving article pre-render for bot:', err);
      return next();
    }
  }

  // 2. Editorial trust & legal routes pre-rendering for crawlers: /about, /editorial-policy, /contact, /privacy, /terms
  if (reqPath === '/about' || reqPath === '/editorial-policy' || reqPath === '/contact' || reqPath === '/privacy' || reqPath === '/terms') {
    const pageTitles: Record<string, string> = {
      '/about': 'About Us | Current News Live — Independent Ledger',
      '/editorial-policy': 'Editorial & Fact-Checking Policy | Current News Live',
      '/contact': 'Contact Newsroom & Editorial Desk | Current News Live',
      '/privacy': 'Global Privacy Policy & International Statutory Codex | Current News Live',
      '/terms': 'Universal Terms of Service & International Legal Shield | Current News Live'
    };

    const canonicalUrl = `https://www.currentnews.blog${reqPath}`;
    html = html.replace(/<title>.*?<\/title>/i, `<title>${pageTitles[reqPath]}</title>`);
    html = html.replace(/<link rel="canonical"[^>]*>/gi, `<link rel="canonical" href="${canonicalUrl}" />`);
    html = html.replace(/<meta property="og:url"[^>]*>/gi, `<meta property="og:url" content="${canonicalUrl}" />`);

    const trustPageHtml = `
    <header class="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
      <a href="/" class="font-bold text-lg text-slate-900 tracking-tight uppercase">Current News Live</a>
      <nav class="flex items-center space-x-4 text-xs font-semibold text-slate-600">
        <a href="/">Home</a>
        <a href="/about">About</a>
        <a href="/editorial-policy">Editorial Policy</a>
        <a href="/contact">Contact</a>
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms of Service</a>
      </nav>
    </header>
    <main class="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <h1 class="text-3xl font-black text-slate-900 mb-4">${escapeHtml(pageTitles[reqPath])}</h1>
      <div class="prose max-w-none text-slate-700 text-sm leading-relaxed space-y-4">
        <p><strong>Current News Live</strong> is an independent digital news ledger dedicated to transparent, verified, and uncorrupted reporting. Operating under strict journalistic independence, our newsroom provides breaking public interest journalism, geopolitical investigation, and technological insights.</p>
        <p>Our editorial team adheres to a strict two-source verification policy, prompt transparent corrections, international copyright adherence under the Berne Convention and DMCA, worldwide privacy protections (GDPR, CCPA/CPRA, LGPD), and user data control rights.</p>
        <p>Canonical Reference: <code>${canonicalUrl}</code></p>
      </div>
    </main>
    <footer class="bg-slate-900 text-slate-300 py-8 px-6 text-xs text-center border-t border-slate-800 mt-12">
      <p>&copy; ${new Date().getFullYear()} Current News. All rights reserved.</p>
      <p class="mt-2 text-slate-400">
        <a href="/about" class="underline">About Us</a> &bull;
        <a href="/editorial-policy" class="underline">Editorial Policy</a> &bull;
        <a href="/contact" class="underline">Contact</a> &bull;
        <a href="/privacy" class="underline">Privacy Policy</a> &bull;
        <a href="/terms" class="underline">Terms of Service</a>
      </p>
    </footer>
    `;

    html = html.replace(/<div id="root">[\s\S]*?<\/div>/i, `<div id="root">${trustPageHtml}</div>`);
    return res.status(200).type('html').send(html);
  }

  // 3. Homepage pre-rendering for Googlebot & Mediapartners-Google on root /
  if (reqPath === '/' || reqPath === '') {
    try {
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents:runQuery?key=${config.apiKey}`;
      const queryBody = {
        structuredQuery: {
          from: [{ collectionId: "posts" }],
          orderBy: [{ field: { fieldPath: "createdAt" }, direction: "DESCENDING" }],
          limit: 10
        }
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      const resp = await fetch(firestoreUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queryBody),
        signal: controller.signal
      });
      clearTimeout(timeout);

      let storiesHtml = '';
      if (resp.ok) {
        const queryResult = await resp.json();
        if (Array.isArray(queryResult)) {
          for (const item of queryResult) {
            if (item.document?.fields) {
              const f = item.document.fields;
              const id = item.document.name.split('/').pop();
              const pTitle = f.title?.stringValue || '';
              const pCat = f.category?.stringValue || 'News';
              const pAuthor = f.authorName?.stringValue || 'Chronicle Staff';
              const pDate = f.createdAt?.timestampValue || '';
              let pDateFormatted = '';
              try {
                if (pDate) {
                  const d = new Date(pDate);
                  if (!isNaN(d.getTime())) pDateFormatted = d.toLocaleDateString();
                }
              } catch (e) {}

              storiesHtml += `
                <article class="p-4 border border-slate-200 rounded-xl mb-4 bg-white">
                  <span class="text-xs font-bold uppercase text-emerald-600">${escapeHtml(pCat)}</span>
                  <h2 class="text-lg font-bold text-slate-900 mt-1 mb-2">
                    <a href="/post/${id}" class="hover:underline">${escapeHtml(pTitle)}</a>
                  </h2>
                  <p class="text-xs text-slate-500">By ${escapeHtml(pAuthor)}${pDateFormatted ? ` &bull; ${pDateFormatted}` : ''}</p>
                </article>
              `;
            }
          }
        }
      }

      const isJharkhandReq = String(req.query.category || '').toLowerCase() === 'jharkhand';
      const pageTitle = isJharkhandReq 
        ? 'Jharkhand News Live — Breaking Updates, Ranchi & Regional Reports | Current News'
        : 'Current News Live — Independent Global Journalism & Live Ledger';
      const pageDesc = isJharkhandReq
        ? 'Read the latest verified breaking news near Jharkhand, Ranchi, Jamshedpur, Dhanbad, and all 24 districts. Live reporting on politics, schemes, crime, and community.'
        : 'Comprehensive, verified global news coverage, breaking reports near Jharkhand, India, finance, geopolitics, and culture updated 24/7.';

      html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(pageTitle)}</title>`);
      html = html.replace(/<meta name="description" content="[\s\S]*?"\s*\/?>/i, `<meta name="description" content="${escapeHtml(pageDesc)}" />`);

      const headlineText = isJharkhandReq
        ? 'Jharkhand News & Regional Breaking Dispatches'
        : 'Independent Journalism & Real-Time Dispatches';
      const subText = isJharkhandReq
        ? 'Real-time verified coverage near Jharkhand, Ranchi, Jamshedpur, Dhanbad, Bokaro, and all 24 districts.'
        : 'Delivering verified geopolitical disclosures, investigative reporting, technological developments, and global affairs.';

      const homePreRenderHtml = `
      <header class="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <a href="/" class="font-bold text-xl text-slate-900 tracking-tight uppercase">Current News Live</a>
          <p class="text-xs text-slate-500 font-mono">Independent Ledger &bull; Autonomous Press Alliance</p>
        </div>
        <nav class="flex items-center space-x-4 text-xs font-semibold text-slate-600">
          <a href="/?category=Jharkhand" class="text-amber-600 font-bold">Jharkhand News</a>
          <a href="/about">About</a>
          <a href="/editorial-policy">Editorial Policy</a>
          <a href="/contact">Contact</a>
        </nav>
      </header>
      <main class="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div class="mb-8 p-6 bg-slate-50 border border-slate-200 rounded-2xl">
          <h1 class="text-2xl sm:text-3xl font-black text-slate-900 mb-2">${escapeHtml(headlineText)}</h1>
          <p class="text-sm text-slate-600 max-w-2xl leading-relaxed">
            ${escapeHtml(subText)}
          </p>
        </div>
        <section>
          <h2 class="text-sm font-bold uppercase tracking-wider text-slate-900 mb-4 border-b border-slate-200 pb-2">Latest News Dispatches</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${storiesHtml || '<p class="text-xs text-slate-500">Connecting to live news dispatches...</p>'}
          </div>
        </section>
      </main>
      <footer class="bg-slate-900 text-slate-300 py-8 px-6 text-xs text-center border-t border-slate-800 mt-12">
        <p>&copy; ${new Date().getFullYear()} Current News. All rights reserved.</p>
        <p class="mt-2 text-slate-400">
          <a href="/?category=Jharkhand" class="underline">Jharkhand Coverage</a> &bull;
          <a href="/about" class="underline">About Us</a> &bull;
          <a href="/editorial-policy" class="underline">Editorial Policy</a> &bull;
          <a href="/contact" class="underline">Contact</a> &bull;
          <a href="/privacy" class="underline">Privacy Policy</a> &bull;
          <a href="/terms" class="underline">Terms of Service</a>
        </p>
      </footer>
      `;

      html = html.replace(/<div id="root">[\s\S]*?<\/div>/i, `<div id="root">${homePreRenderHtml}</div>`);
      return res.status(200).type('html').send(html);
    } catch (err) {
      console.error('Error pre-rendering homepage for bot:', err);
      return next();
    }
  }

  return next();
}
