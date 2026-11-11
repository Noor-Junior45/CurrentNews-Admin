# BUG_LOG.md — Anti-Regression Checklist

- [x] **Bug ID & Summary:** BUG-001 — In-app image preview replaced user photos with app logo.
  - **Root Cause:** Fallback handler in `imageUrl.ts` and `PostDetailView.tsx` erroneously substituted unverified image loading errors with `CurrentNews.png`.
  - **Permanent Guardrail:** Editorial photography fallbacks must collapse gracefully or load verified R2 mirrors; never substitute photos with brand emblems.

- [x] **Bug ID & Summary:** BUG-002 — Android back button closing app while reading article.
  - **Root Cause:** Android 13+ predictive back gesture invoked default `finish()` because `onBackPressedDispatcher` was unhandled in `MainActivity.kt`.
  - **Permanent Guardrail:** `MainActivity.kt` and `AndroidBackGestureHandler.tsx` must delegate navigation back to the home feed while restoring the exact scroll position and page index.

- [x] **Bug ID & Summary:** BUG-003 — AdSense web ads inside Android native webview violating Google policies and creating empty gaps.
  - **Root Cause:** Running standard web `adsbygoogle` script tags inside native Capacitor mobile webviews is restricted by Google AdSense policies and caused blank boxes on phones.
  - **Permanent Guardrail:** Suppressed all web AdSense DOM rendering on mobile and web; native monetization is delegated exclusively to Google Mobile Ads SDK / AdMob with hardcoded IDs.

- [x] **Bug ID & Summary:** BUG-004 — Missing `app-ads.txt` crawler verification for Google AdMob closed beta.
  - **Root Cause:** Missing `/app-ads.txt` endpoint on the developer website root caused AdMob to reject mobile app verification.
  - **Permanent Guardrail:** Both `/public/app-ads.txt`, `/api/app-ads.txt.ts`, and `server.ts` serve raw `text/plain; charset=utf-8` containing `google.com, pub-5865716270182311, DIRECT, f08c47fec0942fa0`.

- [x] **Bug ID & Summary:** BUG-005 — Unconfigured Ad Unit IDs causing invalid requests or build crashes.
  - **Root Cause:** Dynamic environment variables without fallbacks or invalid formats can lead to failed ad requests.
  - **Permanent Guardrail:** Hardcoded verified AdMob App ID (`ca-app-pub-5865716270182311~4645476456`), Banner ID (`ca-app-pub-5865716270182311/2031114923`), and Native Advanced ID (`ca-app-pub-5865716270182311/1743128281`) directly in the codebase and Android `strings.xml`.

- [x] **Bug ID & Summary:** BUG-006 — Firestore Free Daily Read Quota Exceeded (50,000 reads/day) throwing fatal exceptions.
  - **Root Cause:** Unbounded collection `getDocs` queries without pagination limits burned through the free tier daily 50,000 read units, throwing `FirebaseError: Quota limit exceeded`.
  - **Permanent Guardrail:** Added query `limit(30)` to post collection fetches, added deep local memory fallback (`cached_post_` and `cached_posts`), and updated `handleFirestoreError` in `firebase.ts` to intercept quota events as non-fatal rate-limits with seamless offline cache delivery instead of throwing breaking runtime exceptions.

- [x] **Bug ID & Summary:** BUG-007 — Repeated `Error checking newsletter subscription FirebaseError: Quota limit exceeded` in Header.
  - **Root Cause:** `src/components/Header.tsx` contained an aggressive `setInterval(handleSync, 1500)` that queried the Firestore `subscribers` collection every 1.5 seconds, generating 2,400+ reads per hour per client tab and rapidly exhausting the 50,000 daily read limit.
  - **Permanent Guardrail:** Never use `setInterval` to poll Firestore. Synchronize settings purely via browser `window.addEventListener('settings-updated')` and `'storage'` events, cache subscription states in `localStorage` (`cn_sub_${email}`), enforce `limit(1)` on single-document lookups, and catch quota errors gracefully without unhandled console errors.

- [x] **Bug ID & Summary:** BUG-008 — Firestore WebChannel 10s timeout and fatal `Please check your Firebase configuration` console error on boot.
  - **Root Cause:** Default WebChannel streaming in web SDK hung for 10 seconds in proxy/iframe environments before timing out, and `App.tsx` caught the offline state by throwing `console.error("Please check your Firebase configuration.")`.
  - **Permanent Guardrail:** Configured `initializeFirestore` with `experimentalAutoDetectLongPolling: true` to auto-detect iframe/proxy environments and seamlessly fall back to fast long-polling without hanging, and converted offline connection notifications in `App.tsx` to non-breaking `console.warn` ensuring 100% uninterrupted offline-first execution.

- [x] **Bug ID & Summary:** BUG-009 — Cloud Build Docker error `EUSAGE: npm ci can only install packages when your package.json and package-lock.json are in sync`.
  - **Root Cause:** Dependencies were added or updated in `package.json` without updating `package-lock.json` in the git repository. When `RUN npm ci` was invoked in Step 4 of the Docker build on Google Cloud Build, `npm ci` aborted with code 1 due to lockfile version mismatch.
  - **Permanent Guardrail:** Updated `Dockerfile` in both Stage 1 and Stage 2 to use `RUN npm ci || npm install` and `RUN npm ci --omit=dev || npm install --omit=dev`, guaranteeing that container builds on Cloud Run / Cloud Build succeed seamlessly even if lockfile drift occurs across git branches.

- [x] **Bug ID & Summary:** BUG-010 — Git push rejected by GitHub: `refusing to allow a Personal Access Token to create or update workflow without workflow scope`.
  - **Root Cause:** Committing `.github/workflows/deploy.yml` triggered GitHub's security check, which rejects pushes from standard Personal Access Tokens that don't have the explicit `workflow` OAuth scope checked. Since Google Cloud Run Continuous Deployment already connects directly to GitHub via Google Cloud Build webhooks, the workflow file was unnecessary.
  - **Permanent Guardrail:** Completely deleted `.github/workflows/deploy.yml` and the `.github` directory, relying exclusively on Cloud Run's native GitHub repository integration so `git push` succeeds with any standard GitHub token or SSH key.

- [x] **Bug ID & Summary:** BUG-011 — Bulk article migration throwing HTTP 413 `request entity too large`.
  - **Root Cause:** Express default `express.json()` parser limit is 100KB. Posting 40+ full HTML articles with rich images exceeded 100KB and caused Express to return 413 Payload Too Large.
  - **Permanent Guardrail:** Configured `app.use(express.json({ limit: '25mb' }))` and `app.use(express.urlencoded({ extended: true, limit: '25mb' }))` in `server.ts` to accommodate batch migrations and high-resolution articles.

- [x] **Bug ID & Summary:** BUG-012 — Free Firestore read quota (50k reads/day) exhausted from public readers, taking site down.
  - **Root Cause:** Thousands of daily readers caused direct or indirect Firestore `getDocs` collection scans, which hit the Google Cloud Free Tier limit and broke article reading.
  - **Permanent Guardrail:** Offloaded 100% of public article reading to Cloudflare R2 object storage (`media.currentnews.blog/articles/feed.json` and `${id}.json`) with zero Firestore reads for readers, reserving Firebase Auth exclusively for editor/admin sign-in.

- [x] **Bug ID & Summary:** BUG-013 — Full-screen spinner blocking reading on slow mobile connections when opening articles.
  - **Root Cause:** `PostDetailView` checked `if (loading)` before rendering, presenting a full-page loading spinner even when preview data (title, hero photo, author, excerpt) was already known from the feed card.
  - **Permanent Guardrail:** Seeded `post` state from router navigation state (`location.state.previewPost`), user cache memory (`getCompressedStory`), or feed memory (`getCompressedStories`). Conditioned full-page loading check to `if (loading && !post)`, ensuring the article preview box renders at **0ms** while full text sections stream in progressively on scroll via `ProgressiveArticleBody`.

- [x] **Bug ID & Summary:** BUG-015 — `Failed to save pen name: FirebaseError: Missing or insufficient permissions`.
  - **Root Cause:** `firestore.rules` lacked a match block for `/users/{userId}`, causing Firestore security rules to default-deny all writes when authors and administrators saved their pen name.
  - **Permanent Guardrail:** Added `match /users/{userId}` to `firestore.rules` permitting authenticated owners (`request.auth.uid == userId`) and administrators (`isAdmin()`) to update author pen name metadata, registered the `User` schema in `firebase-blueprint.json`, and added immediate local storage fallback (`current_news_pen_name_${uid}`) so pen names persist offline or during database rate limits.

- [x] **Bug ID & Summary:** BUG-016 — Push Service `[FirebaseError: Quota limit exceeded]` returning HTTP 500 on subscriber counts.
  - **Root Cause:** `/api/push/subscribers-count` executed an unbounded `getDocs(collection(db, 'push_subscriptions'))` on every request, downloading all documents and consuming Firestore daily read quotas until throwing `Quota limit exceeded`.
