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
  - Row 1: Logo (`/CurrentNews.png`) + name `Current News Admin` in Lora font (`font-lora font-semibold`); circle profile button on right.
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
  - Role assignment is managed via `node scripts/set-role.mjs <email> admin` (sets Firebase Custom Claims).
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

- **Phase 14 (Cloud Run Deployment Fixes & Zero-Flicker Layout Architecture):** [COMPLETED]
  - Resolved Cloud Run boot crash (`ERR_MODULE_NOT_FOUND` importing `/workspace/src/utils/webBase`) by inlining the self-contained `webUrl` helper inside `src/utils/imageUrl.ts` and decoupling `webBase.ts` from Capacitor dependencies.
  - Resolved `vite build` failure by fully restoring `src/firebase.ts` singleton initialization exporting `app`, `auth`, `db`, and `handleFirestoreError`.
  - Resolved `SyntaxError: The requested module 'pg' does not provide an export named 'QueryResult'` in `server/db/neon.ts` by using type-only import specifiers `import type { Pool as PgPool, QueryResult, QueryResultRow } from 'pg'`.
  - Implemented `AdminLayout.tsx` persistent administrative shell hosting `AdminNavbar` permanently across all child routes, eliminating full-page loading buffers.
  - Validated both `npm run build` and direct `node server.ts` / `node server.cjs` boot with HTTP 200 on `/healthz`.

- **Phase 15 (AI Studio Development Preview IFrame Connectivity):** [COMPLETED]
  - Diagnosed "refused to connect" error in AI Studio development preview iframe (`https://ais-dev-*.asia-southeast1.run.app`).
  - Identified root cause in `server.ts`: Helmet's default `X-Frame-Options: SAMEORIGIN`, `Cross-Origin-Opener-Policy: same-origin`, and `Content-Security-Policy: frame-ancestors 'self'` headers blocked embedding inside the AI Studio parent window.
  - Configured `helmet({ frameguard: false, crossOriginOpenerPolicy: false, crossOriginResourcePolicy: false })` and explicitly set `frameAncestors: ["'self'", 'https://*.google.com', 'https://*.run.app', 'http://localhost:*']`.
  - Locked dev server port to `3000` (`process.env.NODE_ENV === 'production' ? (process.env.PORT || 8080) : 3000`).
  - Rebuilt production bundle and verified dev server is serving HTTP 200 OK on both port 3000 and 8080 with zero frame-blocking headers.

- **Phase 16 (Login Header Typography: Lora Regular & Single-Line Fit):** [COMPLETED]
  - Imported Google Font `Lora` (`Lora:ital,wght@0,400;0,500;0,600;1,400`) in `src/index.css` and configured `--font-lora` and `.font-lora`.
  - Updated `SignInView.tsx` header section:
    - CSS Selector 1 (`h1` "Current News"): Applied `font-lora font-normal text-xl xs:text-2xl sm:text-3xl whitespace-nowrap leading-tight tracking-normal`, ensuring "Current News" fits comfortably in a single line across mobile and desktop.
    - CSS Selector 2 (`div` "Admin"): Applied `font-lora font-normal text-lg xs:text-xl sm:text-2xl leading-tight tracking-normal`.
  - Kept all other pages and components intact per the "header section only" constraint.
  - Verified 0 TypeScript errors and 0 lint warnings across `compile_applet` and `lint_applet`.

- **Phase 17 (Sign In Submit Button Lora Typography & Calibrated Header Size):** [COMPLETED]
  - Applied `font-lora font-medium text-sm sm:text-base normal-case` to the Sign In / Create Account submit button `<span>` (CSS Selector 1).
  - Moderately increased the header "Current News" font size (`text-2xl xs:text-[1.75rem] sm:text-3xl md:text-4xl`) and "Admin" font size (`text-xl xs:text-2xl sm:text-3xl`) while strictly maintaining its single-line layout and exact horizontal position on phone screens with `whitespace-nowrap` (CSS Selector 2).
  - Kept all other layouts, buttons, and views intact.
  - Verified 0 TypeScript compilation errors and 0 lint warnings.

- **Phase 18 (Admin Navbar Brand Identity Update):** [COMPLETED]
  - Updated Row 1 of `AdminNavbar.tsx` (CSS Selector 1: `a#admin-brand-link`):
    - Removed the hyphen `[-]` separator.
    - Set the text to `Current News Admin` styled in Baloo 2 font (`font-baloo text-lg sm:text-2xl font-bold tracking-tight text-slate-950 dark:text-white leading-none`).
  - Preserved the framed logo, circle profile button, and sticky layout structure.
  - Verified 0 TypeScript compilation errors and 0 lint warnings.

