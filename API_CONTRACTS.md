# API_CONTRACTS.md — Strict Schema Lock

## 1. Google AdMob Mobile App Integration
- **Application Name:** Current News: News & Feed
- **Publisher ID:** `pub-5865716270182311`
- **Application ID:** `ca-app-pub-5865716270182311~4645476456`

### Active Unit 1: Adaptive Banner
- **Name:** `CurrentNews_Bottom_Banner`
- **Ad Unit ID:** `ca-app-pub-5865716270182311/2031114923`
- **Format:** `BannerAdSize.ADAPTIVE_BANNER`
- **Position:** `BannerAdPosition.BOTTOM_CENTER`
- **Lifecycle:** Active on content feeds and articles; auto-hidden on utility screens.

### Active Unit 2: Native Advanced Ad
- **Name:** `currentnew_native`
- **Ad Unit ID:** `ca-app-pub-5865716270182311/1743128281`
- **Template:** `NativeAdTemplate.Medium`
- **Placements:**
  1. Article Details: Middle paragraph divider (`article-middle`)
  2. Article Details: Bottom of article content (`article-bottom`)
  3. Home View: Between news dispatches in the feed (`feed-card-...`)
- **Compliance:** Contains policy-mandated "Ad" badge and stable container dimensions to prevent layout shifts.

## 2. Monetization Verification Endpoints

### `GET /app-ads.txt` & `GET /ads.txt`
- **Method:** `GET`, `HEAD`
- **Headers:**
  - `Content-Type: text/plain; charset=utf-8`
  - `Cache-Control: public, max-age=3600, s-maxage=86400`
- **Response (200 OK):**
  ```text
  google.com, pub-5865716270182311, DIRECT, f08c47fec0942fa0
  ```

## 3. Accelerated Content & Editorial API Endpoints

### `GET /api/posts`
- **Method:** `GET`
- **Query Params:**
  - `limit`: number (default: 10, max: 50)
  - `page`: number (default: 1)
  - `category`: string (optional, e.g. "Tech", "Politics", "Sports")
  - `search`: string (optional)
- **Headers:** `Cache-Control: public, max-age=60, stale-while-revalidate=120`
- **Response Shape (200 OK):**
  ```json
  {
    "success": true,
    "posts": [/* Post objects with id, title, content, authorName, imageUrl, etc. */],
    "total": 42,
    "page": 1,
    "limit": 10,
    "hasMore": true,
    "fromCache": true
  }
  ```

### `GET /api/posts/:id`
- **Method:** `GET`
- **Params:** `id` (string document ID)
- **Headers:** `Cache-Control: public, max-age=60, stale-while-revalidate=300`
- **Response Shape (200 OK):**
  ```json
  {
    "success": true,
    "post": { "id": "...", "title": "...", "content": "..." },
    "fromCache": true
  }
  ```

### `GET /api/writers`
- **Method:** `GET`
- **Headers:** `Cache-Control: public, max-age=300`
- **Response Shape (200 OK):**
  ```json
  {
    "success": true,
    "writers": ["Current News Staff Report", "Investigative Editorial Bureau", "..."]
  }
  ```

## 4. Infrastructure & Health Endpoints

### `GET /healthz`
- **Method:** `GET`
- **Headers:** `Content-Type: text/plain; charset=utf-8`
- **Response (200 OK):** `OK`

### `GET /readyz`
- **Method:** `GET`
- **Headers:** `Content-Type: application/json; charset=utf-8`
- **Response Shape (200 OK):**
  ```json
  {
    "status": "ready",
    "uptimeSec": 120,
    "timestamp": "2026-11-01T17:15:00.000Z",
    "heapUsedMb": 89.5,
    "service": "currentnews-web-applet",
    "platform": "google-cloud-run"
  }
  ```