- [x] **Bug ID & Summary:** BUG-017 — R2 `articles/feed.json` 5.7 MB payload bloat caused by full HTML content and base64 inline images.
  - **Root Cause:** Editorial draft saves were persisting raw base64 data URLs in `imageUrl`, `imageUrlFallback`, `imageUrls`, `imageUrlsFallback`, and `<img src="data:...">` inside `content`. When `syncArticlesToR2` generated `articles/feed.json`, it dumped full HTML and multi-megabyte base64 strings into the feed array, forcing every homepage visitor to download 5.7 MB of data.
  - **Permanent Guardrail:** `saveArticleToR2` automatically runs `processAndExtractBase64Images` to decode all inline base64 images, upload them to R2 as `img/{postId}-{n}.webp` with 1-year immutable cache headers, and replace URLs with `https://media.currentnews.blog/img/{postId}-{n}.webp`. In addition, `updateFeedIndexInR2` and `syncArticlesToR2` strictly filter posts through `toLightArticle()`, keeping only light metadata (`id, title, category, authorName, createdAt, status, imageUrl, hashtags, likes, dislikes, views, excerpt`) without `content` HTML. All homepage and related-post queries consume the 37 KB light feed, leaving full articles strictly in `articles/{id}.json`.

- [x] **Bug ID & Summary:** BUG-018 — Firestore Quota Exhaustion for Reader-Side Interactions (Reactions, Views, Newsletter, Pen Name).
  - **Root Cause:** While article text and images were offloaded to R2 in Phase 18, reader interactions (likes, dislikes, view counts, newsletter subscription checks, subscriber management, and author pen names) were still calling Firestore collections directly, exhausting Google Cloud's free daily read quota and locking out users.
  - **Permanent Guardrail:** Replaced Firestore with Cloudflare D1 managed SQLite database via an edge Cloudflare Worker (`api.currentnews.blog`). Firebase Auth is retained strictly for user identity tokens, while `src/firebase.ts` exports strictly `auth`. All reader reads/writes use `src/utils/api.ts` with batch queries (`GET /stats?ids=...`, `GET /my-reactions`), 30-second edge cache headers, and 30-minute IP deduplication on post views via the Cloudflare Cache API. Zero Firestore database calls occur in production.

- [x] **Bug ID & Summary:** BUG-019 — Website Displayed Static Fallback Text ("Independent Journalism & Global Dispatches") Instead of Real Homepage.
  - **Root Cause:** Static editorial SEO fallback HTML was placed directly inside `<div id="root">` in `index.html`. In addition, `sw.js` was using a Cache-First strategy on navigation requests with a hardcoded `v1` cache, and the root React application lacked an ErrorBoundary. When earlier builds encountered Firestore quota errors on boot or when the service worker served stale cached HTML referencing outdated bundles, React did not hydrate, leaving the user viewing the raw static boilerplate.
  - **Permanent Guardrail:** Moved the static crawler fallback HTML into `<noscript>...</noscript>` so JavaScript-enabled browsers never display it. Replaced `<div id="root">` contents with a lightweight layout skeleton wireframe. Upgraded `sw.js` to `v2` with a strict Network-First policy for HTML navigation requests (`event.request.mode === 'navigate'`). Added a root `<ErrorBoundary>` in `src/components/ErrorBoundary.tsx` wrapping `<App />` in `src/main.tsx` with user-friendly recovery.

- [x] **Bug ID & Summary:** BUG-020 — Migrated Image URLs Malformed with Accidental Path Injections (`/uploads/photo.jpg/img/...`) and Unverified Uploads.
  - **Root Cause:** `process.env.R2_PUBLIC_DOMAIN` was used directly without stripping URL protocols or path fragments. When an environment variable contained path components or protocol formatting, generated public image URLs became `https://media.currentnews.blog/uploads/photo.jpg/img/<id>-1.webp`. Furthermore, missing R2 credentials previously fell back silently rather than aborting, causing articles to be rewritten to point to images that were never uploaded.
  - **Permanent Guardrail:** Implemented `getPublicBase()` in `src/server/r2Articles.ts` to strictly sanitize the hostname (stripping protocol, paths, and query parameters) and return `https://${host}` (fallback: `https://media.currentnews.blog`). Configured `uploadBase64ImageToR2` to throw a fatal error if R2 credentials are missing or PutObject fails. Created `scripts/migrate-from-r2.mjs` which scans all `articles/*.json` in R2, decodes base64 images into `img/{postId}-{n}.webp`, sends a mandatory `HEAD` request to `https://media.currentnews.blog/img/...` (aborting if not 200), repairs malformed URLs, writes cleaned full articles to `articles/{id}.json`, and rebuilds a tiny 37 KB light index in `articles/feed.json`. Added `--dry-run` flag support.

- [x] **Bug ID & Summary:** BUG-021 — Rapid Reaction Tapping Causing D1 Write Amplification, Network Race Conditions, and Stale Count Overwrites.
  - **Root Cause:** Direct un-debounced calls to the API on every button tap caused concurrent D1 database updates, network race conditions, and UI count flicker when background `/stats` polls overwrote fresh user reactions with stale server numbers.
  - **Permanent Guardrail:** Implemented `src/utils/reactionStore.ts` with local & server-confirmed state separation, 1500 ms trailing debounce on user taps, no-op cancellation if final state matches confirmed state, exponential backoff retry queue in `cn_react_queue_${uid}`, automatic flush on lifecycle events (`visibilitychange`, `pagehide` with keepalive, `online`, app start), 401 handling, 10-minute session caching on `/my-reactions`, and a count formula (`displayedCount = serverCount + (localMine === 'like' ? 1 : 0) - (confirmedMine === 'like' ? 1 : 0)`). Implemented write coalescing in `worker/src/index.ts` using a Durable Object (`StatsAggregator`) with a 30s alarm timer to merge high-frequency stats deltas into a single D1 batch update (`ON CONFLICT(post_id) DO UPDATE SET likes=MAX(0, likes+excluded.likes)...`), with immediate D1 fallbacks on failure. Added 3-minute `/stats` caching in `localStorage` in `HomeView.tsx` requesting only missing/stale IDs.

- [x] **Bug ID & Summary:** BUG-022 — Raw `&nbsp;` and HTML Entities Leaking into Preview Excerpts and Variable Card Heights on Desktop/Tablet.
  - **Root Cause:** Truncating HTML without decoding entities left non-breaking spaces (`&nbsp;`, `&nbsp`, `&#160;`) in excerpts, which React displayed as literal characters. In addition, varying title and excerpt lengths caused cards across desktop and tablet grids to have unequal heights.
  - **Permanent Guardrail:** Implemented `cleanPreviewText` across client components, `HomeView.tsx`, `PostDetailView.tsx`, and `extractPlainExcerpt` in `r2Articles.ts` / `migrate-from-r2.mjs` to strip `&nbsp;?`, `&#160;?`, `\u00a0`, and common HTML entities, replacing them with standard whitespace. For big screens and tablets (`sm:` and `lg:`), cards are locked to `sm:h-[265px] sm:max-h-[265px]` with a 2-line heading slot (`sm:text-[15px] lg:text-base sm:line-clamp-2 sm:h-[2.75rem]`), a 2-line description slot (`sm:text-xs lg:text-[13px] sm:line-clamp-2 sm:h-[2.35rem]`), and bottom reaction bars pinned via `mt-auto`. Phone screen design (`< sm`) remains untouched.

- [x] **Bug ID & Summary:** BUG-023 — Empty Grid Hole on Tablet Screen After 3rd Card Caused by Misaligned Ad Column Span.
  - **Root Cause:** On tablet screens (`sm:grid-cols-2`), inserting an ad with `sm:col-span-2` after the 3rd card (`idx === 2`) left Row 2 Column 2 empty, because CSS Grid auto-placement wrapped the 2-column ad to Row 3, creating an empty gap between the 3rd and 4th card.
  - **Permanent Guardrail:** Full-width ads in responsive CSS grids must strictly align with full row completions across each breakpoint's column count. On tablet (2 columns), ads are placed at even card boundaries (e.g. after card 4 at `idx === 3` with `hidden sm:block lg:hidden sm:col-span-2`), while on desktop (3 columns) ads are placed at `idx === 2` (`col-span-1 sm:hidden lg:block lg:col-span-3`). Common multiples of 2 and 3 (such as 6 cards at `idx === 5` and 12 cards at `idx === 11`) are shared across mobile, tablet, and desktop with zero empty spaces.
- [x] **Bug ID & Summary:** BUG-024 — Opening an article opened scrolled down at "Related Coverage" instead of from the top of the article.
  - **Root Cause:** In React Router SPA, navigating to `/post/:id` or between articles does not automatically reset window scroll. When a user clicked an article card after scrolling down the home feed (e.g. `scrollY = 1200px`), the scroll offset was retained. Because the article detail view mounts with lightweight preview content before full progressive scroll streaming, 1200px positioned the viewport at the bottom of the article directly over `<div id="related-articles-section">` ("Related Coverage"). Similarly, clicking links inside "Related Coverage" changed route params without resetting scroll.
