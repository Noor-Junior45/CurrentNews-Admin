# 📋 Current News — Solved Issues & Architecture Notes

This file tracks all resolved issues, technical architectural decisions, and configurations for the **Current News** application (Web, PWA, and Native Android App).

---

## 🛠 Solved Issues Log

### 1. Gradle Sync Kotlin DSL Failure
* **Symptoms:**
  * `e: file:///.../build.gradle.kts:31:39: Unresolved reference: util`
  * `e: file:///.../build.gradle.kts:34:33: Overload resolution ambiguity: File(...)`
* **Root Cause:**
  * In Gradle's Kotlin DSL (`android { ... }` block), `java` refers to the `JavaPluginExtension`, not the Java core package. Writing `java.util.Properties()` caused Gradle to look for `.util` on the Gradle extension.
  * `properties.getProperty(...)` returns a platform type `String!`, which led Kotlin to report ambiguity between `File(String)` and `File(URI)`.
* **Resolution:**
  * Added explicit standard imports at the top of `android/app/build.gradle.kts`:
    ```kotlin
    import java.io.File
    import java.util.Properties
    ```
  * Initialized `Properties()` directly without namespace collision.
  * Explicitly typed `storeFilePath: String` and resolved files cleanly via `rootProject.file(...)`.

---

### 2. Android Back Button Closing App During Article Reading & Losing Page Index
* **Symptoms:**
  * When reading an article, pressing the Android back button or predictive back gesture closed the app instead of navigating back to the home feed.
  * When navigating back to Home, the page index was lost (reset to page 1 instead of staying on page 2, 3, etc.).
* **Root Cause:**
  * `MainActivity.kt` did not register an `OnBackPressedCallback` with `onBackPressedDispatcher`. Under Android 13+ (API 33+), unhandled back gestures invoke default system `finish()`.
  * `AndroidBackGestureHandler.tsx` did not handle `/post/...` routes specifically or preserve URL search parameters (`?page=...&category=...`).
* **Resolution:**
  * **Native Android (`MainActivity.kt`):** Added `setupNativeBackGestureHandler()` using AndroidX `OnBackPressedCallback` hooked to `onBackPressedDispatcher`. It delegates to `window.__handleAndroidBackButton()` in the webview.
  * **Unified In-App Handler (`AndroidBackGestureHandler.tsx`):**
    * When on an article (`/post/...`), pressing back navigates to Home with the exact same category and page index (`?page=X`) and restores the reading scroll position.
    * Never closes the app from an article view.
    * On the Home feed (`/`), single back press shows a subtle toast ("Press back again to exit Current News"), and double back press within 2.5s exits the app.
  * **Page Index Cache (`BlogPostCard.tsx` & `HomeView.tsx`):** Cached `current_news_return_search`, `current_news_return_page`, and `current_news_return_scroll` into `sessionStorage` so returning to Home preserves the exact pagination state and scroll position.

---

### 3. Google Sign-In Opening Webview/Popup with Password Prompt vs. Native Device Account Picker
* **Symptoms:**
  * When signing in on Android, the app opened a web browser/popup asking the user to manually type their Gmail and password, often resulting in `Firebase: Error (auth/cancelled-popup-request)`.
* **Root Cause:**
  * The app was using Firebase Web's `signInWithPopup`, which creates an OAuth web flow inside a WebView dialog rather than using Android's native Google Play Services.
* **Resolution:**
  * Added `com.google.android.gms:play-services-auth:21.3.0` to `android/app/build.gradle.kts`.
  * Built `NativeGoogleAuthPlugin.kt` which invokes the **native Android Google Account Chooser bottom sheet** via Google Play Services `GoogleSignInClient`.
  * Users tap their device's already-logged-in Gmail account with **one tap** (no password prompt, no web popup).
  * The plugin securely returns the Google ID Token, which `authHelper.ts` exchanges for a Firebase Auth credential using `signInWithCredential(auth, credential)`.
  * On desktop/web browsers, `authHelper.ts` smoothly falls back to standard web popup authentication.

---

### 4. Cache Memory Resumption for Left-in-Half Articles
* **Feature:**
  * When a user starts reading an article and exits before finishing, their scroll progress is automatically saved to local cache memory (`localStorage`).
  * When they reopen the article or view the Home feed, a "Resume Reading" banner allows them to jump right back to where they left off.
* **Implementation:**
  * `src/utils/readingProgress.ts`: Tracks scroll progress, title, category, and timestamp.
  * `PostDetailView.tsx`: Monitors scroll depth, displays the "Resume Reading" prompt if progress is between 5% and 92%.
  * `HomeView.tsx`: Displays the "Continue Reading" shelf for in-progress articles.