### `GET /api/lb/status`
- **Method:** `GET`
- **Headers:** `Content-Type: application/json; charset=utf-8`
- **Response Shape (200 OK):**
  ```json
  {
    "status": "healthy",
    "node": "gcp-cloud-run-primary",
    "region": "gcp-serverless",
    "uptime": 120.5,
    "timestamp": 1793553230363
  }
  ```

### `GET /api/app/version`
- **Method:** `GET`
- **Headers:** `Cache-Control: public, max-age=60, stale-while-revalidate=300`
- **Response Shape (200 OK):**
  ```json
  {
    "success": true,
    "latestVersion": "1.0.1",
    "latestVersionCode": 2,
    "minSupportedVersion": "1.0.0",
    "minSupportedVersionCode": 1,
    "title": "New Live Edition Available",
    "releaseNotes": [
      "Ultra-fast article preview loading with zero layout shift.",
      "Integrated multi-origin edge load balancing."
    ],
    "forceUpdate": false,
    "playStoreUrl": "https://play.google.com/store/apps/details?id=blog.currentnews.app",
    "directApkUrl": "https://media.currentnews.blog/app/currentnews-latest.apk",
    "updatedAt": "2026-11-01T19:18:25.878Z"
  }
  ```

### `POST /api/app/version`
- **Method:** `POST`
- **Body:** `{ "latestVersion": "1.0.2", "latestVersionCode": 3, "forceUpdate": false, "releaseNotes": [...] }`
- **Response Shape (200 OK):**
  ```json
  {
    "success": true,
    "message": "App version configuration updated successfully",
    "config": { ... }
  }
  ```

## 5. Search Engine Optimization & Google News Endpoints

### `GET /sitemap.xml`
- **Method:** `GET`, `HEAD`
- **Headers:**
  - `Content-Type: application/xml; charset=utf-8`
  - `Cache-Control: public, s-maxage=3600, stale-while-revalidate=59`
- **Namespaces:** `http://www.sitemaps.org/schemas/sitemap/0.9` and `http://www.google.com/schemas/sitemap-news/0.9`
- **Response Shape (200 OK):**
  - Static priority pages (`/`, `/?category=Jharkhand` [0.95 priority], `/about`, `/editorial-policy`, `/contact`, `/privacy`, `/terms`)
  - Dynamic news stories with `<news:news>` schemas including `<news:publication>`, `<news:publication_date>`, `<news:title>`, and `<news:keywords>` (regional classification for Jharkhand/Ranchi queries)

### `GET /robots.txt`
- **Method:** `GET`
- **Headers:** `Content-Type: text/plain; charset=utf-8`
- **Directives:** Explicit `Googlebot`, `Googlebot-News`, `Mediapartners-Google`, and `*` agents with Disallow on `/admin`, `/profile`, `/settings`, `/liked`, `/delete-account`, `/api/` and link to `Sitemap: https://www.currentnews.blog/sitemap.xml`.

### `GET /?category=Jharkhand`
- **Method:** `GET`
- **SEO Title:** `Jharkhand News Live — Breaking Updates, Ranchi & Regional Reports | Current News`
- **Geo Tags:** `geo.region: IN-JH`, `geo.placename: Jharkhand, India`, `geo.position: 23.6102;85.2799`, `ICBM: 23.6102, 85.2799`
- **Target Keywords:** `news near Jharkhand`, `Jharkhand news`, `Jharkhand breaking news`, `Ranchi news live`, `Dhanbad news`, `Jamshedpur news`
- **JSON-LD Schema:** `CollectionPage` with `about: AdministrativeArea (Jharkhand, IN)`

## 6. Cloudflare R2 Article & Zero-Quota Storage Endpoints
### `GET /api/articles/feed`
- **Method:** `GET`
- **Headers:** `Content-Type: application/json; charset=utf-8`
- **Action:** Retrieves aggregated articles feed including `authorEmail`, `authorId`, `imageUrls`, and embed links.
- **Response Shape (200 OK):**
  ```json
  { "success": true, "articles": [ /* Array of Post objects */ ] }
  ```