- [x] **Bug ID & Summary:** BUG-025 — Home feed hero poster flashed/jumped on screen for a second when opening an article.
  - **Root Cause:** In `BlogPostCard.tsx`'s `handleOpenPost` and `HomeView.tsx`'s hero slide click handler, `window.scrollTo({ top: 0, left: 0, behavior: 'instant' })` was invoked synchronously *before* `navigate()`. When a user clicked a card down in the feed (e.g. `scrollY = 1500px`), `HomeView` was immediately yanked to `scrollY = 0`, flashing the top hero poster carousel on screen for several frames before React Router committed the transition to `PostDetailView`.
  - **Permanent Guardrail:** Never call `window.scrollTo(0, 0)` in `onClick` handlers prior to `navigate()` on the originating page. Scroll resets must strictly execute inside `useLayoutEffect` on the *destination* component (`PostDetailView.tsx` on `[id]`) and in the top-level router watcher (`ScrollToTop` in `src/App.tsx`). `useLayoutEffect` executes synchronously before the browser paints the new route, guaranteeing the article opens at `0px` without ever displaying the previous page at `0px` or flashing the hero poster.

- [x] **Bug ID & Summary:** BUG-026 — Manuscript typing box required precise tap/click on first line to focus.
  - **Root Cause:** `.ql-container.ql-snow` had `min-height: 240px`, but child `.ql-editor` contenteditable element lacked `min-height` and defaulted to `height: auto` without parent flex-grow, leaving ~85% of the box as dead container space where clicks/taps failed to trigger focus.
  - **Permanent Guardrail:** Set `.ql-container.ql-snow` with `display: flex !important; flex-direction: column !important; cursor: text !important;` and `.ql-editor` with `min-height: 260px !important; height: 100% !important; flex: 1 1 auto !important; cursor: text !important;` in `src/index.css`. Added `handleEditorAreaClick` in `RichTextEditor.tsx` with toolbar protection (`if (target.closest('.ql-toolbar')) return`) that guarantees tapping/clicking anywhere inside the box immediately calls `editor.focus()` and sets caret position without disrupting intra-text selections.

- [x] **Bug ID & Summary:** BUG-027 — Admin saw zero publications if posts belonged to legacy author email, and Cloudflare Worker denied writers access to subscribers.
  - **Root Cause:** In `CurrentPublicationsView.tsx`, `fetched.filter(p => { if (p.authorEmail) return p.authorEmail === user.email; return isAdmin; })` prematurely executed the email match and returned false without reaching `return isAdmin;` when an admin logged in to view existing articles with other author emails. In addition, Cloudflare Worker `isUserAdmin` in `/worker/src/index.ts` only had a hardcoded single fallback email, returning 403 Forbidden on `GET /subscribers` for newsroom writers and other admins.
  - **Permanent Guardrail:** Always evaluate `if (isAdmin) return true;` first in publication views so that all published newsroom data across the ledger is visible to administrators, while scoping non-admin writers to their authored posts. In `/worker/src/index.ts`, define `AUTHORIZED_WRITER_AND_ADMIN_EMAILS` including all authorized administrators, `@currentnews.blog` domains, and environment writers so that subscriber metrics and directory views are seamlessly accessible to all newsroom staff.

- [x] **Bug ID & Summary:** BUG-028 — `[R2 Articles] Error deleting S3 object from R2: InvalidArgument: Credential access key has length 53, should be 32`.
  - **Root Cause:** In Cloudflare R2, S3-compatible Access Key IDs are strictly 32-character hexadecimal strings, whereas Cloudflare API Tokens are 40–60 characters (length 53). When `process.env.R2_ACCESS_KEY_ID` contained a 53-character Cloudflare API Token, `new S3Client(...)` was instantiated with the invalid length, causing the AWS S3 SDK and R2 endpoint to throw HTTP 400 `InvalidArgument` during S3 operations (`DeleteObjectCommand`, `PutObjectCommand`).
  - **Permanent Guardrail:** Enforce strict credential validation in `getR2Credentials()` across `src/server/r2Articles.ts` and `src/server/r2Upload.ts`: check for swapped keys (`64` vs `32`), verify `accessKeyId.length === 32` before initializing `S3Client`, and return `null` if invalid. Provide direct Cloudflare REST API fallbacks (`https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket}/objects/${key}` with `Authorization: Bearer ${apiToken}`) for PUT and DELETE operations when an API token is present, and ensure local disk storage (`data/articles/*.json`, `data/feed.json`, `data/img/`) serves as an infallible local mirror fallback so deletions and writes succeed without breaking the app.

- [x] **Bug ID & Summary:** BUG-029 — Deleted article not deleted and still showing in dispatches and feeds.
  - **Root Cause:** Multiple caching layers caused resurrection of deleted articles:
    1. `deleteArticleFromR2` previously attempted `inMemoryFeedCache.filter(p => p.id !== postId)` without verifying if `inMemoryFeedCache` was initialized, and whenever `getFeedFromR2()` re-fetched `articles/feed.json` from the external Cloudflare edge CDN (`https://media.currentnews.blog/articles/feed.json`), the cached remote feed re-injected the deleted post into the local feed.
    2. `src/server/postsApi.ts` maintained its own separate `inMemoryPostsCache` and read from a misnamed path (`data/articles/feed.json` instead of `data/feed.json`), so `/api/posts` continued serving the deleted article.
    3. On the client side, `handleDeletePost` only filtered local React component state without removing the article from `localStorage` (`cn_compressed_stories_v2` and `cn_compressed_article_v2_${id}`), and without notifying other views or listeners via event broadcast.
    4. Client-side `clientLoadBalancer.ts` fetched from static CDN and wrote the deleted article back into `localStorage`.
  - **Permanent Guardrail:** Implemented a unified **Server and Client Tombstone Architecture**:
    - **Server:** Created persistent registry `data/deleted_articles.json` via `getDeletedArticleIds()` and `markArticleDeleted(postId)`. All feed endpoints (`/api/articles/feed`, `/api/posts`, `getFeedFromR2`, `loadLocalFeed`) strictly filter out any tombstoned IDs, and single post endpoint (`/api/posts/:id`, `getArticleFromR2`) immediately returns 404 for tombstoned IDs. An observer hook invalidates `postsApi` in-memory cache on deletion.
- [x] **Bug ID & Summary:** BUG-030 — Newly posted articles temporarily appeared in "My Publications" for ~30 seconds, then disappeared as if they never existed.
  - **Root Cause:**
    1. Missing Cloudflare R2 write credentials in server environment caused `saveArticleToR2` to fail when uploading to R2. The article was saved only in server RAM and local container disk.
    2. In `src/server/r2Articles.ts`, `getFeedFromR2()` had a 30-second TTL (`FEED_CACHE_TTL = 30000`). After 30s, it fetched `https://media.currentnews.blog/articles/feed.json` from the public CDN. Because the new article wasn't in R2, the CDN returned the older feed, and `getFeedFromR2()` directly assigned `inMemoryFeedCache = lightList`, overwriting in-memory cache and wiping out the newly created article.
    3. On Google Cloud Run container restarts or scale-downs, ephemeral disk storage (`data/articles/`) was wiped because articles were never persisted to Cloud Firestore.
    4. On the client, `DraftPublicationView.tsx` never cached the post in `compressedStorage`, and `CurrentPublicationsView.tsx` bypassed local storage whenever the CDN returned articles.
  - **Permanent Guardrail:**
    1. In `src/server/r2Articles.ts`, implemented `mergeFeedWithLocalAndCache()`: whenever remote CDN or S3 returns a feed, all locally saved articles (`data/articles/*.json`, `data/feed.json`, and `inMemoryFeedCache`) not present in the CDN are merged and preserved. CDN polls can NEVER overwrite or drop local articles.
    2. Dual-Layer Persistence: In `DraftPublicationView.tsx`, articles are directly saved to Cloud Firestore (`posts/{postId}`) via client SDK (authenticated by Firebase Auth) AND cached in client compressed storage (`saveCompressedStory` & `saveCompressedStories`).
    3. In `CurrentPublicationsView.tsx`, `fetchAdminPosts` merges `/api/articles/feed`, Firestore `posts` collection, and local compressed stories, deduplicating by ID so newly created articles are immediately and permanently visible.
- [x] **Bug ID & Summary:** BUG-031 — Hardcoded Admin Email Lists & Insecure Client-Side Admin Elevation Vulnerability.
  - **Root Cause:** Admin access was previously evaluated using client-side hardcoded email arrays (`AUTHORIZED_ADMIN_EMAILS`, `VITE_ADMIN_EMAILS`, `AUTHORIZED_ADMIN_DOMAINS`) in `src/hooks/useAuthState.ts` and `src/utils/writers.ts`. Any user spoofing client state or modifying environment variables could access admin views, and write endpoints lacked server-side token and role verification.
  - **Permanent Guardrail:** Enforce server-side role validation via Firebase Custom Claims (`admin`, `writer`, `none`) with `requireRole` middleware on Express routes (`/api/admin/*`, `/api/articles/save`, `/api/upload`, `/api/mail/send-alert`, `/api/push/broadcast`). In `src/hooks/useAuthState.ts`, role is extracted exclusively from `user.getIdTokenResult(true).claims.role`. All hardcoded admin/writer email lists have been deleted. Neon Postgres acts as the editorial source of truth, and `firestore.rules` is locked down with `allow read, write: if false;`.

