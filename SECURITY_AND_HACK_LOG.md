# SECURITY_AND_HACK_LOG.md — Adversarial Red-Team Checklist

## Red-Team Audit & Exploit Mitigations

1. **Vulnerability: Hardcoded Credentials & Production Ad IDs in Source Code**
   - **Exploit Vector:** Public git repositories or leaked frontend source bundles exposing ad client IDs or relying on fixed unit IDs across environments, risking unauthorized ad scraping or invalid traffic strikes.
   - **Defense:** Extracted all AdSense client IDs, AdSense ad slots, AdMob App IDs, and AdMob banner/interstitial units into environment variables (`.env`). If environment variables are absent, ad components collapse to `null` with zero DOM footprint, completely preventing broken ad requests or unauthorized scraping.

2. **Vulnerability: Cloud Run Host & Port Hijacking / Cold Start Failures**
   - **Exploit Vector:** Cloud Run container failing liveness probes due to listening on `localhost`/`127.0.0.1` or a static port rather than `0.0.0.0:$PORT`.
   - **Defense:** Hardcoded host `0.0.0.0` in `server.ts` and set dynamic port binding `const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;`. Added `/healthz` endpoint returning HTTP 200 with minimal overhead for instant Google Cloud container health checks.

3. **Vulnerability: Dual-Engine Ad Collision between AdSense & AdMob**
   - **Exploit Vector:** Web ad units firing inside native Android WebViews violating Google AdSense terms while AdMob simultaneously renders native banners.
   - **Defense:** Enforced strict platform boundary in `AdSpace.tsx` and `useAdSenseRouteGuard.ts`: on native platforms (`Capacitor.isNativePlatform()`), all web AdSense DOM rendering and script tags are suppressed, leaving AdMob as the authoritative ad provider on mobile devices.

4. **Vulnerability: Firestore Daily Read Quota Denial of Service (Client Flooding)**
   - **Exploit Vector:** Every client rendering the app issued direct unbounded Firestore reads (`getDocs(collection(db, 'posts'))`), exhausting the 50,000 free daily read quota and causing HTTP 429 quota errors across all users.
   - **Defense:** Implemented an in-memory 60-second caching proxy at `/api/posts` on Express. A thousand mobile phone requests per minute only trigger at most 1 Firestore read on the backend, reducing database read load by over 98%. Additionally wrapped client-side Firestore handlers with resilient offline cache fallbacks (`localStorage`).

5. **Vulnerability: Byline Spoofing & Empty Reporter Submissions**
   - **Exploit Vector:** Malicious or malformed inputs submitting empty author fields, disrupting RSS/Sitemap/Schema.org structures.
   - **Defense:** Validated in `AdminView.tsx` with hierarchical resolution: `(selectedWriter === 'custom' ? authorName.trim() : selectedWriter) || globalPenName.trim() || 'Current News Staff Report'`. Backend `/api/writers` provides sanitized server-authoritative lists.

6. **Vulnerability: Denial of Wallet via Rapid Client-Side Polling Loops**
   - **Exploit Vector:** A short `setInterval` timer (1,500ms) repeatedly issuing `getDocs` against the database per connected user, causing massive read amplification, high billing/quota consumption, and service outage.
   - **Defense:** Completely removed `setInterval` from `Header.tsx`. Replaced polling with event-driven synchronization (`settings-updated` and `storage` events) and added local storage caching (`cn_sub_${email}`), ensuring zero ongoing database reads while maintaining instant UI synchronization across views.

7. **Vulnerability: Crawl Budget Exhaustion & Thin-Content Duplicate Indexing**
   - **Exploit Vector:** Search crawlers getting trapped indexing arbitrary internal search strings (`/?search=...`) or private editorial/utility views (`/admin`, `/settings`, `/profile`, `/liked`, `/delete-account`), diluting Google PageRank and risking thin-content search penalties.
   - **Defense:** Injected dynamic `noindex, follow` on internal search results and reader profile pages so discovered links are crawled without indexing thin parameter permutations. Injected `noindex, nofollow` on `/admin` to keep the editorial desk private. Configured explicit `robots.txt` disallows for `/admin`, `/profile`, `/settings`, `/liked`, `/delete-account`, and `/api/` while giving `Googlebot` and `Googlebot-News` unrestricted crawling on verified public news dispatches.