- **Phase 19 (Admin Navbar Lora Typography Refinement):** [COMPLETED]
  - Updated Row 1 of `AdminNavbar.tsx` (CSS Selector 1: `a#admin-brand-link`):
    - Changed brand heading font from Baloo to Lora (`font-lora text-lg sm:text-2xl font-semibold tracking-tight text-slate-950 dark:text-white leading-none`).
  - Preserved the clean `Current News Admin` title, framed logo, and right-aligned circular profile menu.
  - Verified 0 TypeScript compilation errors and 0 lint warnings across `compile_applet` and `lint_applet`.

- **Phase 20 (Codebase Security & Secrets Elimination Audit):** [COMPLETED]
  - Executed a full-codebase adversarial audit scanning for hardcoded secrets, database passwords, private keys, AWS access tokens, and API credentials.
  - Confirmed 0 private keys, 0 hardcoded database credentials, and 0 secret tokens in source files.
  - Refactored `src/firebase.ts` to dynamically import `firebase-applet-config.json` with runtime environment variable overrides (`VITE_FIREBASE_API_KEY`, etc.), eliminating hardcoded API key string literals.
  - Confirmed that `.env.example` contains only blank placeholder definitions with zero production values committed.
  - Verified 0 TypeScript compilation errors and 0 lint warnings across `compile_applet` and `lint_applet`.

- **Phase 21 (Draft Publishing Date Picker & Responsive In-Line Layout):** [COMPLETED]
  - Added interactive publishing date selector button to `DraftPublicationView.tsx` (CSS Selector 1 & 2):
    - Defaults automatically to the current date (`YYYY-MM-DD`) with active "Today" indicator badge.
    - Provides instant "Reset to Today" action when a custom date is selected.
    - Responsive layout: divided evenly in-line on larger screens/tablets (`sm:grid-cols-2`), stacked with the date box below the category box on phone screens (`grid-cols-1`).
    - Propagates custom or default publication date into `createdAt` in `fullPostToSave` and `server/api/adminArticles.ts` Neon PostgreSQL persistence.

- **Phase 22 (Cross-Origin IFrame Date Picker Resilience — Zero SecurityError):** [COMPLETED]
  - Eliminated uncaught browser `SecurityError: Failed to execute 'showPicker' on 'HTMLInputElement': showPicker() called from cross-origin iframe` in `src/views/DraftPublicationView.tsx`.
  - Replaced JavaScript-driven `.showPicker()` with a transparent native `<input type="date">` overlay spanning the button display card (`absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0`).
  - User click and touch gestures interact directly with the native browser input, opening the OS datepicker natively across desktop, iOS, Android, and cross-origin iframe preview containers without invoking restricted JavaScript methods.
  - Verified 0 TypeScript compilation errors and 0 lint warnings across `compile_applet` and `lint_applet`.

- **Phase 23 (Unused API Key Purge & Cloud Shell Role Administration Readiness):** [COMPLETED]
  - Purged unused `GEMINI_API_KEY` from `.env.example` and removed `@google/genai` dependency from `package.json`, ensuring zero unnecessary API key requirements.
  - Organized `.env.example` into explicit, well-documented sections (Firebase Auth, Neon PostgreSQL, Cloudflare R2, Cloudflare D1 Sync, Web Push VAPID, Resend Mail, Security & Host Routing).
  - Enhanced `scripts/set-role.mjs` to auto-detect `GOOGLE_CLOUD_PROJECT` in Google Cloud Shell and added actionable error guidance (`auth/user-not-found`) directing operators to have staff sign in first before assigning roles.
  - Confirmed 0 hardcoded staff emails, 0 bypass paths, and verified 100% role enforcement strictly through cryptographically signed Firebase Custom Claims.
  - Re-validated `compile_applet` (Vite + esbuild) and `lint_applet` (`tsc --noEmit`) with 0 errors and 0 warnings.