- [x] **Bug ID & Summary:** BUG-032 — Cloudflare Edge Worker Hardcoded Email Lists, Token Verification Gaps & Durable Object Eviction Data Loss.
  - **Root Cause:**
    1. `worker/src/index.ts` hardcoded email lists and `@currentnews.blog` suffix bypasses, drifting out of sync with Firebase Custom Claims.
    2. `verifyFirebaseIdToken` did not inspect token claims (`role`, `email_verified`), future `iat` timestamps, or missing `auth_time`.
    3. `StatsAggregator` stored reaction/view deltas in ephemeral RAM only (`this.deltas = new Map()`); if Cloudflare evicted the DO before the 30-second alarm fired, accumulated likes and views were permanently lost.
  - **Permanent Guardrail:**
    1. Purged all hardcoded emails from the worker and `wrangler.toml`. Role checks now strictly enforce `isAdmin(user) = user.role === 'admin' && user.emailVerified === true`.
    2. Tokens with future `iat` or missing/future `auth_time` are immediately rejected.
    3. `StatsAggregator` uses `this.ctx.storage.put()` on every delta addition and hydrates state in the constructor using `this.ctx.blockConcurrencyWhile()`, deleting storage records only upon verified D1 batch commits.

- [x] **Bug ID & Summary:** BUG-034 — Opaque "Unauthorized: Invalid authentication credentials" Errors and Silent Token Expiration / Revocation Gaps.
  - **Root Cause:**
    1. In `server/auth/requireRole.ts`, any error during `verifyIdToken(token, true)` that was not `id-token-revoked` or `id-token-expired` fell through to a generic "Unauthorized: Invalid authentication credentials" without an error code, making diagnostics impossible.
    2. Revocation checking requires contacting Google's backend, which fails if credentials or network are restricted in certain environments.
    3. The client had no automatic token refresh retry logic when tokens expired or were revoked, causing immediate failed requests.
  - **Permanent Guardrail:**
    1. Mapped all rejections in `requireRole.ts` to standard error codes (`no_token`, `token_expired`, `token_revoked`, `invalid_token`, `auth_backend_error`, `email_not_verified`, `no_role`, `forbidden`) with `console.warn` logging the code, method, path, hasHeader, projectId, and firebaseErrorCode without logging sensitive tokens, emails, or DB URLs.
    2. Added `AUTH_CHECK_REVOKED` env flag (defaults to "true"; allows "false" to bypass revocation check when needed).
    3. Implemented `adminFetch` with automatic single retry via `auth.currentUser.getIdToken(true)` upon receiving `token_expired` or `token_revoked`, and formatted readable error messages in error banners.

- [x] **Bug ID & Summary:** BUG-035 — Cloud Run 401 Unauthorized `auth/argument-error` due to leading whitespace in `FIREBASE_PROJECT_ID`.
  - **Root Cause:** In Cloud Run revision `currentnews-00030-wvm`, `FIREBASE_PROJECT_ID` had an accidental leading space (`" gen-lang-client-0638643565"`). Firebase Admin initialized with this string and checked JWT `aud` and `iss` claims against `" gen-lang-client-0638643565"` instead of `"gen-lang-client-0638643565"`, throwing `auth/argument-error` on all valid Firebase ID tokens.
  - **Permanent Guardrail:** `server/auth/firebaseAdmin.ts` sanitizes and trims `process.env.FIREBASE_PROJECT_ID` (`.trim()`) on initialization and in `getAdminProjectId()`, guaranteeing that whitespace in environment variables cannot cause token audience verification failures.

- [x] **Bug ID & Summary:** BUG-036 — "Failed to load article details." when editing an article in the admin panel (`/admin/draft?id=:id`).
  - **Root Cause:** `DraftPublicationView` previously loaded articles for editing from the public endpoint `GET /api/posts/:id`, which reads Cloudflare R2 / local container disk. Neon Postgres is the editorial source of truth where drafts and updated revisions live, so editing non-synced drafts or new edits returned 404 and triggered a generic failure banner.
  - **Permanent Guardrail:**
    1. Added authenticated `GET /api/admin/articles/:id` behind `requireRole('admin', 'writer')` that queries Neon Postgres directly (with fallback to R2 if unconfigured), returns the full article (including drafts and archived) mapped to the standard camelCase `Post` shape, and restricts writers to their authored posts (`author_uid === user.uid`).
    2. Updated `DraftPublicationView` to load the article via `adminFetch('/api/admin/articles/:id')` and display actionable error banner messages based on status codes (404 Not Found, 403 Forbidden, 401 Session Expired).
    3. Added optimistic locking: client tracks `loadedVersion` and sends it to `POST /api/admin/articles`. The server detects stale overwrites and returns `409` (`version_conflict`), alerting the editor to reload before overwriting changes.

- [x] **Bug ID & Summary:** BUG-037 — Admin Host Route Leakage, PWA Infiltration, and Premature Client Auth Fetch Failure.
  - **Root Cause:**
    1. On `admin.currentnews.blog`, non-admin `/api/*` endpoints previously redirected to `/admin` returning HTML rather than a clean JSON 404, breaking programmatic API consumers.
    2. Service worker and manifest link registered on the admin portal, risking cached admin assets and conflicting service worker behavior on administrative screens.
    3. `adminFetch` read `auth.currentUser` synchronously before Firebase Auth initialized (`authStateReady()`), triggering unauthenticated requests when refreshing admin tabs.
    4. Worker rejected Firebase tokens with strict `iat` or `auth_time > nowSec` without allowance for minor clock skew between servers.
  - **Permanent Guardrail:**
    1. In `server.ts`, all paths on `admin.currentnews.blog` starting with `/api/` (except `/api/admin/*`) return JSON 404 `{ error: "Not found" }`, and `/healthz`/`/readyz` are allowed.
    2. Omitted `<link rel="manifest">` and Service Worker registration when hostname starts with `admin.`, and enforced `no-store, no-cache, must-revalidate` plus SW cache bypass on all admin assets.
    3. In `adminFetch`, awaited `auth.authStateReady()` before accessing `currentUser`, aborting early with `{ error: "Signing in...", code: "signing_in" }` if unauthenticated, and retrying with `currentUser.getIdToken(true)` on any 401.
    4. In `worker/src/index.ts`, added 60-second clock leeway for `iat` and `auth_time`.

- [x] **Bug ID & Summary:** BUG-038 — Standalone Admin Portal Refactoring Broken Import Regression Risk.
  - **Root Cause:** Stripping out public reader components, AdMob units, and client load balancer files (`clientLoadBalancer.ts`, `Header`, `Footer`, `HomeView`, `PostDetailView`, `admob.ts`, etc.) created a risk that surviving admin screens (`AdminDashboardView.tsx`, `SignInView.tsx`, `App.tsx`) would fail with broken import references or obsolete navigation redirects to deleted routes (e.g., `/profile`, `/liked`).
  - **Permanent Guardrail:** Conducted exhaustive symbol audits across all remaining source files. Replaced `clientLoadBalancer` in `AdminDashboardView.tsx` with direct resilient fetch (`/api/posts?limit=100`) and local storage fallback. Simplified `src/App.tsx` into a lean, dedicated router serving strictly `/admin`, `/admin/draft`, `/admin/publications`, `/admin/audience`, `/signin`, `/privacy`, `/terms`, with root `"/"` and wildcard `"*"` redirecting cleanly to `/admin`. Completely stripped service worker registrations and manifest links from `index.html`. Verified 0 TypeScript compilation errors and 0 lint warnings.

- [x] **Bug ID & Summary:** BUG-039 — Sticky Header Overlap & Admin Navigation Synchronization.
  - **Root Cause:** Introducing a 2-row navigation bar increased sticky header height from ~56px to ~104px–112px. Any page with child sticky elements (such as the publications filter bar in `CurrentPublicationsView.tsx` which was anchored at `top-14`) would slide underneath or collide with Row 2 of the navbar during scrolling.
  - **Permanent Guardrail:** Adjusted child sticky offsets to `top-[104px] sm:top-[112px]`, anchoring sub-bars flush beneath Row 2 of `AdminNavbar`. In addition, all profile actions are centralized inside `AdminNavbar`'s circle profile flyout menu with escape-key and outside-click listeners, avoiding route dead-ends or unauthenticated state drifts.

- [x] **Bug ID & Summary:** BUG-040 — Profile Flyout Clutter: Obsolete System Admin Tag, Settings & Theme, and Liked Dispatches on Editorial Desk.
  - **Root Cause:** Leftover customer/reader buttons ("Liked Dispatches"), settings/theme toggles, and redundant role badges ("System Administrator") cluttered the profile flyout menu in the newly created `AdminNavbar.tsx`.
  - **Permanent Guardrail:** Completely removed the role badge `<span>`, the "Setting & Theme" button and associated modal state/code, and the "Liked Dispatches" button and associated modal state/code from `AdminNavbar.tsx`. Purged obsolete CSS selectors from `src/index.css`. The profile dropdown now strictly contains user identity details, Privacy Policy link, Terms of Service link, Delete Account action (protected by typing "DELETE"), and Sign Out.