---

### 5. Native Android Framework Update (Capacitor Native vs. Webview Wrapper)
* **Improvements:**
  * Standardized `capacitor.config.ts` and `capacitor.config.json` to load bundled local assets from `webDir: 'dist'` natively.
  * Removed the `webView.webChromeClient` override in `MainActivity.kt` that was breaking Capacitor's native bridge.
  * Compiled and synced all assets into `android/app/src/main/assets/public` using `npm run cap:build` (`npx cap sync android`).

---

### 6. Google AdSense Review Approval & Policy Compliance
* **Symptoms:**
  * Site failed Google AdSense review with two policy rejection notices:
    1. *"Google-served ads on screens without publisher-content (We do not allow Google-served ads on screens without content or with low value content, that are under construction, that are used for alerts, navigation or other behavioral purposes)."*
    2. *"Low value content (Site must provide authentic, high-quality information, exhibit ongoing curation, and sustain genuine user interest)."*
* **Root Causes:**
  1. **Global Auto-Ads on Utility/Empty Screens:** The global AdSense script in `<head>` was attempting to inject automated ads into administrative screens (`/admin`), login/profile hubs (`/profile`), settings toggles (`/settings`), empty bookmarks (`/liked`), and account deletion forms (`/delete-account`).
  2. **Blank Static HTML for AdSense Crawlers:** Being a single-page app (SPA), the server initially returned an empty `<div id="root"></div>`. When `Mediapartners-Google` (the AdSense review bot) fetched pages, it saw zero words of content alongside the AdSense tag.
  3. **Misconfigured Sitemap:** `sitemap.xml` included the utility route `/delete-account`, directing review crawlers directly to a form with zero editorial content.
  4. **Missing Core E-E-A-T Trust Pages:** The publication lacked dedicated "About Us", "Editorial & Fact-Checking Policy", and "Newsroom Contact" pages required by Google Quality Guidelines.
  5. **Footer Isolation:** The footer and legal navigation links were hidden on article pages (`/post/*`), preventing readers and reviewers from accessing policies from articles.
  6. **Missing AdSense Disclosures:** Privacy policy lacked explicit DoubleClick DART cookie clauses and opt-out links.
* **Resolution:**
  1. **Dynamic AdSense Route Guard (`useAdSenseRouteGuard.ts`):** Restricts AdSense script execution strictly to verified editorial publisher screens (`/`, `/post/*`, `/about`, `/editorial-policy`). Injects `<meta name="robots" content="noindex, nofollow" />` on utility pages (`/admin`, `/profile`, `/settings`, `/liked`, `/delete-account`) to completely exclude them from ad evaluation.
  2. **Auto-Ads Ablation Protection (`adsbygoogle-noablate`):** Added the standard `adsbygoogle-noablate` class to the Header, Footer, NewsletterPopup, NotificationBanner, and ConsentBanner to strictly prohibit Google Auto-Ads from inserting ads into navigation, alerts, or modals.
  3. **Core Publisher Trust & Transparency Pages:**
     * `/about` (`AboutView.tsx`): Detailed newsroom mission, journalistic charter, masthead & desk editors, and commercial independence firewall.
     * `/editorial-policy` (`EditorialPolicyView.tsx`): Sourcing protocols (two-source rule, primary documents), fact-checking workflows, transparent corrections and retractions timeline, and human curation & AI oversight policy.
     * `/contact` (`ContactView.tsx`): Newsroom contact directory, tips hotline, corrections desk email, and interactive inquiry form.
  4. **Server-Side Pre-Rendering for AdSense Crawlers (`socialPreview.ts`):** Enabled comprehensive server-side pre-rendering for `Mediapartners-Google`, `Googlebot`, and search spiders:
     * Full article headlines, author bylines, categories, publication dates, and complete body text rendered directly into `<div id="root">`.
     * Automated Schema.org `NewsArticle` JSON-LD structured data.
     * Server pre-rendering for `/`, `/about`, `/contact`, and `/editorial-policy`.
  5. **Semantic Fallback Content in `index.html`:** Provided authentic, structured publisher content inside `<div id="root">` so raw HTML requests always contain substantial news content.
  6. **Compliant Ad Placement Units (`AdSpace.tsx`):**
     * Balanced in-article and in-feed ad units placed with standard dimensions and clear `"ADVERTISEMENT"` labels.
     * Suppressed automatically if content is too short or during loading/error states.
  7. **Clean Sitemap & Robots.txt:**
     * `sitemap.xml`: Removed `/delete-account`; added `/about`, `/editorial-policy`, `/contact`, `/privacy`, `/terms`, and article permalinks.
     * `robots.txt`: Added explicit disallow directives for `Mediapartners-Google` and all bots on `/admin`, `/profile`, `/settings`, `/liked`, and `/delete-account`.
  8. **Global Legal Footer (`Footer.tsx`):** Unlocked footer navigation across all public reader screens with structured columns for Newsroom, Policy, Compliance, and Publisher Credentials.

