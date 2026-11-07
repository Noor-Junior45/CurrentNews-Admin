# CHAOS_TESTS.md — Edge-Case & cURL Test Suite

## 1. Monetization Verification cURL Suite

```bash
# 1. Test app-ads.txt content
curl -s http://localhost:3000/app-ads.txt

# Expected Output:
# google.com, pub-5865716270182311, DIRECT, f08c47fec0942fa0

# 2. Test app-ads.txt HTTP Headers
curl -sI http://localhost:3000/app-ads.txt

# Expected:
# HTTP/1.1 200 OK
# Content-Type: text/plain; charset=utf-8
# Cache-Control: public, max-age=3600, s-maxage=86400

# 3. Test ads.txt content & headers
curl -s http://localhost:3000/ads.txt
curl -sI http://localhost:3000/ads.txt

# 4. Test method not allowed handling (POST to app-ads.txt)
curl -sI -X POST http://localhost:3000/app-ads.txt
# Expected: 405 Method Not Allowed or intercepted

# 5. Test health check endpoint for Cloud Run
curl -sI http://localhost:3000/healthz
# Expected: HTTP/1.1 200 OK
```

## 2. Ad Component Chaos Tests

- **Test A: AdBlocker Extension Enabled:**
  - Launch browser with uBlock Origin or Brave Shields enabled.
  - Navigate to Home Feed and Article reading views.
  - Verify `<AdSpace />` cleanly unmounts and returns `null`. No blank whitespace, gray boxes, or broken layout grids appear.

- **Test B: Native App Route Transitions:**
  - Launch native Android APK on device.
  - Verify AdMob banner anchors at bottom on Home Feed (`/`).
  - Open `/admin`, `/settings`, or `/signin`.
  - Verify `admobManager.hideBanner()` immediately dismisses native banner so it never covers form inputs or action buttons.
  - Return to Home or Article reading view; verify banner re-appears cleanly.

## 3. SEO & Crawler Simulation cURL Suite

```bash
# 1. Test robots.txt contains Googlebot & Googlebot-News rules
curl -s http://localhost:3000/robots.txt

# 2. Test sitemap.xml returns application/xml with Google News schema
curl -s http://localhost:3000/sitemap.xml | head -n 30

# 3. Simulate Googlebot user-agent crawling an article
curl -s -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" http://localhost:3000/ | grep -i "Current News Live"

# 4. Verify noindex header/meta on /admin route
curl -s http://localhost:3000/admin | grep -i "noindex"

# 5. Verify Jharkhand Regional Geo Meta Tags
curl -s http://localhost:3000/ | grep -iE "geo.region|geo.placename|news near Jharkhand"

# 6. Verify Googlebot pre-rendering on /?category=Jharkhand
curl -s -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" "http://localhost:3000/?category=Jharkhand" | grep -i "Jharkhand News"
```

## 4. Cloudflare R2 & Zero-Quota Article cURL Suite

```bash
# 1. Fetch public articles feed backed by R2
curl -s http://localhost:3000/api/posts?limit=3 | jq '{ total: .total, postsCount: (.posts | length), fromCache: .fromCache }'

# 2. Fetch single article directly via API
curl -s http://localhost:3000/api/posts/Mb0SKs2bF11I7JvCu2HJ | jq '{ id: .post.id, title: .post.title }'

# 3. Verify Cloudflare R2 direct public CDN access
curl -sI https://media.currentnews.blog/articles/feed.json
# Expected: HTTP/2 200 OK, Content-Type: application/json

# 4. Verify R2 article sync endpoint (dry test)
curl -s -X POST http://localhost:3000/api/articles/sync \
  -H "Content-Type: application/json" \
  -d '{"posts":[]}' | jq .
# Expected: { "success": true, "synced": 0, "total": 0 }
```

## 5. Load Balancer, Ingress & Health Probe Test Suite

```bash
# 1. Test Cloud Run liveness probe
curl -sI http://localhost:3000/healthz
# Expected: HTTP/1.1 200 OK, Content-Type: text/plain

# 2. Test Google Cloud Load Balancer readiness probe (RAM & Uptime telemetry)
curl -s http://localhost:3000/readyz
# Expected: { "status": "ready", "uptimeSec": ..., "heapUsedMb": ..., "platform": "google-cloud-run" }

# 3. Test multi-origin cluster health probe
curl -s http://localhost:3000/api/lb/status
# Expected: { "status": "healthy", "node": "gcp-cloud-run-primary", ... }

# 4. Test proxy header preservation (X-Forwarded-For & X-Forwarded-Proto)
curl -s -H "X-Forwarded-For: 203.0.113.195" -H "X-Forwarded-Proto: https" http://localhost:3000/api/lb/status
```

## 6. Server-Driven In-App Update Test Suite (Option B)