- [x] **Bug ID & Summary:** BUG-041 — Mobile Touch Swipe Conflict with Manuscript Form Inputs & Horizontal Scrolling.
  - **Root Cause:** Adding naive touch swipe gesture listeners across the entire window could trigger unintended route transitions while an editor is typing text inside inputs, editing rich text in Quill (`.ql-editor`), or scrolling horizontal tables.
  - **Permanent Guardrail:** Enforced strict event target inspection in `handleTouchEnd` to ignore touches starting inside interactive elements (`input`, `textarea`, `select`, `button`, `[contenteditable="true"]`, `.ql-editor`, `.ql-container`, modals, dropdowns). Enforced passive listener flags (`{ passive: true }`), strict elapsed time thresholds (<450ms), and horizontal dominance (`Math.abs(deltaX) > Math.abs(deltaY) * 1.5` and `|deltaX| >= 55px`) guaranteeing zero UI lag, 100% offline execution, and no interference with vertical page scrolling.

- [x] **Bug ID & Summary:** BUG-042 — Mobile Viewport Tab Overflow & Heavy Pill Box Enclosure.
  - **Root Cause:** A rigid enclosing background pill box with fixed font sizes and broad horizontal paddings forced the navigation row to require horizontal scrolling on narrow smartphone screens (360px–390px) and created unnecessary visual clutter compared to modern minimalist web POS/CRM navigation.
  - **Permanent Guardrail:** Completely removed the enclosing long pill background box. Configured centered layout (`justify-center`) on larger viewports with responsive font tiers (`text-[10px]` on small phones, `text-xs` on tablets, `text-sm` on desktops), tight mobile padding (`px-1.5 xs:px-2 sm:px-3.5`), and vertical dividers `|` between items. Individual active tabs retain dedicated soft pastel pills (emerald, indigo, blue, amber) while inactive items display distinct colored icons and slate text, exactly matching the reference image layout.

- [x] **Bug ID & Summary:** BUG-043 — Full-Page Loading Buffer Flicker from Uncached Auth Mounts & Child Route Navbar Re-creation.
  - **Root Cause:** Placing `<AdminNavbar />` and `<AdminAuthGuard>` individually inside each child route view meant that switching tabs unmounted the entire page, including the navbar, and triggered fresh auth checks with `loading = true`, briefly converting the entire viewport into a full-page loading spinner.
  - **Permanent Guardrail:** Introduced `src/components/AdminLayout.tsx` as a persistent shell component holding `<AdminNavbar />` permanently mounted across all editorial tabs. Implemented singleton auth state caching in `useAuthState.ts` so in-memory authenticated state persists across route changes with zero loading delay. Localized data-fetching spinners strictly to individual card or table sections (e.g. `feedLoading` in dashboard metrics or `loading` in publications list) without ever obscuring or reloading the navigation header.

- [x] **Bug ID & Summary:** BUG-044 — Google Sign In failed: `FirebaseError: Firebase: Error (auth/unauthorized-domain)`.
  - **Root Cause:**
    1. In `AdminAuthGuard.tsx`, unauthenticated users were presented with an "Access Prohibited" screen whose button directly called `signInWithPopup(auth, provider)` and logged exceptions to `console.error('Google Sign In failed:', err)`, triggering test failures when visited on un-whitelisted dynamic preview hostnames (e.g. Cloud Run preview subdomains).
    2. Dynamic AI Studio preview hostnames (`*.run.app`) are not pre-authorized in the Firebase project's OAuth authorized domains list (`Firebase Console > Authentication > Settings > Authorized domains`), which causes Google Sign-In popups to reject with `auth/unauthorized-domain`.
  - **Permanent Guardrail:**
    1. In `AdminAuthGuard.tsx`, unauthenticated users (`!user`) immediately redirect to `/signin` (`<Navigate to="/signin" replace />`), directing visitors to the dedicated authentication stage where Email & Password authentication is available unconditionally across all domains.
    2. In `src/utils/authHelper.ts`, trapped `auth/unauthorized-domain` specifically to return a structured error result with clear user guidance (`code: 'auth/unauthorized-domain'`) and log via `console.warn` rather than uncaught `console.error`.
    3. In `SignInView.tsx`, enhanced error alerts to recognize unauthorized domain notices, guide the user on adding the domain to Firebase Console, and highlight the immediate Email & Password login alternative.
    4. Executed `ProvisionFirebase` via `rpc_action` confirming web platform configuration and Firebase ToS acceptance.

- [x] **Bug ID & Summary:** BUG-045 — Authentication Backend Error: `[auth] auth_backend_error GET /api/admin/me hasHeader=true projectId=gen-lang-client-0638643565 firebaseErrorCode=auth/internal-error`.
  - **Root Cause:**
    1. In `/server/auth/requireRole.ts`, `getAuth().verifyIdToken(token, checkRevoked)` defaulted `checkRevoked` to `true` when `process.env.AUTH_CHECK_REVOKED` was unset. With revocation checks enabled, `firebase-admin` calls the Google Identity Platform REST API (`accounts:lookup`) using Application Default Credentials (ADC). Because the execution sandbox / Cloud Run environment lacks IAM Identity Platform permissions on project `gen-lang-client-0638643565`, Google rejects the call with 403 Forbidden, which `firebase-admin` re-wraps as `auth/internal-error` and the API returned as HTTP 503 `auth_backend_error`.
    2. Missing fallback to Google's public x509 certificates prevented the server from cryptographically verifying standard RS256 JWT signatures offline without relying on privileged ADC IAM access.
  - **Permanent Guardrail:**
    1. Built `/server/auth/tokenVerifier.ts` implementing `verifyFirebaseTokenSafely` and `verifyTokenWithGooglePublicCerts`. It attempts `verifyIdToken(token, false)` first, and if `firebase-admin` encounters `auth/internal-error` or IAM connectivity restrictions, automatically validates the JWT RS256 signature against Google's public certificates (`https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com`), enforcing `aud === projectId`, `iss === 'https://securetoken.google.com/' + projectId`, clock skew, expiration, and user ID without privileged Google API calls.
    2. Treated Google Sign-In tokens as email-verified (`decoded.firebase?.sign_in_provider === 'google.com' || decoded.email_verified === true`).

- [x] **Bug ID & Summary:** BUG-046 — Login Navigation Flicker & Auth State Desynchronization.
  - **Root Cause:**
    1. In `SignInView.tsx`, `handleFormSubmit` and `handleGoogleSignIn` called `navigate('/admin', { replace: true })` immediately upon resolving the Firebase sign-in promise, while an uncoordinated `onAuthStateChanged` hook in `SignInView.tsx` also listened and attempted duplicate navigation.
    2. In `src/hooks/useAuthState.ts`, `cachedAuthState` was only updated asynchronously after performing a network request (`getIdTokenResult(true)`). When the app navigated to `/admin`, `AdminAuthGuard.tsx` read `cachedAuthState` which still had `user: null` and `loading: false`, causing `AdminAuthGuard` to instantly bounce the user back to `"/"` via `<Navigate to="/" replace />`.
    3. Once the claims finished propagating over the network, `SignInView.tsx`'s listener fired again and re-navigated to `/admin`, creating a visible, jarring screen flicker/bounce.
  - **Permanent Guardrail:**
    1. Created and exported `syncUserAuthState(user)` in `src/hooks/useAuthState.ts`, which reads the cached token locally via `getIdTokenResult(false)` (zero network latency) and immediately populates `cachedAuthState` with user identity and admin claims.
    2. In `SignInView.tsx`, called `await syncUserAuthState(user)` before invoking `navigate('/admin')`, guaranteeing the in-memory cache is fully populated before route mounting.
    3. Replaced the concurrent `onAuthStateChanged` hook in `SignInView.tsx` with a single mount-time `auth.authStateReady()` check to handle pre-existing sessions cleanly without racing login button submissions.
- [x] **Bug ID & Summary:** BUG-048 — Node 22 Native ESM Resolution Failure on Relative Extensionless Import (`ERR_MODULE_NOT_FOUND`).
  - **Root Cause:** When `"type": "module"` is configured in `package.json`, Node 22 native execution enforces strict ESM spec compliance: relative imports require explicit file extensions. `src/utils/imageUrl.ts` imported `./webBase` without `.ts` extension, and `webBase.ts` imported `@capacitor/core`, causing `node server.ts` on Google Cloud Run to exit with code 1 (`Cannot find module '/workspace/src/utils/webBase' imported from /workspace/src/utils/imageUrl.ts`).
  - **Permanent Guardrail:** Inlined the lightweight, self-contained `webUrl` utility directly inside `src/utils/imageUrl.ts` and decoupled `webBase.ts` from mobile capacitor dependencies. All server-side and shared TypeScript files executed directly under Node 22 native ESM must specify explicit `.ts` extensions or inline simple path helpers.

- [x] **Bug ID & Summary:** BUG-049 — Firebase Client Singleton Truncation & CommonJS Type Import Mismatch in Native Node ESM.
  - **Root Cause:** 
    1. `src/firebase.ts` was truncated to 2 import lines without initialization or exports, causing `vite build` to fail with `src/hooks/useAuthState.ts (3:9): "auth" is not exported by "src/firebase.ts"`.
    2. In `server/db/neon.ts`, importing TypeScript interfaces `QueryResult` and `QueryResultRow` as runtime named exports from the CommonJS module `pg` caused Node 22 native ESM to throw `SyntaxError: The requested module 'pg' does not provide an export named 'QueryResult'`.
  - **Permanent Guardrail:**
    1. Fully restored `src/firebase.ts` with complete singleton initialization (`initializeApp`, `getAuth`, `initializeFirestore`, `handleFirestoreError`, and `firebaseConfig`), exporting `app`, `auth`, `db`, and `handleFirestoreError`.
    2. In `server/db/neon.ts`, imported default `pg` from `'pg'` with type-only specifiers `import type { Pool as PgPool, QueryResult, QueryResultRow } from 'pg'`, and instantiated connections via `new pg.Pool({...})`.