---

### 7. Uncaught RangeError: Invalid time value
* **Symptoms:**
  * Application crashed or logged `Uncaught RangeError: Invalid time value` in console when reading or rendering article views, post cards, or liked dispatches.
* **Root Cause:**
  * When Firestore articles are cached in `localStorage` via `JSON.stringify()`, or retrieved via Firestore REST APIs, `createdAt` / `updatedAt` timestamps lose the prototype method `.toDate()` and become raw objects `{ seconds: number, nanoseconds: number }` or numeric strings.
  * Direct invocation of `new Date(post.createdAt)` when `post.createdAt` is an object evaluates to `new Date("[object Object]")`, resulting in an `Invalid Date` object.
  * Calling `.toISOString()` or `.toLocaleDateString()` on an `Invalid Date` throws a native JavaScript `RangeError: Invalid time value`.
* **Resolution:**
  * Created `src/utils/dateHelper.ts` with bulletproof safe utilities:
    * `safeParseDate(rawDate)`: Handles JS `Date`, Firestore `Timestamp` with `.toDate()`, serialized `{ seconds, nanoseconds }` / `{ _seconds }`, REST `{ timestampValue }`, unix millisecond/second numbers, and date strings. Returns a valid `Date` or `null`.
    * `safeFormatDate(rawDate, options, fallback)`: Safely formats any date without throwing errors, gracefully falling back to a default label (e.g. `'Recent Post'`).
    * `safeToIsoString(rawDate, fallback)`: Safely outputs an ISO 8601 string without throwing `RangeError`.
  * Removed redundant schema injection in `PostDetailView.tsx` that invoked raw `.toISOString()` without date validation.
  * Replaced direct `d.toLocaleDateString()` calls with `safeFormatDate` across `PostDetailView.tsx`, `BlogPostCard.tsx`, `LikedView.tsx`, `AdminView.tsx`, and `socialPreview.ts`.

---

### 8. Android App Links & Play Store Domain Association (Digital Asset Links JSON)
* **Goal & Configuration:**
  * Associated website domains (`www.currentnews.blog` and `currentnews.blog`) with the Android app (`blog.currentnews.app`) via Google Digital Asset Links specification.
  * Added certificate fingerprint: `31:7B:5C:4E:4C:23:10:B2:AD:1C:5D:31:95:63:EF:C7:8A:9D:87:2C:35:67:DB:8D:5C:4D:41:4A:94:63:66:B0` with relation `["delegate_permission/common.handle_all_urls"]`.
  * Created `public/.well-known/assetlinks.json`, `api/assetlinks.json.ts` for Vercel serverless, Express route `/.well-known/assetlinks.json` in `server.ts`, and rewrite rule in `vercel.json`.
  * Works in tandem with `AndroidManifest.xml` (`android:autoVerify="true"` on `https://www.currentnews.blog`) to automatically route mobile web links directly into the native app.

---

## 📌 How to Add This to Google AI Studio System Instructions

To ensure Google AI Studio always checks and updates this notes file in future conversations, add the following snippet to your **System Instructions** in Google AI Studio:

```markdown
### Project Documentation Protocol
- At the start of every session or task, check `SOLVED_ISSUES_NOTES.md` to understand previously resolved bugs, native Android architecture, and key conventions.
- Whenever a bug is fixed, a new capability is added, or an error is resolved, immediately append the problem description, root cause, and resolution under the "Solved Issues Log" in `SOLVED_ISSUES_NOTES.md`.
- Keep `README.md` and `SOLVED_ISSUES_NOTES.md` synchronized and updated.
```

### Steps to Add in Google AI Studio UI:
1. Open your project in **Google AI Studio** (`https://aistudio.google.com`).
2. Look at the right-hand panel (or the **System Instructions** box at the top left of the prompt window).
3. Paste the markdown block above into the **System Instructions** box.
4. Click **Save** (or continue the session).
5. From then on, the assistant will automatically maintain and reference `SOLVED_ISSUES_NOTES.md`.