### Legacy Write Routes (Decommissioned & Locked)
> **Notice:** The legacy unauthenticated/disk write routes (`POST /api/articles/save`, `DELETE /api/articles/:id`, `POST /api/articles/sync`, `POST /api/articles/migrate-images`) have been permanently removed. All editorial dispatches, drafts, and updates are committed directly to **Neon PostgreSQL** via the authenticated `POST /api/admin/articles` endpoint (see Section 8 below).


### Direct CDN URL Contracts:
- **Feed CDN (Light Index, ~37 KB):** `https://media.currentnews.blog/articles/feed.json`
  - Shape: Array of `{ id, title, category, authorName, createdAt, status, imageUrl, hashtags, likes, dislikes, views, excerpt }` (No `content`, no base64 images).
  - Cache-Control: `public, max-age=60, s-maxage=300`
- **Individual Story CDN (Full Article Body):** `https://media.currentnews.blog/articles/${id}.json`
  - Shape: Complete Post object including full `content` HTML with external image URLs.
  - Cache-Control: `public, max-age=300, s-maxage=3600`
- **Media Image CDN:** `https://media.currentnews.blog/img/{postId}-{n}.webp`
  - Cache-Control: `public, max-age=31536000, s-maxage=31536000, immutable`

## 4. Cloudflare Worker & D1 Database API (`api.currentnews.blog`)

### `GET /stats?ids=a,b,c`
- **Method:** `GET`
- **Headers:** `Cache-Control: public, s-maxage=30, max-age=15`
- **Response Shape (200 OK):**
  ```json
  {
    "success": true,
    "stats": {
      "postId1": { "likes": 12, "dislikes": 0, "views": 250 },
      "postId2": { "likes": 4, "dislikes": 1, "views": 80 }
    }
  }
  ```

### `POST /view/:postId`
- **Method:** `POST`
- **Deduplication:** Cloudflare Cache API suppresses duplicate counts per IP + postId for 30 minutes.
- **Response Shape (200 OK):** `{ "success": true }` or `{ "success": true, "deduped": true }`

### `GET /reaction/:postId`
- **Method:** `GET`
- **Headers:** `Authorization: Bearer <Firebase_ID_Token>`
- **Response Shape (200 OK):** `{ "success": true, "type": "like" | "dislike" | null }`

### `POST /reaction/:postId`
- **Method:** `POST`
- **Headers:** `Authorization: Bearer <Firebase_ID_Token>`, `Content-Type: application/json`
- **Body:** `{ "type": "like" | "dislike" | null }`
- **Action:** Sets, toggles, or clears reaction and updates `posts_stats` in a single atomic D1 batch.
- **Response Shape (200 OK):** `{ "success": true, "type": "like" | null, "stats": { "likes": 1, "dislikes": 0, "views": 5 } }`

### `GET /my-reactions`
- **Method:** `GET`
- **Headers:** `Authorization: Bearer <Firebase_ID_Token>`
- **Response Shape (200 OK):** `{ "success": true, "reactions": { "postA": "like", "postB": "dislike" } }`

### `POST /subscribe`
- **Method:** `POST`
- **Body:** `{ "email": "user@example.com" }`
- **Response Shape (200 OK):** `{ "success": true, "message": "Subscribed successfully" }`

### `GET /subscribe/check?email=user@example.com`
- **Method:** `GET`
- **Headers:** `Authorization: Bearer <Firebase_ID_Token>` (must match requested email)
- **Response Shape (200 OK):** `{ "success": true, "subscribed": true | false }`

### `DELETE /subscribe`
- **Method:** `DELETE`
- **Headers:** `Authorization: Bearer <Firebase_ID_Token>`
- **Response Shape (200 OK):** `{ "success": true, "message": "Unsubscribed successfully" }`

### `POST /push/subscribe` & `DELETE /push/subscribe`
- **Methods:** `POST`, `DELETE`
- **Body:** `{ "id": "...", "subscription": "{...}" }` or `{ "id": "..." }`
- **Response Shape (200 OK):** `{ "success": true }`