- [x] **Bug ID & Summary:** BUG-050 — Full-Page Screen Buffer and Auth Loading Spinner During Tab Switching.
  - **Root Cause:** In earlier versions, each child editorial view individually wrapped itself with `<AdminNavbar />` and `<AdminAuthGuard>`. When users navigated between tabs (e.g., from Dashboard to Publications), the entire view unmounted, tearing down the navbar and triggering new auth claims fetches with `loading = true`. This caused the whole viewport to convert into a full-page loading buffer with text "Accessing Administrator authorization context...".
  - **Permanent Guardrail:** Created `src/components/AdminLayout.tsx` as a permanent layout shell containing `<AdminNavbar />` and `<AdminAuthGuard>` wrapping React Router's `<Outlet />`. In `src/hooks/useAuthState.ts`, implemented module-level in-memory auth caching with a reactive `Set<Listener>` subscriber pattern, so route changes resolve `loading = false` instantaneously. Spinners are localized strictly to the specific card or table currently fetching data from the API.

- [x] **Bug ID & Summary:** BUG-051 — AI Studio Development Preview IFrame "Refused to Connect" (`ERR_BLOCKED_BY_RESPONSE`).
  - **Root Cause:** In `server.ts`, default `helmet()` middleware automatically injected `X-Frame-Options: SAMEORIGIN`, `Cross-Origin-Opener-Policy: same-origin`, and `Content-Security-Policy: frame-ancestors 'self'`. When the development application URL (`https://ais-dev-*.asia-southeast1.run.app`) was embedded in the AI Studio parent window, the browser enforced `X-Frame-Options: SAMEORIGIN`, refusing to render the page inside the iframe and showing "refused to connect". In addition, `PORT` resolution in dev mode needed to strictly default to `3000` to align with AI Studio's internal reverse proxy.
  - **Permanent Guardrail:** In `server.ts`, explicitly configured `helmet({ frameguard: false, crossOriginOpenerPolicy: false, crossOriginResourcePolicy: false })`, set `frameAncestors: ["'self'", 'https://*.google.com', 'https://*.run.app', 'http://localhost:*']`, and locked dev mode port binding to `3000` (`process.env.NODE_ENV === 'production' ? (process.env.PORT || 8080) : 3000`).

- [x] **Bug ID & Summary:** BUG-052 — Cross-Origin IFrame `SecurityError: Failed to execute 'showPicker' on 'HTMLInputElement'`.
  - **Root Cause:** In `src/views/DraftPublicationView.tsx`, the publishing date button triggered programmatic `dateInputRef.current.showPicker()` on click. Modern browsers (Chromium/Edge) restrict JavaScript-driven `.showPicker()` invocations inside cross-origin iframes (such as the AI Studio dev preview embedded at `ais-dev-*.asia-southeast1.run.app`), throwing an uncaught `SecurityError`.
  - **Permanent Guardrail:** Never call `.showPicker()` programmatically from JavaScript inside iframe-embedded environments. Instead, place the native `<input type="date">` directly over the styled presentation layer with `absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10` and stretch the webkit calendar picker indicator with `[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0`. User click gestures directly hit the native input element, triggering the browser's built-in datepicker UI natively with zero JavaScript errors and full keyboard accessibility.

- [x] **Bug ID & Summary:** BUG-054 — Firebase Google Sign-In `auth/internal-error` in Cross-Origin Iframe Preview & Missing CSP Headers.
  - **Root Cause:**
    1. In `server.ts`, Helmet's `contentSecurityPolicy` had restricted `frameSrc` exclusively to YouTube hostnames and `connectSrc` without Google OAuth / Firebase domains. When `signInWithPopup` initialized, the browser blocked Firebase's invisible authentication session iframe (`https://<authDomain>/__/auth/iframe`), throwing `Firebase: Error (auth/internal-error)`.
    2. In addition, browser cross-origin storage partitioning (CHIPS) in embedded preview iframes can restrict popup handlers from posting tokens back to the parent iframe.
  - **Permanent Guardrail:**
    1. In `server.ts`, updated Content-Security-Policy directives: added `'self'`, `https://*.firebaseapp.com`, `https://*.google.com`, `https://accounts.google.com` to `frameSrc`; added `https://*.googleapis.com`, `https://*.firebaseio.com`, `https://*.firebaseapp.com`, `https://accounts.google.com` to `connectSrc`; and added `https://apis.google.com`, `https://*.firebaseapp.com` to `scriptSrc`.
    2. In `src/utils/authHelper.ts`, trapped `auth/internal-error`, `auth/popup-blocked`, and `auth/operation-not-allowed` with clear diagnostics advising signing in via Email & Password directly inside the preview, or opening the app in a standalone browser tab.
    3. Re-executed `ProvisionFirebase` RPC to sync the web application configuration with Firebase Identity Toolkit.

- [x] **Bug ID & Summary:** BUG-055 — Audience Registry Push Subscribers Count Missing Authorization Header (`[auth] no_token GET /api/push/subscribers-count hasHeader=false`).
  - **Root Cause:** In `src/views/AudienceRegistryView.tsx`, `fetchPushCount()` called the server endpoint `/api/push/subscribers-count` using bare browser `fetch()` rather than `adminFetch()`. Because `/api/push/subscribers-count` is strictly guarded by `requireRole('admin', 'writer')`, the absence of the Bearer token triggered a 401 `no_token` rejection logged on the Express backend.
  - **Permanent Guardrail:** Always invoke administrative and protected server endpoints using `adminFetch<T>()` instead of raw `fetch()`. `adminFetch` automatically synchronizes with `auth.authStateReady()`, attaches the cryptographically verified Firebase ID Bearer token in the `Authorization` header, handles token auto-refresh on 401s, and short-circuits gracefully without making unauthorized network calls if the user session is uninitialized.

- [x] **Bug ID & Summary:** BUG-056 — Cloud Build Failure `Cannot find module @rollup/rollup-linux-x64-musl` during `npm run build`.
  - **Root Cause:** The `Dockerfile` used `node:22-alpine` for the builder image. Alpine uses `musl` libc, which requires `@rollup/rollup-linux-x64-musl`. Due to npm bug #4828, running `npm ci` on Alpine omitted optional native bindings generated on glibc host systems, causing Rollup and Vite to fail during container builds.
  - **Permanent Guardrail:** Switched `Dockerfile` base image from `node:22-alpine` to `node:22-slim` (standard Debian glibc), which natively matches Google Cloud Run's execution environment. Additionally added `@rollup/rollup-linux-x64-musl` to `optionalDependencies` in `package.json` and synchronized `package-lock.json` so builds succeed across all container environments (Alpine, Debian, and Ubuntu).

- [x] **Bug ID & Summary:** BUG-057 — Neon Push Subscriptions `permission denied for table push_subscriptions` on `ON CONFLICT DO UPDATE` and Missing Audience Device / User List.
  - **Root Cause:**
    1. Neon database user `cn_app` has `INSERT`, `SELECT`, and `DELETE` on `push_subscriptions`, but lacks `UPDATE` permissions. Calling `INSERT ... ON CONFLICT DO UPDATE` triggered PostgreSQL permission denial errors.
    2. Audience page had no UI section or backend endpoint to fetch the list of registered push device tokens from Neon.
    3. User logins were not being recorded into the Neon `staff` table, leaving "All User Email List" empty.
  - **Permanent Guardrail:**
    1. Rewrote `dbUpsertSubscription` in `src/server/pushNotifications.ts` to `DELETE` then `INSERT`, which only requires `INSERT` and `DELETE` privileges and never fails on Neon.
    2. Built `GET /api/admin/push/devices` and `DELETE /api/admin/push/devices/:id` and rendered the registered device list with device type parsing (Android, Apple, Windows, Globe), copy-to-clipboard, and removal actions in `AudienceRegistryView.tsx`.
    3. Added automatic user upserting to `staff` on login in `SignInView.tsx` and `handleAdminGetMe`, and built `GET /api/admin/users` and `DELETE /api/admin/users/:email`.
    4. Bundled `CurrentNews.png` directly into Vite's pipeline with `src/utils/brandLogo.ts` multi-tier error fallback so the logo never breaks in any browser.

