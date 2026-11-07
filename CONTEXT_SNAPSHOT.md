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
- **Phase 3 (Login Page Clean Redesign):** [COMPLETED]
  - Redesigned `SignInView.tsx` matching the clean original structure:
    - Line 1: "Current News" title in bold display font.
    - Line 2: "Admin" subtitle in uppercase monospace.
    - Below Admin: "Sign in" (or "Create account") heading in muted slate.
    - Below heading: Clean Email & Password input fields both visible together with icon adornments, focus states, and password reveal toggle.
    - "Sign in" primary button with spinner feedback during authentication.
    - Below Sign in button: "Google" button featuring official colorful Google 4-color SVG logo directly before text.
    - Retained Terms & Privacy policy acceptance checkbox with direct legal links, forgot password reset flow, and toggle between Sign In and Create Account.
  - Verified 0 TypeScript compilation errors and 0 lint warnings across `compile_applet` and `lint_applet`.
- **Phase 4 (Authentication Backend Resilience & Public Cert Fallback):** [COMPLETED]
  - Root caused `auth/internal-error` (HTTP 503 `auth_backend_error`) on `/api/admin/*`: revoked token checking in `firebase-admin` defaulted to `true`, requiring Google Identity Platform `accounts:lookup` which failed under Cloud Run / sandbox ADC credentials.
  - Implemented `/server/auth/tokenVerifier.ts` providing multi-tier token verification: attempts `verifyIdToken(token, false)` first, and falls back to cryptographic RS256 signature verification against Google's public x509 certs.
  - Added Bootstrapped Admin assignment in `/server/auth/requireRole.ts` and `/src/hooks/useAuthState.ts` for runtime admin email `mdnoor4860@gmail.com` and secondary admin `mdhassan1738@gmail.com`.
  - Upgraded email verification checking to accept Google Sign-In provider tokens.
- **Phase 5 (Root Landing Page & Borderless Minimalist Login Stage):** [COMPLETED]
  - Configured `src/App.tsx` router with root path `"/"` serving `SignInView.tsx` directly as the landing page.
  - Removed top "Back to Admin" and "Editorial Access" header shortcut from `SignInView.tsx`.
  - Removed outer box border, card container outline, and heavy box shadow from `SignInView.tsx` `<main>` element, creating a seamless, borderless canvas that blends with the page background.
  - Aligned `AdminAuthGuard.tsx` and `AdminNavbar.tsx` sign-out transitions to route cleanly to root `"/"`.
- **Phase 6 (Design Variation 2 — Editorial Typography & Underline Aesthetics):** [COMPLETED]
  - Applied Design Variation 2 to `SignInView.tsx`: warm editorial paper palette (`#FDFCFB`), 64px framed logo, Cormorant Garamond serif brand typography, crimson `Editorial Desk` badge (`#B22222`), clean underline inputs, square terms checkbox, and autonomous press alliance footer.
  - Imported Cormorant Garamond into `src/index.css` and added preconnect links in `index.html`.
- **Phase 7 (Refined Variation 2: Top Line Removal, Editorial Hierarchy & High-Contrast Typography):** [COMPLETED]
  - Removed top 80px horizontal accent line above the login stage (CSS Selector 1).
  - Repositioned the crimson "Editorial Desk" badge directly below the "Current News" brand heading (CSS Selector 3).
  - Moved the "Forgot?" password reset trigger beneath the horizontal underline of the password field (CSS Selector 2).
  - Elevated all text elements, input placeholders, labels, icons, and legal disclaimers to high-contrast dark black in light mode and crisp white in dark mode.
- **Phase 8 (Login Flicker Elimination & Zero-Latency Auth State Synchronization):** [COMPLETED]
  - Eliminated login-to-dashboard navigation flicker caused by claims propagation latency and duplicate route transitions.
  - Implemented `syncUserAuthState(user)` using local cached token parsing (`getIdTokenResult(false)`).
  - Synchronized in-memory auth state before invoking `navigate('/admin')`.
  - Replaced concurrent `onAuthStateChanged` hook in `SignInView.tsx` with mount-time `auth.authStateReady()`.
  - Added synchronous `auth.currentUser` fallback inspection in `AdminAuthGuard.tsx` to prevent premature bounce-backs and eliminate unauthorized screen flashes.