### `GET /push/count`
- **Method:** `GET`
- **Headers:** `Cache-Control: public, s-maxage=300, max-age=60`
- **Response Shape (200 OK):** `{ "success": true, "count": 142 }`

### `GET /user/pen-name` & `PUT /user/pen-name`
- **Methods:** `GET`, `PUT`
- **Headers:** `Authorization: Bearer <Firebase_ID_Token>`
- **Body (PUT):** `{ "penName": "Jane Doe" }`
- **Response Shape (200 OK):** `{ "success": true, "penName": "Jane Doe" }`

### `GET /subscribers` (Admin Only)
- **Method:** `GET`
- **Headers:** `Authorization: Bearer <Firebase_ID_Token>` (exact email match in `ADMIN_EMAILS`)
- **Response Shape (200 OK):** `{ "success": true, "subscribers": [ { "email": "...", "created_at": 1700000000000 } ] }`

### `POST /import` (Admin Only)
- **Method:** `POST`
- **Headers:** `Authorization: Bearer <Firebase_ID_Token>`, `Content-Type: application/json`
- **Body:** `{ "posts_stats": [...], "reactions": [...], "subscribers": [...], "push_subscriptions": [...], "users": [...] }`
- **Response Shape (200 OK):** `{ "success": true, "imported": { "posts_stats": 41, "reactions": 10, "subscribers": 5, "push_subscriptions": 2, "users": 1 } }`

### `POST /admin/recount` (Admin Only)
- **Method:** `POST`
- **Headers:** `Authorization: Bearer <Firebase_ID_Token>` (exact email match in `ADMIN_EMAILS`)
- **Action:** Recomputes aggregate likes and dislikes across the entire `reactions` table in ONE atomic D1 `INSERT ... ON CONFLICT(post_id) DO UPDATE ... GROUP BY post_id` query, reconciling any count drift.
- **Response Shape (200 OK):**
  ```json
  { "success": true, "message": "Reactions recounted and posts_stats updated successfully" }
  ```

## 7. Client Reaction Architecture (`src/utils/reactionStore.ts`)
- **Storage Keys:**
  - `cn_react_${uid}`: Optimistic local reaction per post (`like` | `dislike` | `null`)
  - `cn_confirmed_${uid}`: Last server-confirmed reaction per post
  - `cn_react_queue_${uid}`: Persisted retry queue with exponential backoff
  - `cn_my_reactions_${uid}`: Session cache of user reactions (10-minute TTL)
  - `cn_stats_cache`: 3-minute local cache for `/stats` responses in HomeView
- **Debounce:** 1500 ms trailing debounce after the LAST tap
- **No-op Cancellation:** If final state equals confirmed state, network request is cancelled
- **Count Calculation Formula:**
  - `displayedLikes = serverLikes + (localMine === 'like' ? 1 : 0) - (confirmedMine === 'like' ? 1 : 0)`
  - `displayedDislikes = serverDislikes + (localMine === 'dislike' ? 1 : 0) - (confirmedMine === 'dislike' ? 1 : 0)`
## 8. Neon Editorial & Admin API Contracts (`/api/admin/*`)

All `/api/admin/*` endpoints strictly require `Authorization: Bearer <ID_TOKEN>` verified via Firebase Custom Claims with `email_verified === true`.

### `POST /api/admin/articles`
- **Method:** `POST`
- **Access:** Roles `admin`, `writer`
- **Headers:** `Authorization: Bearer <ID_TOKEN>`, `Content-Type: application/json`
- **Body:**
  - `id`: string (optional, generated if omitted)
  - `title`: string (1-200 chars)
  - `content`: string (HTML, max 500KB, sanitized server-side)
  - `category`: string (from allowed categories list)
  - `status`: `'draft' | 'published' | 'archived'` (default: `'draft'`)
  - `excerpt`, `hashtags`, `youtubeUrl`, `facebookUrl`, `customLinks`, `imageUrl`, etc.
