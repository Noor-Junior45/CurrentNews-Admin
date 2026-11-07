# CONTEXT_SNAPSHOT.md — Multi-AI Handoff Brain

## 1. Current Tech Stack
- **Application:** Standalone Browser-Only Admin Editorial Portal (`admin.currentnews.blog`)
- **Frontend:** React 19, TypeScript 5.8, Tailwind CSS v4, Lucide React, Quill WYSIWYG
- **Runtime & Deployment:** Express on Node.js 22, Google Cloud Run ready (`Dockerfile`, `.dockerignore`)
- **Database & Auth:** Neon PostgreSQL (primary source of truth), Firebase Auth + custom claims (`admin`, `writer`)
- **Storage & Media:** Cloudflare R2 object storage (`media.currentnews.blog`) via AWS S3 SDK
- **Edge Sync Pipeline:** Cloudflare D1 outbox synchronization with HMAC-SHA256 signatures

## 2. Directory Tree
```
├── Dockerfile & .dockerignore
├── api/                      # Modular Express endpoints (mail alerts, rss, sitemap, ads)
├── migrations/               # PostgreSQL schema migrations (001_init.sql, 002_sync.sql)
├── public/                   # Static icons, CurrentNews.png, robots.txt
├── scripts/                  # CLI tools (migrate-neon.mjs, set-role.mjs, resync-d1.mjs)
├── server/                   # Backend modules (api/adminArticles, auth/firebaseAdmin, db/neon, sync/d1Publisher)
├── src/
│   ├── components/           # AdminNavbar, AdminAuthGuard, ProfilePageNavbar, RichTextEditor, PhotoAttachmentSection, ErrorBoundary
│   ├── hooks/                # useAuthState
│   ├── server/               # r2Upload, r2Articles, postsApi, pushNotifications
│   ├── utils/                # adminFetch, authHelper, imageUrl, compressedStorage, writers, api, seo
│   ├── views/                # AdminView, AdminDashboardView, DraftPublicationView, CurrentPublicationsView, AudienceRegistryView, SignInView, PrivacyView, TermsView
│   ├── App.tsx & main.tsx
├── server.ts                 # Full-stack Express entry point bound to 0.0.0.0:PORT
└── index.html                # Editorial Desk shell (PWA-free, service-worker-free)
```

## 3. Completed vs Pending
- **Phase 1 (Admin Isolation & Browser-Only Refactoring):** [COMPLETED]
  - Purged mobile Android code, reader components, AdMob units, client load balancer, and PWA caches.
  - Simplified `src/App.tsx` router with root `/` redirecting to `/admin`.
- **Phase 2 (Persistent Admin Shell, Seamless Navbar & Mobile Touch Swipe):** [COMPLETED]
  - Created `src/components/AdminLayout.tsx` persistent administrative shell hosting `AdminNavbar` permanently across all editorial routes.
  - Eliminated full-page loading buffer flickers when switching tabs via singleton auth state caching in `useAuthState.ts`.
  - Row 1: Logo (`/CurrentNews.png`) + name `Current news - Admin` in Baloo 2 font (tag removed); circle profile button on right.
  - Row 2: Centered buttons without enclosing pill box matching reference image pattern, with distinct colored icons (emerald, indigo, blue, amber), vertical dividers, proper margins, and mobile font fitting (`text-[11px]` to `text-sm`).
  - Pure client-side offline touch-swipe gesture support to navigate smoothly between tabs on mobile/tablet devices without UI lag or scroll conflict.
  - Profile Flyout: Preserved circle avatar button, user identity card, Privacy link, TOS link, Delete account modal with type "DELETE" confirmation guard, and Sign Out button.
  - Verified 0 TypeScript compilation errors and 0 lint warnings.
  - Verified `GET /healthz` returns `200 OK`.

## 4. Immediate Next Step
- Ready for Cloud Run deployment and editorial workflow management.