- **Phase 9 (Side-by-Side Brand Header & Email Label Streamlining):** [COMPLETED]
  - Restructured branding header in `SignInView.tsx` into a horizontal row: framed logo on the left (`w-14 h-14 sm:w-16 sm:h-16`) and `Current News` serif heading with crimson `Editorial Desk` badge on the right (`text-left`).
  - Streamlined input label from `Email Address` to `Email` (targeting focus CSS Selector 1 & 2).
  - Preserved centered section divider title (`Sign in to Admin` / `Create an Account`), high-contrast typography, and zero-flicker auth synchronization.

- **Phase 10 (Login Header Streamlining & Two-Line Brand Hierarchy):** [COMPLETED]
  - Removed "Editorial Desk" badge and "Sign in to Admin" section title from `SignInView.tsx`.
  - Enlarged left-side framed logo (`w-20 h-20 sm:w-24 sm:h-24`).
  - Positioned `Current News` on line 1 and `Admin` directly below in line 2 left-aligned under `Current`.
  - Maintained high-contrast typography, email/password inputs, Google Sign-In, and zero-flicker auth state synchronization.

- **Phase 11 (Lavender Blush Palette, Glassmorphism Backdrop & Left-Aligned Logo):** [COMPLETED]
  - Shifted header brand row from centered to left-aligned (`justify-start`), aligning the left edge of the enlarged logo directly with the left boundary of the Email and Password fields.
  - Updated stage background to Lavender Blush (`#FFF0F5`) with ambient illumination orbs.
  - Implemented frosted glassmorphic card backdrop (`bg-white/60 dark:bg-black/35 backdrop-blur-xl border border-white/70 shadow-lg rounded-2xl`).
  - Preserved all existing texts, input stylings, password reveals, and button designs/colors without alteration.

- **Phase 12 (Direct Background Presentation & Enclosing Box Removal):** [COMPLETED]
  - Removed enclosing card box styling (glass panel, borders, backdrop blur, rounded corners, and shadow) from `<main>`.
  - Shifted all elements (logo, heading, email & password inputs, terms checkbox, sign in CTA, Google button, create account toggle, and copyright footer) directly onto the clean Lavender Blush (`#FFF0F5`) background.
  - Preserved left alignment of logo with input fields, typography styles, button colors, and auth flows.

- **Phase 13 (Eradication of Hardcoded API Endpoints & Project IDs):** [COMPLETED]
  - Purged hardcoded project ID (`gen-lang-client-0638643565`) from `server/auth/firebaseAdmin.ts`, `api/rss.xml.ts`, and `api/sitemap.xml.ts`, replacing with dynamic resolution from environment variables and `firebase-applet-config.json`.
  - Replaced outdated hardcoded database ID (`ai-studio-6e2ba5e1-c245-4586-90fd-9ba4777b81c4`) with dynamic discovery from `FIRESTORE_DATABASE_ID` and configuration files.
  - Eliminated hardcoded external worker API (`https://api.currentnews.blog`) from `src/utils/api.ts` and `server/sync/d1Publisher.ts`, defaulting to relative paths or strict `WORKER_BASE_URL` env enforcement.
  - Purged hardcoded R2 dev storage domain (`pub-03dd1274c4824531a1478f20e0485d75.r2.dev`) from `src/server/r2Articles.ts`, `src/server/r2Upload.ts`, `api/upload.ts`, and `src/utils/imageUrl.ts`.
  - Parameterized `pubId` in `api/ads.txt.ts` and `api/app-ads.txt.ts` to support `ADSENSE_PUB_ID` and `ADMOB_PUB_ID`.
  - Updated `.env.example` with full configuration definitions.

## 4. Immediate Next Step
- Maintain full operational readiness for newsroom editors and administrative dispatching.