- **Rules:**
  - Writers may only update articles where `author_uid == req.user.uid`. Admins may update any.
  - `author_uid` and `author_email` are server-enforced from `req.user`.
  - Neon Postgres is written first; if `status === 'published'`, dual-writes to Cloudflare R2.
- **Response Shape (200 OK):**
  ```json
  {
    "success": true,
    "article": { /* Article row mapped to frontend Post shape */ },
    "syncWarning": null
  }
  ```

### `GET /api/admin/articles`
- **Method:** `GET`
- **Access:** Roles `admin`, `writer`
- **Query Params:**
  - `status`: `'draft' | 'published' | 'archived'` (optional)
  - `cursor`: string (ISO timestamp for cursor-based pagination)
  - `limit`: number (default: 20, max: 50)
- **Rules:**
  - Writers see only their own drafts and dispatches.
  - Admins see all newsroom dispatches.
- **Response Shape (200 OK):**
  ```json
  {
    "success": true,
    "articles": [ /* Array of Post objects */ ],
    "nextCursor": "2026-11-06T04:00:00.000Z"
  }
  ```

### `DELETE /api/admin/articles/:id`
- **Method:** `DELETE`
- **Access:** Roles `admin`, `writer`
- **Params:** `id` (article identifier)
- **Rules:**
  - Writers may only delete their own drafts. Published articles require admin role to archive/delete.
  - Soft deletes in Neon (`status = 'archived'`), removes from R2 feed, records in `audit_log`.
- **Response Shape (200 OK):**
  ```json
  {
    "success": true,
    "message": "Article successfully deleted and removed from feed."
  }
  ```

### `GET /api/admin/me`
- **Method:** `GET`
- **Access:** Roles `admin`, `writer`
- **Response Shape (200 OK):**
  ```json
  {
    "success": true,
    "uid": "...",
    "email": "you@example.com",
    "role": "admin"
  }
  ```

### Standard Admin Auth Rejection Payload (All `/api/admin/*` and Protected Endpoints)
- **Response Shape (401, 403, 503):**
  ```json
  {
    "success": false,
    "error": "Human-readable diagnostic description",
    "code": "error_code"
  }
  ```
- **Error Codes:**
  - `no_token` (401): Missing Authorization header or empty Bearer token.
  - `token_expired` (401): Token expired; triggers client-side single retry with `getIdToken(true)`.
  - `token_revoked` (401): Token revoked; triggers client-side single retry with `getIdToken(true)`.
  - `invalid_token` (401): Token argument error, issuer/audience mismatch, or corrupted signature.
  - `auth_backend_error` (503): Firebase Admin credential or backend communication failure.
  - `email_not_verified` (403): User account email address has not been verified.
  - `no_role` (403): ID token lacks an assigned `role` custom claim.
  - `forbidden` (403): User role is not authorized for the requested endpoint.

---

## 8. Cloudflare Edge Worker Contracts (`api.currentnews.blog`)

### Security Headers (All Responses)
- `X-Content-Type-Options: nosniff`
- `Vary: Origin`
- `Cache-Control: no-store` (on all authenticated / sensitive endpoints)
- `Access-Control-Allow-Origin`: Echoed ONLY for verified origins (`currentnews.blog`, `www.currentnews.blog`, `admin.currentnews.blog`, `http://localhost:3000`, `http://localhost:5173`, `https://localhost`, `capacitor://localhost`). Disallowed origins receive no CORS header.

### `GET /subscribers`
- **Method:** `GET`
- **Access:** Strict `admin` role (`user.role === 'admin' && user.emailVerified === true`)
- **Headers:** `Authorization: Bearer <idToken>`
- **Errors:**
  - `401 Unauthorized` (`{"error":"Missing or invalid authorization token"}`)
  - `403 Forbidden` (`{"error":"Admin role required"}`)
