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
export function getCanonicalPostUrl(postId: string, title?: string): string {
  if (!postId) return 'https://www.currentnews.blog';
  const postSlug = title ? slugify(title) : '';
  const path = postSlug ? `/post/${postId}/${postSlug}` : `/post/${postId}`;

  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin || '';
    const hostname = (window.location.hostname || '').toLowerCase();

    // Check if running on Android Native Capacitor, localhost, or file protocol
    const isLocalOrNative =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      origin.includes('localhost') ||
      origin.includes('capacitor://') ||
      origin.startsWith('file:') ||
      Boolean((window as any)?.Capacitor?.isNativePlatform?.());

    if (isLocalOrNative) {
      return `https://www.currentnews.blog${path}`;
    }

    // If already on the production domain or its variants
    if (hostname.includes('currentnews.blog')) {
      return `https://www.currentnews.blog${path}`;
    }

    // If on a live web host (like Cloud Run development preview ais-dev/pre...run.app)
    if (origin.startsWith('http://') || origin.startsWith('https://')) {
      return `${origin}${path}`;
    }
  }

  return `https://www.currentnews.blog${path}`;
}

/**
 * Returns the canonical public web origin (base URL).
 * In Android Capacitor native apps, local dev, or webviews,
 * returns "https://www.currentnews.blog" instead of "http://localhost".
 */
export function getCanonicalSiteOrigin(): string {
  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin || '';
    const hostname = (window.location.hostname || '').toLowerCase();

    const isLocalOrNative =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      origin.includes('localhost') ||
      origin.includes('capacitor://') ||
      origin.startsWith('file:') ||
      Boolean((window as any)?.Capacitor?.isNativePlatform?.());

    if (isLocalOrNative) {
      return 'https://www.currentnews.blog';
    }

    if (hostname.includes('currentnews.blog')) {
      return 'https://www.currentnews.blog';
    }

    if (origin.startsWith('http://') || origin.startsWith('https://')) {
      return origin;
    }
  }

  return 'https://www.currentnews.blog';
}