```bash
# 1. Fetch current required app version configuration
curl -s http://localhost:3000/api/app/version | jq .
# Expected: { "success": true, "latestVersion": "...", "latestVersionCode": ..., "forceUpdate": false }

# 2. Test updating app version requirement via POST (Simulate publishing new release)
curl -s -X POST http://localhost:3000/api/app/version \
  -H "Content-Type: application/json" \
  -d '{
    "latestVersion": "1.0.2",
    "latestVersionCode": 3,
    "title": "New Live Edition Available",
    "releaseNotes": ["Security upgrades and faster offline dispatches"],
    "forceUpdate": false
  }' | jq .
# Expected: { "success": true, "message": "App version configuration updated successfully" }
## 7. Push Notifications & FCM Ping All Devices Test Suite

```bash
# 1. Fetch active VAPID public key
curl -s http://localhost:3000/api/push/public-key | jq .
# Expected: { "success": true, "publicKey": "..." }

# 2. Check current push subscriber device count
curl -s http://localhost:3000/api/push/subscribers-count | jq .
# Expected: { "success": true, "count": <number> }

# 3. Ping all subscribed devices via Firebase Cloud Messaging / Web Push
curl -s -X POST http://localhost:3000/api/push/broadcast \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Current News Alert",
    "body": "Test ping broadcast to all active devices",
    "url": "/"
  }' | jq .
# Expected: { "success": true, "message": "...", "sent": ..., "failed": ..., "purged": ... }
```




## 6. Role Authorization & Host Segregation Chaos Tests

```bash
# 1. Verify 401 Unauthorized when calling /api/admin/articles without Bearer token
curl -s -i -X POST http://localhost:3000/api/admin/articles \
  -H "Content-Type: application/json" \
  -d '{"title": "Unauthorized Test"}'
# Expected: HTTP/1.1 401 Unauthorized {"success":false,"error":"Unauthorized: Missing or invalid Authorization header"}

# 2. Verify 401 Unauthorized when Bearer token is invalid or expired
curl -s -i -X GET http://localhost:3000/api/admin/articles \
  -H "Authorization: Bearer invalid-token-12345"
# Expected: HTTP/1.1 401 Unauthorized {"success":false,"error":"Unauthorized: Invalid authentication credentials"}

# 3. Verify 401 Unauthorized on write endpoint (/api/upload) without Bearer token
curl -s -i -X POST http://localhost:3000/api/upload
# Expected: HTTP/1.1 401 Unauthorized

# 4. Verify host redirection on production reader host
curl -s -I -H "Host: currentnews.blog" http://localhost:3000/admin
# (In production behind GCLB):
# Expected: HTTP/1.1 301 Moved Permanently
# Location: https://admin.currentnews.blog/admin

# 5. Verify admin API returns 404 on reader domain
curl -s -i -H "Host: currentnews.blog" http://localhost:3000/api/admin/articles
# Expected: HTTP/1.1 404 Not Found {"success":false,"error":"Not found"}

# 6. Verify X-Robots-Tag on admin host
curl -s -I -H "Host: admin.currentnews.blog" http://localhost:3000/admin
# Expected: X-Robots-Tag: noindex, nofollow
```

## 7. Standalone Admin Portal Chaos & PWA Removal Tests

```bash
# 1. Verify healthz returns 200 OK on admin host
curl -s -i -H "Host: admin.currentnews.blog" http://localhost:3000/healthz
# Expected: HTTP/1.1 200 OK, Content-Type: text/plain; charset=utf-8, body: OK

# 2. Verify readyz returns 200 JSON on admin host
curl -s -i -H "Host: admin.currentnews.blog" http://localhost:3000/readyz
# Expected: HTTP/1.1 200 OK, Content-Type: application/json; charset=utf-8

# 3. Verify non-admin API endpoint returns JSON 404 on admin host
curl -s -i -H "Host: admin.currentnews.blog" http://localhost:3000/api/unknown-reader-path
# Expected: HTTP/1.1 404 Not Found, Content-Type: application/json, body: {"error":"Not found"}

# 4. Verify root path 302 redirects to /admin on admin host
curl -s -I -H "Host: admin.currentnews.blog" http://localhost:3000/
# Expected: HTTP/1.1 302 Found, Location: /admin

# 5. Verify index.html has zero PWA manifest links
curl -s http://localhost:3000/index.html | grep -i 'rel="manifest"'
# Expected: (empty / 0 matches)

## 8. Sign In View (Design Variation 4) Chaos & Edge-Case Tests

```bash
# 1. Verify /signin returns 200 OK with editorial shell
curl -s -I http://localhost:3000/signin
# Expected: HTTP/1.1 200 OK

# 2. Verify /login redirects cleanly to /signin
curl -s -I http://localhost:3000/login
# Expected: 200 OK (via client router redirect to /signin)

# 3. UI Chaos: Form submission without agreeing to Terms
# Action: Enter email, click Continue -> Enter password, click Authenticate Access without checking the terms box.
# Expected: Immediate error banner: "Please agree to our Terms of service and Privacy policy before authenticating."
# No network request dispatched to Firebase; zero UI freeze.

# 4. UI Chaos: Rapid double-click on "Authenticate Access"
# Action: Spam double click on submit button.
# Expected: Button enters disabled state with "Authenticating..." pulse; second click is ignored via isSubmitting guard.

# 5. UI Chaos: Malformed email string
# Action: Enter "invalid@@example" or "plainaddress" and click Continue.
# Expected: Client-side validation blocks submit and displays "Please enter a valid email address."
```