- **Response (200 OK):**
  ```json
  {
    "subscribers": [
      { "email": "reader@example.com", "created_at": 1740000000000 }
    ]
  }
  ```

### `POST /reaction/:postId` & `POST /view/:postId`
- **Params:** `postId` matching `/^[A-Za-z0-9_-]{6,64}$/` (otherwise `400 Bad Request`)
- **Max Body Size:** 16 KB
- **Durable Object Coalescing:** Updates buffer in `StatsAggregator` with local SQLite storage persistence. Flush happens every 30s or on buffer threshold.

### `POST /subscribe`
- **Payload:** `{ "email": string }` (trimmed, lowercased, max 254 chars, strict regex RFC-compliant)
- **Response (200 OK):** `{"success": true}`
- **Errors:** `400 Bad Request` on invalid email format or payload exceeding 16KB.

### `POST /push/subscribe` & `DELETE /push/subscribe`
- **Payload:** `{ "id": string, "subscription": object }`
- **Validation:** `id` must match `/^[A-Za-z0-9_-]{16,128}$/`, payload max 4KB, `subscription.endpoint` must begin with `https://`.

## 9. Signed Internal Edge Sync Endpoints (`worker/src/index.ts`)

All `/internal/*` routes require:
- **Method:** `POST` strictly (401 on other methods)
- **CORS:** Zero CORS headers
- **Headers:** `X-Timestamp: <ms>`, `X-Signature: hex HMAC-SHA256(SYNC_SECRET, timestamp + "." + rawBody)`
- **Timestamp Window:** Within 5 minutes past or 1 minute future
- **Rejection:** 401 Unauthorized with generic body, zero explanation

### `POST /internal/publish`
- **Body:** `{ "article": { id, slug, title, content, ... } }` (max 1MB)
- **Validation:** title (1-200), slug (`/^[a-z0-9-]{1,120}$/`), id (`/^[A-Za-z0-9_-]{6,64}$/`), content (<500KB), arrays (<=20 items), URLs (https only)
- **Idempotency:** `INSERT ... ON CONFLICT(id) DO UPDATE ... WHERE excluded.version >= articles.version`
- **Response (200 OK):** `{ "ok": true, "id": string, "version": number }`

### `POST /internal/unpublish`
- **Body:** `{ "id": string }`
- **Response (200 OK):** `{ "ok": true, "id": string }`

### `POST /internal/bulk`
- **Body:** `{ "articles": [...] }` (1-25 articles, max 5MB)
- **Execution:** Atomic `env.DB.batch`
- **Response (200 OK):** `{ "ok": true, "count": number }`

### `POST /internal/reconcile`
- **Body:** `{ "ids": string[] }` (1-5000 IDs, rejects empty array with 400)
- **Operation:** Prunes all rows in D1 not in `ids`
- **Response (200 OK):** `{ "ok": true, "deleted": number }`

## 10. Public Reader Edge Endpoints (`api.currentnews.blog`)

### `GET /articles`
- **Params:** `limit` (1-50, default 20), `cursor` (base64url timestamp:id), `category` (taxonomy allowlist)
- **Fields:** id, slug, title, excerpt, category, image_url, image_url_fallback, author_name, published_at, nextCursor. (Never content)
- **Headers:** `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`

### `GET /articles/:idOrSlug`
- **Lookup:** By `id = ? OR slug = ?`
- **Response:** Full article with parsed JSON arrays (hashtags, customLinks, imageUrls, galleryPositions)
- **Headers:** `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`

### `GET /articles/recent-ids`
- **Params:** `limit` (1-1000, default 1000)
- **Response:** `{ "articles": [{ "id": string, "slug": string, "updated_at": number }] }`
- **Headers:** `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`

## 11. Admin Outbox & Sync Tick Endpoints

### `POST /api/admin/sync/run`
- **Access:** Admin role only
- **Response (200 OK):** `{ "success": true, "processed": number, "succeeded": number, "failed": number }`