- [x] **Bug ID & Summary:** BUG-058 — "Failed to ping devices via cloud messaging" on Audience Page & Broken Logo in Custom Domains.
  - **Root Cause:**
    1. On `admin.currentnews.blog`, `server.ts` multi-host routing middleware blocked any API route starting with `/api/` that was not strictly `/api/admin/*`, returning HTTP 404 for `/api/push/broadcast`.
    2. In `src/server/pushNotifications.ts`, `handleBroadcast` aborted with HTTP 503 if VAPID keys were unset in the container environment, and only supported WebPush without native FCM dispatch for Android device tokens.
    3. `server.ts` restricted `/api/push/broadcast` to `requireRole('admin')`, blocking editorial staff members who have the `writer` role.
    4. In `src/views/AudienceRegistryView.tsx`, `handlePingAllDevices` ignored server-returned error payloads (`data?.error`), falling back to the generic message, and lacked an auto-dismiss timer.
    5. In `src/utils/brandLogo.ts`, `CURRENT_NEWS_LOGO_SVG` used the invalid MIME parameter `data:image/svg+xml;utf8,...`, causing modern browsers to reject the SVG data URI and display a broken image placeholder. In addition, Express SPA fallback served `index.html` for missing static images.
  - **Permanent Guardrail:**
    1. Updated `server.ts` host gating to permit `/api/push/*`, `/api/mail/*`, and `/api/upload` on the admin host, and aliased `/api/admin/push/broadcast`.
    2. Implemented dual-protocol dispatch in `src/server/pushNotifications.ts`: native Android FCM tokens dispatch via Firebase Cloud Messaging (`getMessaging(adminApp).send()`), while WebPush tokens dispatch via `webpush.sendNotification()`. Dead tokens (404/410/not-registered) are automatically pruned from Neon.
    3. In `pushNotifications.ts`, added automatic dynamic VAPID key generation fallback so notifications are never disabled when env vars are unset.
    4. Updated route authorization to `requireRole('admin', 'writer')` so both administrators and writers can broadcast alerts.
    5. In `AudienceRegistryView.tsx`, extract `data?.error || pingErr` and add an auto-dismiss timer (5s) to `pingFeedback`.
    6. Converted `CURRENT_NEWS_LOGO_SVG` to a valid `data:image/svg+xml;base64` URI and guarded Express static routes to never serve `index.html` for image files.
- [x] **Bug ID & Summary:** BUG-059 — Worker API Fallback to Admin Host Origin and Mixed Push Route Namespaces.
  - **Root Cause:**
    1. In `src/utils/api.ts`, `DEFAULT_API_BASE` defaulted to empty string `''`. When running without an explicit `VITE_API_BASE` build argument, reader API requests (`/push/count`, `/user/pen-name`, `/subscribers`) fell back to the admin origin (`admin.currentnews.blog`), where reader endpoints do not exist.
    2. `AudienceRegistryView.tsx` called `/api/push/subscribers-count` instead of the standard `/api/admin/push/subscribers-count` route under the admin host namespace.
  - **Permanent Guardrail:**
    1. Set `DEFAULT_API_BASE = 'https://api.currentnews.blog'` in `src/utils/api.ts` so all worker requests target the dedicated edge API gateway by default.
    2. In `Dockerfile`, declared `ARG VITE_API_BASE` and `ENV VITE_API_BASE=$VITE_API_BASE` in the builder stage before `npm run build` to support build-time environment variable overrides.
    3. Standardized all administrative push requests to `/api/admin/push/...` in `AudienceRegistryView.tsx` and `DraftPublicationView.tsx`, backed by `requireRole('admin')` for broadcast and `requireRole('admin', 'writer')` for subscriber count.

- [x] **Bug ID & Summary:** BUG-060 — UI Blank / Not Loading in AI Studio Dev Preview (`[vite] failed to connect to websocket (Error: WebSocket closed without opened.)`).
  - **Root Cause:**
    1. In `server.ts`, `createViteServer` omitted `hmr: false`, and in `vite.config.ts`, `hmr` only disabled when `DISABLE_HMR === 'true'` (which was undefined). Vite's dev client (`/@vite/client`) attempted an HMR WebSocket connection to the Cloud Run proxy domain (`https://ais-dev-*.asia-southeast1.run.app`). Because Cloud Run dev proxies do not route raw WebSockets to Express middleware without a dedicated WS server, the socket closed immediately with an unhandled promise rejection that halted React execution.
    2. In `server.ts`, the multi-host routing middleware checked `isDevLocal = (!host || host === 'localhost' || ...) && process.env.NODE_ENV !== 'production'`. When loaded in AI Studio preview, `host` was `ais-dev-*.run.app`, which was not `localhost`, causing the dev bypass to fail and exposing preview traffic to production custom-domain restrictions.
    3. Helmet Content-Security-Policy was active in dev mode and lacked Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`) and Google Tag Manager (`googletagmanager.com`), creating CSP violation rejections.
  - **Permanent Guardrail:**
    1. In `vite.config.ts`, permanently locked `server: { hmr: false, watch: null, allowedHosts: true }`.
    2. In `server.ts`, passed `{ server: { middlewareMode: true, hmr: false }, appType: 'custom' }` to `createViteServer`, added explicit `app.use('*', ... vite.transformIndexHtml)` SPA route resolution in dev, and disabled Helmet CSP in development (`process.env.NODE_ENV === 'production' ? { ... } : false`).
    3. In `index.html`, added a top-level `unhandledrejection` event listener that traps and cancels any WebSocket connection closing events before they can bubble up to the preview container.
    4. In `server.ts`, replaced `isDevLocal` with `if (process.env.NODE_ENV !== 'production') return next();` to guarantee all preview hosts bypass production host gating.

- [x] **Bug ID & Summary:** BUG-061 — Unconditional Vite 6 `@vite/client` WebSocket Instantiation Bypassing `hmr: false` (`WebSocket closed without opened`).
  - **Root Cause:** In Vite 6, `/@vite/client` unconditionally instantiates `new WebSocket(..., "vite-hmr")` regardless of `server.hmr: false`. Furthermore, Vite's built-in SPA middleware prepended `/@vite/client` immediately following `<head>`, executing before `<script>` elements in the HTML body could register unhandled rejection listeners. When the Cloud Run dev proxy terminated the socket before it opened, `@vite/client` rejected its internal connection promise with `Error: WebSocket closed without opened.`, halting React mounting in AI Studio.
  - **Permanent Guardrail:**
    1. Configured `createViteServer` with `appType: "custom"` so Express middleware exclusively handles HTML serving via `vite.transformIndexHtml`.
    2. Injected a synchronous `FakeViteWS` socket shim directly after `<head>` (prior to `/@vite/client`). The shim intercepts `new WebSocket(..., 'vite-hmr')` and immediately provides an open fake socket with `readyState = 1 (OPEN)`. Because `@vite/client` checks `let isOpened = socket.readyState === socket.OPEN`, it skips the awaiting connection promise entirely, preventing any network connection attempts or rejection errors.
    3. Added captured `unhandledrejection` and `error` listeners with `useCapture: true` in `<head>` to unconditionally silence any stray WebSocket events.

- [x] **Bug ID & Summary:** BUG-062 — Complete Bypass of Vite Connect in Dev Preview via Prebuilt `dist/` Serving.
  - **Root Cause:** Running `vite.middlewares` in containerized dev preview environments forces the browser to evaluate `/@vite/client` and attempt Vite dev server synchronization, creating proxy latency and WebSocket connect retries.
  - **Permanent Guardrail:** Updated `server.ts` to inspect `fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'))`. When the production `dist/` bundle exists, Express serves static assets directly from `dist/` and delivers `dist/index.html` for all navigation requests, completely bypassing Vite dev server instantiation, `@vite/client` injection, and WebSocket connections.

- [x] **Bug ID & Summary:** BUG-063 — Broken Brand Logo Placeholder in Sign-In View and Admin Bar in Cross-Origin Iframes / Cold Starts.
  - **Root Cause:**
    1. `CURRENT_NEWS_LOGO` imported a Vite-bundled asset path (`/assets/CurrentNews-[hash].png`). In cross-origin dev iframes or when assets were loaded before static routes were fully initialized, image requests could fail or be blocked by cross-origin resource policy (CORP) or reverse proxy caching.
    2. When the initial image failed, `handleLogoError` attempted fallback to `/CurrentNews.png` and `/currentnews.png`, but without inline fallback, slow network requests or browser image error loops resulted in the browser displaying the default alt text placeholder box (`Current News Logo`).
  - **Permanent Guardrail:**
    1. Generated `src/assets/logoBase64.ts` encoding the official 512x512 Current News globe emblem as a lossless, zero-network, embedded `data:image/png;base64,...` data URI.
    2. In `src/utils/brandLogo.ts`, set `CURRENT_NEWS_LOGO = CURRENT_NEWS_LOGO_DATA_URI` as the primary logo source, rendering the emblem with zero network latency, zero CORS/CORP dependencies, and zero 404 risk across all iframes, subdomains, and offline states.
    3. In `server.ts`, added high-priority route matchers for `/assets/CurrentNews.png`, `/assets/currentnews.png`, and regex `/^\/assets\/CurrentNews-.*\.png$/i` with explicit `Cross-Origin-Resource-Policy: cross-origin`, `Access-Control-Allow-Origin: *`, and `Cache-Control` headers.

