# DO_NOT_TOUCH.md — Locked UI & Core Logic Registry

The following files, components, and logic structures represent the standalone Browser-Only Admin Editorial Portal for **admin.currentnews.blog**. They MUST NOT be rewritten, restyled, deleted, or altered without explicit instructions:

1. **Admin Editorial Views (`src/views/`)**
   - `src/views/AdminView.tsx`: Central router dispatching to dedicated sub-views via URL search param (`?focus=draft`, `?focus=publications`, `?focus=audience`, `?focus=dashboard`).
   - `src/views/AdminDashboardView.tsx`: Editorial Author Byline manager with inline pen name editing, Neon/R2 sync stats, and 5-card metric ledger (`Live Active Dispatches`, `Draft Manuscripts`, `Media Broadcasts`, `Audience Subscribers`, `Published Image`).
   - `src/views/DraftPublicationView.tsx`: Production article composer with full-width layout, photo attachment manager placed directly above the manuscript, category selector, smart hashtags, reference link manager, auto-expanding title textarea, and save/publish flows.
   - `src/views/CurrentPublicationsView.tsx`: Publications management ledger with persistent sticky header, single-line mobile filter tabs (`All`, `Published`, `Drafts`), edit shortcuts, archive/delete controls, and D1 sync status indicators (`Live`, `Sync pending`, `Sync failed`).
   - `src/views/AudienceRegistryView.tsx`: Push notification broadcast console with live subscriber device counter, email testing utility, and full subscriber registry.

2. **Authentication & Legal Stage (`src/views/`)**
   - `src/views/SignInView.tsx`: Editorial login stage serving as root landing page (`/`) and `/signin`, styled per refined Design Variation 2 with an unboxed, borderless presentation sitting directly on a Lavender Blush (`#FFF0F5`) background. Features header with enlarged framed logo on the left (`w-20 h-20 sm:w-24 sm:h-24`) aligned cleanly with the email & password inputs, Cormorant Garamond "Current News" heading with "Admin" directly below on the second line on the right, high-contrast typography throughout, streamlined "Email" field label, clean underline input styling, forgot password action beneath password line, square agreement checkbox, high-contrast primary CTA button, official colorful Google Sign-In button, and copyright footer.
   - `src/views/PrivacyView.tsx`: Comprehensive 12-section global privacy codex styled in warm beige/cream newspaper paper mode with table of contents and navigation to `/admin`.
   - `src/views/TermsView.tsx`: Comprehensive 13-section international terms of service codex with DMCA procedures, liability limits, and navigation to `/admin`.

3. **Core Reusable Components (`src/components/`)**
   - `src/components/AdminLayout.tsx`: Persistent administrative shell wrapper mounting `AdminNavbar` permanently across all editorial routes, ensuring the navigation bar and profile buttons never unmount or flicker when switching tabs.
   - `src/components/AdminNavbar.tsx`: Unified 2-row sticky navigation bar for the Admin Editorial Desk.
     - Row 1: Logo (`/CurrentNews.png`) + name `Current news - Admin` in Baloo 2 font (tag removed); circle profile button on right with flyout dropdown (User card, Privacy Policy, Terms of Service, Delete Account modal, Sign Out).
     - Row 2: Centered horizontal navigation tabs (`Dashboard`, `Drafts`, `Publications`, `Audience`) without enclosing pill box, matching reference image design with vertical dividers, colored icons (emerald, indigo, blue, amber), responsive mobile font fitting with proper margins, liquid wave animations, and 100% offline touch-swipe gesture navigation.
   - `src/components/AdminAuthGuard.tsx`: Role-gating wrapper enforcing authenticated sessions with admin/writer privileges; redirects unauthenticated users directly to `/signin` and presents role-assignment notices with safe account switching for unauthorized users.
   - `src/components/ProfilePageNavbar.tsx`: Sticky top navigation bar with tailless back chevron button, bold title, and fallback navigation to `/admin`.
   - `src/components/RichTextEditor.tsx`: Clean Quill WYSIWYG editor with full-box tap-to-type caret placement, dark mode styling, and imperative photo embedding handle.
   - `src/components/PhotoAttachmentSection.tsx`: Primary and gallery photo uploader with Cloudflare R2 integration, placement selectors (`top`, `middle`, `bottom`), and thumbnail previews.
   - `src/components/ErrorBoundary.tsx`: Root-level error boundary capturing uncaught render exceptions with instant recovery.

4. **Backend Server & Database Infrastructure**
   - `server.ts`: Express full-stack server bound to `0.0.0.0:PORT` (3000 dev, 8080 Cloud Run) with GCLB keep-alive alignment, `/healthz` and `/readyz` probes, and host routing for `admin.currentnews.blog`.
   - `server/api/adminArticles.ts`: Zod-validated article persistence handlers with rich text HTML sanitization (`sanitize-html`), optimistic concurrency locking, Neon Postgres storage, and audit logging.
   - `server/auth/firebaseAdmin.ts` & `server/auth/requireRole.ts`: Firebase Admin SDK token verification with custom claims (`role === 'admin' | 'writer'`), email verification checks, and structured error codes.
   - `server/auth/tokenVerifier.ts`: Resilient multi-tier Firebase ID token verification with fallback to cryptographic RS256 signature verification via Google's public x509 certs when Identity Platform API is unreachable or ADC credentials lack IAM permissions.
   - `server/db/neon.ts`: Serverless Neon PostgreSQL client with connection pooling.
   - `server/sync/d1Publisher.ts`: HMAC-SHA256 signed Cloudflare D1 outbox synchronization pipeline.
   - `src/server/r2Upload.ts` & `src/server/r2Articles.ts`: Direct AWS S3 SDK integration for Cloudflare R2 object storage and base64 image migration.

5. **Essential Utilities**
   - `src/utils/adminFetch.ts`: Universal client-side fetch helper with automatic Firebase ID token attachment, `authStateReady()` synchronization, and token auto-refresh on 401.
   - `src/utils/authHelper.ts`: Safe popup authentication handler with cross-origin resilience.
   - `src/utils/imageUrl.ts`: URL sanitization guaranteeing clean HTTPS media links.
   - `src/utils/compressedStorage.ts`: LZW-compressed client storage for zero-latency draft caching.
   - `src/utils/writers.ts`: Dynamic staff and pen name validation helpers.