### `POST /api/admin/sync-tick`
- **Access:** Header `X-Sync-Token` matching `SYNC_TICK_TOKEN` in constant time
- **Response (200 OK):** `{ "success": true, "processed": number, "succeeded": number, "failed": number }`

## 12. Editorial Article Endpoints (`server.ts` & `server/api/adminArticles.ts`)

### `GET /api/admin/articles/:id`
- **Access:** `admin` or `writer` role
- **Headers:** `Authorization: Bearer <idToken>`
- **Behavior:**
  - Neon Postgres editorial source of truth (falls back to R2/local disk if Neon unconfigured)
  - Writers may only read articles where `author_uid = uid`; admins may read any.
  - Returns full article (including drafts and archived) mapped to camelCase Post shape.
- **Responses:**
  - `200 OK`: `{ "success": true, "article": { "id": "...", "title": "...", "content": "...", "category": "...", "hashtags": [...], "youtubeUrl": "...", "facebookUrl": "...", "customLinks": [...], "imageUrl": "...", "imageUrlFallback": "...", "imageUrls": [...], "imageUrlsFallback": [...], "imagePosition": "top", "galleryPositions": [...], "authorId": "...", "authorName": "...", "authorEmail": "...", "status": "draft" | "published" | "archived", "version": 1, "createdAt": "...", "updatedAt": "..." } }`
  - `401 Unauthorized`: `{ "success": false, "error": "...", "code": "no_token" | "token_expired" | "token_revoked" }`
  - `403 Forbidden`: `{ "success": false, "error": "You can only edit your own articles", "code": "forbidden" }`
  - `404 Not Found`: `{ "success": false, "error": "Article not found", "code": "not_found" }`

### `POST /api/admin/articles` (Optimistic Concurrency & Publishing)
- **Access:** `admin` or `writer` role
- **Payload:** Includes `id` (if update), `title`, `content`, `category`, `hashtags`, `version` (loaded revision number), `status` ('published' | 'draft' | 'archived'), etc.
- **Optimistic Locking:**
  - If existing server `version > clientVersion`, rejects with:
    - `409 Conflict`: `{ "success": false, "error": "This article was changed elsewhere, please reload", "code": "version_conflict", "serverVersion": number, "clientVersion": number }`
## 13. Admin Host Routing & Edge Auth Leeway (`server.ts` & `worker/src/index.ts`)

### Host `admin.currentnews.blog` Routing
- **Header:** `X-Forwarded-Host: admin.currentnews.blog` or `Host: admin.currentnews.blog`
- **Security:** Injects `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`.
- **System Probes:** `GET /healthz` and `GET /readyz` are explicitly allowed and return standard health telemetry.
- **API Boundary:** Any path starting with `/api/` that is not `/api/admin` or `/api/admin/*` returns HTTP 404 JSON `{ "error": "Not found" }` (never redirects to `/admin`, never returns HTML).
- **Navigation:** Allowed paths include `/admin`, `/admin/*`, `/signin`, `/login`, `/privacy`, `/terms`, and static assets (`/assets`, `/@vite`, `/img`, `/uploads`, `/favicon.ico`, `/robots.txt`). Unrecognized paths 302 redirect to `/admin`.
- **Client Router:** Browser SPA strictly serves `/admin`, `/admin/draft`, `/admin/publications`, `/admin/audience` (all behind `AdminAuthGuard`), `/signin` (and `/login` alias), `/privacy`, and `/terms`. Root `/` and unknown routes redirect to `/admin`.
- **PWA Gating:** Manifest `<link rel="manifest">` and Service Worker registration are completely stripped; service worker files removed from admin codebase.

### Edge Worker Clock Leeway (`verifyFirebaseIdToken`)
- **Tokens:** Firebase ID tokens verified against Google public JWKs.
- **Clock Drift Tolerance:** Allows 60 seconds leeway on `iat` (`iat > nowSec + 60`) and `auth_time` (`auth_time > nowSec + 60`) before rejection to prevent spurious failures across server clock skew.