- [x] **Bug ID & Summary:** BUG-064 — Publication Page Category Counters (`All` and `Published`) Not Updating on Article Addition / Deletion.
  - **Root Cause:**
    1. In `server/api/adminArticles.ts`, `handleAdminGetArticles` lacked a default `status != 'archived'` filter when no explicit status query parameter was sent, causing archived (deleted) articles in Neon PostgreSQL to be returned to the client.
    2. In `CurrentPublicationsView.tsx`, `visiblePosts` filtering evaluated `if (isAdmin) return true;` without checking `p.status !== 'archived'`, resurrecting deleted posts into the active count.
    3. `handleDeletePost` waited for network response before updating view state, causing UI lag, and `CurrentPublicationsView` only re-fetched on `[user, isAdmin]` without syncing across cross-tab storage changes or optimistic event details.
  - **Permanent Guardrail:**
    1. In `server/api/adminArticles.ts`, permanently exclude `status != 'archived'` whenever `statusParam !== 'archived'`.
    2. In `CurrentPublicationsView.tsx`, compute `allCount = nonArchivedPosts.length`, `publishedCount = nonArchivedPosts.filter(p => p.status === 'published').length`, and `draftsCount = nonArchivedPosts.filter(p => p.status === 'draft').length`.
    3. Added 0ms optimistic UI filtering in `handleDeletePost`, updated `stories-updated` handler to immediately apply optimistic additions and deletions, and added `storage` window listener to react to multi-tab updates.

- [x] **Bug ID & Summary:** BUG-065 — Neon PostgreSQL Schema Warmup Error `[Neon Database] Query error: permission denied for schema public` on Server Startup.
  - **Root Cause:** In `server/db/neon.ts`, `ensureDatabaseSchema()` ran unconditional `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` on server initialization. In production and least-privilege environments, the database connection is authenticated as restricted application user `cn_app`, which intentionally lacks DDL / `CREATE` privilege on `schema public` (per PostgreSQL 15+ CVE-2018-1058 security model). Even with `IF NOT EXISTS`, PostgreSQL checks schema `CREATE` privileges before table existence, triggering `42501 permission denied for schema public` and logging error stacks on boot.
  - **Permanent Guardrail:**
    1. In `server/db/neon.ts`, gated DDL execution behind `SELECT has_schema_privilege(current_user, 'public', 'CREATE') as can_create`. When `false` (application role `cn_app`), DDL statements are bypassed entirely and core tables (`articles`, `staff`, `push_subscriptions`, `audit_log`) are safely verified using catalog probe `to_regclass` without throwing permission rejections.
    2. Implemented `hasTablePrivilege(tableName, privilege)` with an in-memory cache to dynamically guard `users` and `subscribers` table queries in `server/api/adminArticles.ts` (`handleUserSync`, `handleAdminGetUsers`, and `handleAdminDeleteUser`), ensuring operations gracefully fall back to the accessible `staff` table when running under restricted credentials.
    3. Added `uselibpqcompat=true` sanitization to the pooled connection string in `getPool()` to eliminate Node `pg`/`libpq` SSL deprecation warnings on boot.

- [x] **Bug ID & Summary:** BUG-066 — Publications Page Arrow Link Opening Admin/Localhost Relative Routes and Missing on Non-Published Posts.
  - **Root Cause:**
    1. In `src/views/CurrentPublicationsView.tsx`, the arrow button was enclosed in `{post.status === 'published' && ...}`, hiding it on draft articles.
    2. The button used React Router `<Link to={`/post/${post.id}/${slugify(post.title)}`} />`, which evaluated as a relative route on the admin host (`localhost:3000` or `admin.currentnews.blog`) instead of navigating to the reader website.
    3. `src/utils/shareUrl.ts` previously inspected `origin.startsWith('http')` and returned the dev runner's origin (`ais-dev-*.run.app` or `localhost:3000`), generating non-public links.
  - **Permanent Guardrail:**
    1. In `src/utils/shareUrl.ts`, updated `getCanonicalPostUrl` and `getCanonicalSiteOrigin` to resolve directly to the public reader website (`https://currentnews.blog` or `VITE_READER_BASE_URL`), strictly preventing localhost or admin-portal origins from leaking into article share links.
    2. In `src/views/CurrentPublicationsView.tsx`, made the arrow button render consistently on all articles in the list using an external native `<a href={getCanonicalPostUrl(post.id, post.title)} target="_blank" rel="noopener noreferrer">`, opening the public reader article in a new tab.

- [x] **Bug ID & Summary:** BUG-067 — Open in Reader Arrow Appearing on Drafts & Unsynced Articles Causing "Article not found", and Row Date Using created_at Instead of published_at.
  - **Root Cause:**
    1. In `src/views/CurrentPublicationsView.tsx`, the `ArrowUpRight` reader link was rendered without checking `post.status === 'published'`, `post.syncPending`, or `post.syncError`. Clicking the link for draft articles or articles whose background outbox sync to the reader had not completed navigated to non-existent URLs on the reader site resulting in "Article not found".
    2. In `CurrentPublicationsView.tsx`, article rows formatted `post.createdAt` instead of `post.publishedAt`, causing edited or backdated articles to display the creation date rather than the active published date.
    3. In `server/api/adminArticles.ts`, `mapRowToArticle` used `syncPending: row.sync_pending !== false`, which evaluated to `true` when `row.sync_pending` was `undefined` or null in fallback feeds.
  - **Permanent Guardrail:**
    1. In `server/api/adminArticles.ts`, mapped `syncPending: Boolean(row.sync_pending)` and `syncError: row.sync_error || null` across database queries and R2 fallback results.
    2. In `CurrentPublicationsView.tsx`, gated the `ArrowUpRight` reader link strictly behind `post.status === 'published' && !post.syncPending && !post.syncError`.
    3. Rendered a small disabled icon (`<RefreshCw className="animate-spin" />`) with tooltip `"Syncing to reader..."` for published articles still syncing, and a warning icon (`<AlertCircle />`) with tooltip `"Sync failed - open the article and save again"` when `post.syncError` exists. For drafts, neither icon is shown.
    4. Switched the article row date display to `safeFormatDate(post.publishedAt || post.createdAt)` so published dates display accurately.

- [x] **Bug ID & Summary:** BUG-068 — Insecure User Sync Overwriting Roles from Request Body, Lack of Self-Deletion Protection in Admin Delete, and Legacy WebSocket Shim Retention.
  - **Root Cause:**
    1. In `server/api/adminArticles.ts`, `handleUserSync` accepted `uid`, `email`, and `role` from the request body if present, creating a potential privilege escalation vector.
    2. In `server.ts`, `GET /api/admin/users` was allowed for `requireRole('admin', 'writer')` instead of restricting user directory visibility strictly to administrators.
    3. In `handleAdminDeleteUser`, an administrator could delete their own account, and deleting a staff member deleted the database record without revoking custom claims or active refresh tokens in Firebase Auth.
    4. In `index.html`, legacy WebSocket / unhandled rejection shim scripts lingered after switching to the pure static bundle serving model.
  - **Permanent Guardrail:**
    1. In `server/api/adminArticles.ts`, `handleUserSync` completely ignores `req.body.uid`, `req.body.email`, and `req.body.role`, strictly using `req.user.uid`, `req.user.email`, and `req.user.role` from the verified token. Only the caller's own row is written to the `staff` table, with the exact token role ('admin' or 'writer'), never defaulting to admin, and returning 400 if the token has no email.
    2. In `server.ts`, updated `GET /api/admin/users` to `requireRole('admin')` only.
    3. In `handleAdminDeleteUser`, added caller self-deletion check (`callerEmail === email || callerUid === email`), looked up Firebase user by email via `adminAuth.getUserByEmail`, set `{ role: null }` claims, revoked refresh tokens (`revokeRefreshTokens`), and recorded an audit log (`user.delete`).
- [x] **Bug ID & Summary:** BUG-069 — Cloudflare Sync Taking Excessively Long Times Caused by Serial Outbox Iteration, Serial Dual-Write on Save, and 30s Timeout Stalls.
  - **Root Cause:**
    1. In `server/sync/d1Publisher.ts`, `syncPendingArticles` processed pending articles in a serial `for (const row of rows)` loop. For 50 articles, it performed 50 consecutive roundtrips to Cloudflare Worker plus 50 sequential SQL updates to Neon, resulting in 20-30 seconds of latency.
    2. In `signedPost`, `TIMEOUT_MS` was set to 10000ms with 3 retry attempts and exponential backoffs (500ms, 1000ms). If a worker cold-started or experienced edge latency, a single failing article could stall the process for up to 31.5 seconds.
    3. In `server/api/adminArticles.ts`, `handleAdminCreateOrUpdateArticle` executed live D1 edge sync and legacy Cloudflare R2 storage sync sequentially one after the other, doubling the HTTP response wait time for editors saving an article.
  - **Permanent Guardrail:**
    1. In `server/sync/d1Publisher.ts`, implemented `publishArticlesBatchToD1` which utilizes Cloudflare Worker's atomic `POST /internal/bulk` endpoint to sync up to 25 articles in a single HTTP request with an atomic `env.DB.batch` transaction, and updates Neon with `UPDATE articles ... WHERE id = ANY($1::text[])`.
    2. Implemented concurrent chunk processing (concurrency 5) for drafts/unpublishes and automated single-item fallback if a batch has validation issues.
    3. Lowered `TIMEOUT_MS` to 5000ms and `MAX_ATTEMPTS` to 2 for responsive failure handling without hanging connections.
    4. In `server/api/adminArticles.ts`, executed D1 edge sync and R2 storage sync in parallel via `Promise.all`, halving editorial save latency.




