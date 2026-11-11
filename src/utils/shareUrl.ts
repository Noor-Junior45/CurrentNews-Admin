import { slugify } from '../types';

/**
 * Returns the canonical public web URL for an article.
 * 
 * In Android Capacitor native apps, local dev environments, or local webviews,
 * window.location.origin is "http://localhost" (or "capacitor://localhost").
 * A link containing "localhost" is completely unusable when sent over WhatsApp,
 * Twitter, Telegram, SMS, or email because recipients cannot reach localhost.
 * 
 * This helper guarantees that:
 * 1. Android APK / Capacitor app shares ALWAYS use the live production website:
 *    https://www.currentnews.blog/post/:id/:slug
 * 2. Web browser shares on currentnews.blog use the canonical production URL.
 * 3. Non-routable origins (localhost, 127.0.0.1, capacitor://) always resolve to https://www.currentnews.blog.
 * 4. Development web previews (*.run.app) use their live accessible URL.
 */
export const PUBLIC_READER_SITE = (
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_READER_BASE_URL) ||
  'https://currentnews.blog'
).replace(/\/+$/, '');

export function getCanonicalPostUrl(postId: string, title?: string): string {
  if (!postId) return PUBLIC_READER_SITE;
  const postSlug = title ? slugify(title) : '';
  const path = postSlug ? `/post/${postId}/${postSlug}` : `/post/${postId}`;
  return `${PUBLIC_READER_SITE}${path}`;
}

/**
 * Returns the canonical public web origin (base URL) for reader traffic.
 * Always resolves to the public reader website (https://currentnews.blog)
 * and never to localhost, preview runners, or the admin portal host.
 */
export function getCanonicalSiteOrigin(): string {
  return PUBLIC_READER_SITE;
}