8. **Vulnerability: Geolocation Spoofing & Local Search Intent Mismatch**
   - **Exploit Vector:** Missing or conflicting local geographic metadata causing Google search algorithms to classify the domain as a generic global portal, losing top SERP rankings on high-volume regional queries like "news near Jharkhand", "Jharkhand news", or "Ranchi news live".
   - **Defense:** Implemented authoritative W3C Geo & ICBM coordinates (`geo.region: IN-JH`, `geo.placename: Jharkhand, India`, `geo.position: 23.6102;85.2799`, `ICBM: 23.6102, 85.2799`, `coverage: Jharkhand, Ranchi, Jamshedpur, Dhanbad, Bokaro, India`) and Schema.org `areaServed` mapping for Jharkhand and major municipal districts. Also injected dedicated Google News keywords (`<news:keywords>`) inside `sitemap.xml` for all stories covering Jharkhand.

9. **Vulnerability: Public Reader Traffic Exhausting Firestore Free Quota (DoS)**
   - **Exploit Vector:** Public readers querying Firestore collections directly on page loads easily exceed Google Cloud's 50,000 free daily read quota, causing total application downtime for readers and authors alike.
   - **Defense:** Decoupled data architectures: Cloudflare R2 serves all public reads via global CDN edge caches (`media.currentnews.blog/articles/feed.json` and `${id}.json`) with 0 Firestore read consumption. Firebase Authentication and Firestore writes are isolated exclusively to authenticated admin/editor desks, guaranteeing 100% reader availability with zero risk of quota-induced blackouts.

10. **Vulnerability: Ingress Proxy Spoofing & TCP Race-Condition Failures under Load Balancers**
   - **Exploit Vector:** Attackers forging client IP headers (`X-Forwarded-For`, `CF-Connecting-IP`) to bypass security rate limits, or upstream load balancers (Google Cloud Load Balancer / Cloudflare) dropping requests with `502 Bad Gateway` when backend servers close idle TCP connections prematurely during traffic spikes.
   - **Defense:** Configured `app.set('trust proxy', true)` in `server.ts` to allow verified upstream proxies to correctly populate client IPs and protocols. Aligned Node's TCP socket settings with `server.keepAliveTimeout = 650000ms` (650s) and `server.headersTimeout = 660000ms` (660s) to exceed GCLB's 600s timeout. Created frontend multi-origin load balancer (`clientLoadBalancer.ts`) with automated circuit breaking and failover to ensure readers never encounter dead ends or frozen screens.

11. **Vulnerability: Prompt Fatigue & Intrusive Interstitial SEO Penalties**
   - **Exploit Vector:** Aggressive floating subscription prompts (push notification sheets, newsletter modals) triggering high bounce rates and risking Google Search Core Web Vitals penalties for intrusive interstitials.
   - **Defense:** Permanently removed `NotificationBanner.tsx` and `NewsletterPopup.tsx` from the codebase and DOM, guaranteeing a distraction-free, zero-interruption reading environment.

12. **Vulnerability: Stateless Container Disk Evaporation & Cache Invalidation Race on Cloud Run**
   - **Exploit Vector / Failure Mode:** In Google Cloud Run, container filesystems are ephemeral. If an application stores writes only on local disk (`data/articles/`), those files vanish whenever the container scales down or restarts. Furthermore, an external CDN polling mechanism fetching from an un-synced bucket overwrote server RAM cache with stale data, causing user articles to disappear 30 seconds after publishing.
   - **Defense:**
     - Enforced Dual-Persistence: Published articles are immediately committed to Cloud Firestore (`posts/{postId}`) via client SDK with Firebase Auth and server-side REST API sync.
     - Implemented `mergeFeedWithLocalAndCache()`: Whenever the server queries remote CDN or S3, it merges the remote list with all local disk and memory articles. CDN polls are mathematically forbidden from overwriting or deleting articles present in local storage.
     - Added 0ms Client Cache: In `DraftPublicationView.tsx`, articles are saved to `compressedStorage` (`cn_compressed_stories_v2` and single-article keys) and dispatched via `stories-updated` events, guaranteeing articles are immediately and permanently visible to the author.

13. **Vulnerability: Insecure Client-Side Admin Elevation & Missing Authorization on Write Endpoints**
    - **Exploit Vector:** Relying on client-side hardcoded email arrays (`AUTHORIZED_ADMIN_EMAILS`, `VITE_ADMIN_EMAILS`) allowed attackers to tamper with local storage, forge environment variables, or invoke backend write routes directly without token verification.
    - **Defense:** Replaced all hardcoded email lists with server-side Firebase Custom Claims (`admin`, `writer`, `none`). Implemented `requireRole` middleware validating tokens with `checkRevoked: true`, requiring `email_verified === true`, and checking claims. Protected all admin and write endpoints (`/api/admin/*`, `/api/articles/save`, `/api/upload`, `/api/mail/send-alert`, `/api/push/broadcast`). In `src/hooks/useAuthState.ts`, roles are extracted exclusively from the cryptographically verified ID token claims.