- **Phase 24 (Admin Navbar Brand Left-Anchor on Large Screens):** [COMPLETED]
  - Identified cause of brand logo/name being pushed inwards on large desktop screens: `max-w-7xl mx-auto` clamped header Row 1 to 1280px and centered it.
  - Replaced `max-w-7xl mx-auto` with `w-full px-3 sm:px-6 lg:px-8 xl:px-10` and added `shrink-0` to `a#admin-brand-link`.
  - Preserved phone (`px-3`) and tablet (`px-6`) layouts while ensuring the brand logo and title anchor cleanly to the left edge with calibrated responsive margins on desktop monitors.
  - Verified 0 TypeScript compilation errors and 0 lint warnings across `compile_applet` and `lint_applet`.

- **Phase 25 (Invite-Only Access Request & Pre-Formatted Email Questionnaire):** [COMPLETED]
  - Removed "Don't have an account? Create one" toggle line from `SignInView.tsx` footer (CSS selector 1 & 2).
  - Streamlined UI label to simply "Email Us" (hiding raw email from the screen, while populating `admin@currentnews.blog` as recipient in the user's email client).
  - Configured comprehensive questionnaire body: Full Name, Sign-in Email Address, Mobile/WhatsApp Number, Requested Role, Beat/Reason, Newsroom Reference, and optional Social Handles (Instagram/Facebook/X/LinkedIn).
  - Refined closing note: "Please note: Once submitted, our editorial administration team will review and verify your application credentials. Upon successful verification, your assigned editorial role will be activated and confirmed to you."
  - Maintained zero UI flicker, high-contrast typography, and full dark-mode compatibility.
  - Verified 0 TypeScript compilation errors and 0 lint warnings across `compile_applet` and `lint_applet`.

- **Phase 26 (Role Assignment Stage: Tuscan Sunset Palette & Login as Reader Redirect):** [COMPLETED]
  - Removed enclosed white box/border/card styling from `div#unauthorized-slate` in `AdminAuthGuard.tsx` (CSS selector 1).
  - Applied the "Tuscan sunset" color palette:
    - Full-viewport background: Tuscan Sunset `#FFD3AC`.
    - Shield Icon badge: Sage Green `#A2AE9D` with Charcoal `#54463A`.
    - Headings and typography: Deep Earth Charcoal `#54463A`.
    - Account Switcher CTA: Deep Earth Charcoal `#54463A` with white text.
    - Reader Navigation CTA: Deep Rose `#C75F71` with white text (CSS selector 2).
  - Replaced "Sign Out & Return to Sign In" with "Login as Reader" redirecting users to `https://currentnews.blog/signin`.
  - Verified 0 TypeScript compilation errors and 0 lint warnings across `compile_applet` and `lint_applet`.
- **Phase 27 (Audience Push Count Bearer Authorization Fix):** [COMPLETED]
  - Identified cause of `[auth] no_token GET /api/push/subscribers-count hasHeader=false`: `AudienceRegistryView.tsx` called the protected `/api/push/subscribers-count` endpoint using bare browser `fetch()` instead of `adminFetch()`.
  - Refactored `fetchPushCount()` to use `adminFetch<{ success?: boolean; count: number }>()`.
  - Automatically attaches the verified Firebase ID Bearer token, synchronizes with `authStateReady()`, avoids unauthenticated network call spam on mount, and eliminates backend 401 logs.
  - Verified 0 TypeScript compilation errors and 0 lint warnings across `compile_applet` and `lint_applet`.
- **Phase 28 (Navbar #fbf1e5, Playfair Regular Font & Large Screen Centered Tabs):** [COMPLETED]
  - Changed AdminNavbar top background to `#fbf1e5` with subtle border `#ebd7c1` (CSS selector 1 & 2).
  - Updated font of `Dashboard`, `Drafts`, `Publications`, and `Audience` to Playfair Display regular (`font-playfair font-normal`) with zero bolding in active/inactive states.
  - Centered all 4 navigation buttons in the middle of the second row on laptop (`lg:`, `xl:`) and tablet (`md:`) screens (`flex justify-center`).
  - Switched root container overflow from `overflow-x-hidden` to `overflow-x-clip`, ensuring the navbar remains permanently fixed/sticky at the top (`top: 0`) while all page content scrolls smoothly under it.
- **Phase 29 (Delete Account Modal Button Grid & Copy Confirmation Trigger):** [COMPLETED]
  - Formatted the action buttons in the Delete Account modal (`AdminNavbar.tsx`) as an equal-width 2-column grid (`grid grid-cols-2 gap-3`, CSS selector 1 & 2).
  - Styled the Cancel button with background `#cce3de`, `#164e43` high-contrast typography, and border `#a3cdc4`.
  - Added a responsive copy icon next to the `DELETE` confirmation text (CSS selector 4) that copies "DELETE" to the clipboard and provides visual checkmark feedback without background box enclosure, matching user guidance.
- **Phase 30 (Draft Page Canvas #f6dfdf, Spaced Category Dropdown Arrow & Refined Publish Date):** [COMPLETED]
  - Changed Draft page background to `#f6dfdf` (`div#draft-publication-view`).
  - Spaced dropdown arrow in Category select (`select#post-category`) a generous 20px (`1.25rem`) away from the border using custom chevron positioning with `pl-4 pr-12` and `appearance-none` (CSS selector 1 & 5).
  - Cleaned the Publish Date button display: removed the calendar icon inside the box, eliminated the background/border box from the "Today" indicator for an unboxed presentation, and anchored the calendar icon inside the Publish Date heading label (CSS selector 2, 3, 4).
- **Phase 31 (Unified Reference Link Section with Official YouTube & Facebook Embed Inputs):** [COMPLETED]
  - Removed old standalone Media Embeds container (`div:nth-of-type(5)`) with separate YouTube broadcast and Facebook reel labels.
  - Consolidated YouTube and Facebook into the Reference Link section directly above the custom hyperlinks box:
    - Added YouTube input box with official red YouTube logo on the left at the start of the box, accepting full URLs or embed codes.
    - Added Facebook input box with real official circular blue `#1877F2` Facebook logo on the left at the start of the box, accepting links or embed codes.
  - Kept the empty reference links box and "Add Hyperlink" button directly below them intact.
- **Phase 32 (Publications 4-Button Centered Filter & Flush Top Offset):** [COMPLETED]
  - Removed "Manage, edit, or delete your publications and drafts." subtitle from the publications page header.
  - Centered all 4 buttons (`All`, `Published`, `Drafts`, `Retry sync`) in the middle of the screen for tab (`md:`) and laptop/desktop displays (`flex-col md:flex-row items-center justify-center`).
  - Redesigned all 4 buttons into rounded-full pills with dedicated color states, distinct monospace count badges, micro-shadows, and press physics (CSS selector 1 & 2).
  - Adjusted sticky offset from `top-[104px] sm:top-[112px]` to `top-[99px] sm:top-[104px]`, eliminating the gap beneath the top navbar so the sub-navbar sits completely flush against it.
  - Verified 0 TypeScript compilation errors and 0 lint warnings across `compile_applet` and `lint_applet`.

- **Phase 33 (Automated Disappear Rule for Outbox Sync & Notification Alerts):** [COMPLETED]
  - Added automated auto-dismiss timer logic to `src/views/CurrentPublicationsView.tsx` (CSS selector 1: `div#current-publications-view > div:nth-of-type(2) > div:nth-of-type(1)`).
  - Outbox sync feedback (`Outbox sync complete: X processed...`) and deletion success notices auto-disappear after 4.5 seconds (`setTimeout` with cleanup ref).
  - Similar notification types (warning messages auto-dismiss in 5s; error alerts auto-dismiss in 6s) adhere to consistent auto-dismiss rules across the view.
  - Also synchronized auto-dismiss timers across `DraftPublicationView.tsx` and `AdminDashboardView.tsx` for cross-portal consistency.
  - Maintained manual `(X)` close buttons, smooth `animate-in fade-in` transitions, and prevented timer leaks during unmounting.
  - Verified 0 TypeScript compilation errors and 0 lint warnings across `compile_applet` and `lint_applet`.

- **Phase 34 (Single-Line Publications Filter & Sync Bar on Phone Screens):** [COMPLETED]
  - Updated `div#current-publications-view > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1)` (CSS selector 1).
  - Switched layout container from `flex-col md:flex-row` to `flex-row items-center justify-center flex-nowrap` across mobile views.
  - Formatted all 4 buttons (`All`, `Published`, `Drafts`, `Retry sync`) to appear side-by-side in one horizontal line on phone screens with calibrated compact padding (`px-2 xs:px-2.5 py-1`), concise badge sizing (`text-[9.5px] xs:text-[10px]`), and calibrated typography (`text-[11px] xs:text-[11.5px]`).
  - Preserved 100% of the tablet and laptop display sizes, padding, icon dimensions, and layout unchanged (`sm:px-4 sm:py-2`, `sm:text-xs`, `sm:gap-2 md:gap-2.5`).
  - Verified 0 TypeScript compilation errors and 0 lint warnings across `compile_applet` and `lint_applet`.

- **Phase 35 (Publications Page #f6dfdf Canvas & Sub-Navbar #fbf1e5 Palette Match):** [COMPLETED]
  - Styled `CurrentPublicationsView.tsx` page canvas to `bg-[#f6dfdf] dark:bg-[#1f1717] min-h-screen`, matching the exact warm background of the Draft page.
  - Updated the persistent sticky filter sub-navbar background to `bg-[#fbf1e5]/95 dark:bg-[#251e18]/95` with border `border-[#ebd7c1] dark:border-[#3d3228]` (CSS selector 1), matching the main `AdminNavbar` background with seamless visual continuity.
  - Preserved all publication card elevations, single-line mobile filter button arrangements, auto-dismiss rules, and delete modal flows.
  - Verified 0 TypeScript compilation errors and 0 lint warnings across `compile_applet` and `lint_applet`.

- **Phase 36 (Dividing Line Removal & Unified 3-Tier Navbar Fusion):** [COMPLETED]
  - Removed the horizontal line dividing `AdminNavbar` and the publications sub-navbar:
    - Updated `AdminNavbar.tsx` `<header>` to dynamically drop its bottom border and shadow (`border-b-0 shadow-none`) when `activeTab === 'publications'`.
    - Styled `CurrentPublicationsView.tsx` sticky sub-tier with `-mt-[1px]`, exact `bg-[#fbf1e5] dark:bg-[#251e18]` matching, `top-[99px] sm:top-[103px]` flush lock, and bottom border `border-b border-[#ebd7c1] dark:border-[#3d3228] shadow-xs`.
    - Visually fused Row 1 (Brand/Profile), Row 2 (Tabs), and Row 3 (Pill Filters & Retry sync) into ONE unified, continuous navigation header card with zero dividing seams.
  - Verified 0 TypeScript compilation errors and 0 lint warnings across `compile_applet` and `lint_applet`.

- **Phase 37 (Dependency Vulnerability Patching & CI Audit Hardening):** [COMPLETED]
  - Patched `express` to `^4.22.3` (fixing upstream `body-parser` and `proxy-addr` vulnerabilities within current major).
  - Patched `vite` to `^6.4.5` and `react-router-dom` to `^7.18.5` while preserving `firebase` at `^12.15.0`.
  - Removed the unused Firestore client (`db`, `getFirestore`, `initializeFirestore`, `handleFirestoreError`) from `src/firebase.ts`.
  - Regenerated clean `package-lock.json` enabling deterministic `npm ci`.
  - Hardened `.github/workflows/audit.yml` to `npm ci && npx tsc --noEmit && npm audit --omit=dev --audit-level=critical`.
  - Verified `npx tsc --noEmit` and `npm run build` pass with 0 errors.

- **Phase 38 (Logo Serving & Host Routing Root-Cause Fix):** [COMPLETED]
  - Root caused logo invisibility on live custom domains (`admin.currentnews.blog` and `currentnews-hub.cloud.run`):
    - On `admin.currentnews.blog`, `isAllowedAdminPath` middleware lacked root-level static asset patterns, intercepting requests for `/CurrentNews.png` and issuing HTTP 302 redirects to `/admin` (delivering HTML instead of PNG data).
    - On Linux / Cloud Run, filename case-sensitivity caused requests for `/currentnews.png` or other case variations to fail with 404 falling back to `index.html`.
  - Added dedicated top-level Express endpoint in `server.ts` explicitly serving `/CurrentNews.png`, `/currentnews.png`, `/logo.png`, `/favicon.png`, and PWA icons with `Content-Type: image/png`, `Cross-Origin-Resource-Policy: cross-origin`, `Access-Control-Allow-Origin: *`, and `Cache-Control: public, max-age=86400`.
  - Created case-insensitive aliases in `public/` and `dist/` (`currentnews.png`, `logo.png`, `favicon.png`).
  - Whitelisted all static assets (`isStaticAsset`) in `server.ts` host routing middleware to prevent any asset from being 302 redirected.
  - Verified with `curl -I -H "Host: admin.currentnews.blog"` returning HTTP 200 OK with `image/png`.

## 4. Immediate Next Step
- Run `node scripts/set-role.mjs <user-email> admin` (or `writer`) in Google Cloud Shell to grant verified editorial access to staff accounts.






