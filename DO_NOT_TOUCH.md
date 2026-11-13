# DO_NOT_TOUCH.md — Locked UI & Core Logic Registry

The following files, components, and logic structures represent the standalone Browser-Only Admin Editorial Portal for **admin.currentnews.blog**. They MUST NOT be rewritten, restyled, deleted, or altered without explicit instructions:

1. **Admin Editorial Views (`src/views/`)**
   - `src/views/AdminDashboardView.tsx`: Editorial Author Byline manager with inline pen name editing, Neon/R2 sync stats, and 5-card metric ledger (`Live Active Dispatches`, `Draft Manuscripts`, `Media Broadcasts`, `Audience Subscribers`, `Published Image`).
   - `src/views/DraftPublicationView.tsx`: Production article composer styled on a warm `#f6dfdf` canvas with full-width layout, photo attachment manager placed directly above the manuscript, responsive in-line category (with right-spaced dropdown arrow), publishing date picker button (clean date with unboxed Today indicator, and calendar logo in heading), unified Reference Link section with dedicated YouTube and official Facebook URL/embed code inputs placed above the reference links empty box and Add Hyperlink button, smart hashtags, auto-expanding title textarea, and save/publish flows.
   - `src/views/CurrentPublicationsView.tsx`: Publications management ledger styled on a warm `#f6dfdf` canvas matching the Draft page, with unified sticky sub-navbar fused seamlessly into the main AdminNavbar (`#fbf1e5`) without any dividing horizontal line, centered 4-button pill filter & sync bar (`All`, `Published`, `Drafts`, `Retry sync`) arranged in a single unified line on phone screens and centered on tablet/laptop screens with DB-backed count badges, cursor-based incremental lazy loading (`IntersectionObserver` + load-more fallback + `loading="lazy"` images), edit shortcuts, archive/delete controls, D1 sync status indicators (`Live`, `Sync pending`, `Sync failed`), and automated auto-dismiss timer rules (4.5s for success/outbox sync, 5s for warnings, 6s for errors) with manual dismiss action.
   - `src/views/AudienceRegistryView.tsx`: Push notification broadcast console with live subscriber device counter, email testing utility, and full subscriber registry.

2. **Authentication & Legal Stage (`src/views/`)**
   - `src/views/SignInView.tsx`: Editorial login stage serving as root landing page (`/`) and `/signin`, styled per refined Design Variation 2 with an unboxed, borderless presentation sitting directly on a Lavender Blush (`#FFF0F5`) background. Features header with enlarged framed logo on the left (`w-20 h-20 sm:w-24 sm:h-24`) aligned cleanly with the email & password inputs, Lora regular font (`font-lora font-normal`) for "Current News" rendered on a single line with calibrated sizing (`whitespace-nowrap text-2xl xs:text-[1.75rem] sm:text-3xl md:text-4xl`) with "Admin" directly below on the second line on the right, high-contrast typography throughout, streamlined "Email" field label, clean underline input styling, forgot password action beneath password line, square agreement checkbox, high-contrast primary CTA button with Lora font label (`font-lora font-medium text-sm sm:text-base normal-case`), official colorful Google Sign-In button, editorial access request email action (`admin@currentnews.blog` with pre-filled questionnaire), and copyright footer.
   - `src/views/PrivacyView.tsx`: Comprehensive 12-section global privacy codex styled in warm beige/cream newspaper paper mode with table of contents and navigation to `/admin`.
   - `src/views/TermsView.tsx`: Comprehensive 13-section international terms of service codex with DMCA procedures, liability limits, and navigation to `/admin`.

3. **Core Reusable Components (`src/components/`)**
   - `src/components/AdminLayout.tsx`: Persistent administrative shell wrapper mounting `AdminNavbar` permanently across all editorial routes, ensuring the navigation bar and profile buttons never unmount or flicker when switching tabs.
   - `src/components/AdminNavbar.tsx`: Unified 2-row sticky navigation bar for the Admin Editorial Desk with warm background (`#fbf1e5`) pinned fixed to the top allowing page content to scroll underneath.
     - Row 1: Logo (`/CurrentNews.png`) + name `Current News Admin` in Lora font (`font-lora font-semibold`); circle profile button on right with flyout dropdown (User card, Privacy Policy, Terms of Service, Delete Account modal with equal-width Cancel [#cce3de] & Delete buttons and copy logo next to DELETE confirmation, Sign Out).
     - Row 2: Centered horizontal navigation tabs (`Dashboard`, `Drafts`, `Publications`, `Audience`) without enclosing pill box, centered in the middle on laptop and tablet screens, styled in Playfair regular font (`font-playfair font-normal`) without bold text, with vertical dividers, colored icons (emerald, indigo, blue, amber), responsive touch scrolling, and 100% offline touch-swipe gesture navigation.
   - `src/components/AdminAuthGuard.tsx`: Role-gating wrapper enforcing authenticated sessions with admin/writer privileges; redirects unauthenticated users directly to `/signin` and presents role-assignment stage in an unboxed, box-free Tuscan Sunset palette (`#FFD3AC` background, `#54463A` typography, `#A2AE9D` badge, `#54463A` account switcher, and `#C75F71` "Login as Reader" button redirecting to `https://currentnews.blog/signin`).
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
   - `src/utils/authSessionHint.ts`: UI-only routing hint eliminating login-page flash on session restore without trusting localStorage for authorization.
   - `src/utils/publicationsHelper.ts`: Pure pagination cursor parser, deduplicated page merger, and optimistic tab counter updates.
   - `src/utils/imageUrl.ts`: URL sanitization guaranteeing clean HTTPS media links.
   - `src/utils/compressedStorage.ts`: LZW-compressed client storage for zero-latency draft caching.
   - `src/utils/writers.ts`: Dynamic staff and pen name validation helpers.
   - `src/utils/penNameHelper.ts`: Pure pen name validation and writer/admin author resolution helpers backed by Neon `staff.pen_name`.