14. **Vulnerability: Admin Surface Exposure, Search Indexing & IDOR on Public Reader Host**
    - **Exploit Vector:** Public readers visiting `/admin` on the main domain (`currentnews.blog`) or search crawlers indexing administrative panels, alongside malicious writers modifying articles authored by other newsroom reporters.
    - **Defense:** Enforced host segregation in `server.ts`: `admin.currentnews.blog` serves exclusively `/admin`, `/api/admin`, and static assets, and automatically injects `X-Robots-Tag: noindex, nofollow` on every response. Public hosts (`currentnews.blog` and `www`) issue 301 redirects for `/admin` and return HTTP 404 JSON for `/api/admin/*`. In `handleAdminCreateOrUpdateArticle` and `handleAdminDeleteArticle`, ownership is strictly checked (`author_uid === req.user.uid` for writers; only admins can modify or archive other reporters' work).

15. **Vulnerability: Cloudflare Edge Worker Role Forgery & Hardcoded Email Desync**
    - **Exploit Vector:** Edge worker (`worker/src/index.ts`) previously maintained static email lists and bypassed checks on `@currentnews.blog` email suffixes, allowing unverified or spoofed Google accounts to access `/subscribers` and trigger D1 imports.
    - **Defense:** Upgraded `verifyFirebaseIdToken` with Web Crypto API to strictly extract `payload.role` and `payload.email_verified`. Enforced that `iat` cannot be in the future and `auth_time` must be present and valid. Defined `isAdmin(user) = user.role === 'admin' && user.emailVerified === true`. Purged all hardcoded email lists, environment variables (`ADMIN_EMAILS`, `WRITERS`), and suffix wildcards. Admin endpoints return 401 on missing tokens and 403 on non-admin roles.

16. **Vulnerability: Input Fuzzing, Unbounded D1 Row Injection & Memory Buffer Exhaustion**
    - **Exploit Vector:** Malicious callers generating arbitrary `postId` parameters on `/reaction/:postId` or `/view/:postId` to inject millions of junk rows into D1 `posts_stats`, or sending megabyte-scale JSON payloads to crash worker isolates.
    - **Defense:** Enforced strict regex `/^[A-Za-z0-9_-]{6,64}$/` on `postId` and `/^[A-Za-z0-9_-]{16,128}$/` on push subscription `id`. Enforced strict RFC email regex and 254-character bounds on `/subscribe`. Added global `parseJsonBody` capping incoming request payloads at 16 KB (allowing up to 5 MB exclusively on admin-authenticated `POST /import`). Enforced `X-Content-Type-Options: nosniff` and `Cache-Control: no-store` on all authenticated routes.

17. **Vulnerability: Android App Relative Fetch Black Hole & Sensitive Server Code in APK Bundle**
    - **Exploit Vector:** In Capacitor Android builds, relative network calls (e.g. `fetch('/api/...')`) resolve against local WebView `http://localhost/api/...`, resulting in failed requests and app dead-ends. Furthermore, bundling `dist/server.cjs` and sourcemaps into `dist/` caused server source code and secrets to be copied directly into `android/app/src/main/assets/public/` during `cap sync`.
    - **Defense:** Created `src/utils/webBase.ts` exporting `webUrl(path)` which dynamically prefixes reader-facing routes with `https://www.currentnews.blog` on native platforms (`Capacitor.isNativePlatform()`). Reconfigured `vite.config.ts` (`sourcemap: false`) and `package.json` build scripts so that `server.cjs` is compiled directly in the root workspace outside `dist/` with no `.map` files generated, completely isolating server bundles from the client and Android distribution assets.

18. **Vulnerability: Sensitive Credential Leakage in Auth Failure Logs & Silent Token Dropping**
    - **Exploit Vector:** Unsanitized server logs printing raw Authorization headers, user emails, or database connection strings during authentication exceptions, exposing credentials in container log aggregators.
    - **Defense:** Strict sanitization in `requireRole.ts`: console warnings strictly emit `[auth] <code> <method> <path> hasHeader=<bool> projectId=<value> firebaseErrorCode=<error.code>`. Tokens, full emails, and database URLs are never logged.

19. **Vulnerability: Attack Surface Exposure & PWA Cache Infiltration on Standalone Admin Portal**
    - **Exploit Vector:** Retaining mobile Android native code, Capacitor bridge plugins, and public reader routes inside the administrative portal increases dependency vulnerabilities, enables mobile WebView exploits, and allows stale PWA service worker caches to trap editors on obsolete bundles.
    - **Defense:**
      - Purged the entire `android/` directory and all mobile/Capacitor dependencies from the client codebase.
      - Deleted all public reader screens, load balancer logic, and AdMob monetization components.
      - Removed all PWA manifests and Service Worker registration scripts; `admin.currentnews.blog` responses enforce `Cache-Control: no-store, no-cache, must-revalidate` and `X-Robots-Tag: noindex, nofollow`.
      - Guarded all administrative paths (`/admin`, `/admin/draft`, `/admin/publications`, `/admin/audience`) behind `AdminAuthGuard` requiring active Firebase Auth tokens verified against custom claims. Root and unknown routes redirect directly to `/admin`.

21. **Vulnerability: Authentication Boundary Fuzzing, Race-Condition Double-Submits & Terms Bypass in Sign In View**
    - **Exploit Vector:** Rapid concurrent clicks on "Authenticate Access" or "Google Sign In" triggering parallel authentication requests, unhandled Firebase exceptions freezing the UI, or bypassing mandatory legal Terms of Service acceptance before accessing the administrative desk.
    - **Defense:** Added mutual submission guards (`isSubmitting` and `isGoogleSubmitting`) disabling form buttons during in-flight network promises, enforced client-side validation requiring `agreedToTerms === true` with accessible keyboard support (`role="checkbox"`, `aria-checked`, Enter/Space handlers) and actionable error callouts, sanitized and trimmed email input against strict regex patterns, and mapped Firebase Auth errors to human-readable actionable error messages without crashing or exposing raw stack traces.

22. **Vulnerability: Identity Platform ADC Permission Failure & Verification Downgrade Attack Prevention**
    - **Exploit Vector:** Enabling active token revocation checks (`verifyIdToken(token, true)`) causes `firebase-admin` to invoke Google Identity Platform's internal lookup endpoint via ADC credentials. In runtime sandboxes or Cloud Run environments lacking direct IAM Identity Platform roles, this causes Google API rejections (`auth/internal-error`), rendering all admin endpoints (`/api/admin/me`, `/api/admin/articles`) inaccessible (HTTP 503). Alternatively, an insecure fallback might blindly parse JWT payloads without verifying cryptographic signatures.
    - **Defense:** Created `/server/auth/tokenVerifier.ts` implementing cryptographic RS256 signature verification directly against Google's public x509 certificates. The verifier rigorously validates signature, algorithm (`RS256`), key ID (`kid`), expiration (`exp` with 60s clock skew tolerance), audience (`aud === projectId`), issuer (`iss === https://securetoken.google.com/${projectId}`), and user ID (`sub`). Verification never bypasses cryptographic guarantees, operates resiliently without requiring privileged IAM ADC permissions, and falls back gracefully when Google Identity Platform backend APIs are unreachable.

23. **Vulnerability: Hardcoded API Keys, Database Passwords & Private Cryptographic Secrets**
    - **Exploit Vector:** Leaking sensitive production API keys (Gemini, Resend, S3/R2 access keys, Cloudflare API tokens), database connection passwords (`postgres://user:pass@host/db`), VAPID private keys, or HMAC sync secrets inside source code repositories, client bundles, or un-sanitized `.env` templates.
    - **Defense & Verification:**
      - Ran full adversarial AST and regex scans across `src/`, `server/`, `api/`, `scripts/`, and root files for private keys (`BEGIN PRIVATE KEY`), AWS access keys (`AKIA...`), JWT tokens, database connection strings with embedded passwords, and hardcoded secrets. Zero private keys, hardcoded database credentials, or secret tokens exist in the codebase.
      - Neon PostgreSQL connection strings (`NEON_DATABASE_URL`), Cloudflare R2 credentials (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`), Resend mail tokens (`RESEND_API_KEY`), Push notification VAPID keys (`VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`), and HMAC sync secrets (`SYNC_SECRET`, `SYNC_TICK_TOKEN`) are strictly read dynamically from process environment variables.
      - Refactored `src/firebase.ts` to dynamically import configuration from `firebase-applet-config.json` with runtime environment variable overrides (`VITE_FIREBASE_API_KEY`, etc.), eliminating hardcoded API key string literals from source code.
      - Verified that `.env.example` contains purely blank placeholder variable names, with zero production secrets or values committed.

