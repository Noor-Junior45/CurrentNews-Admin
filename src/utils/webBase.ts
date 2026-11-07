import { Capacitor } from '@capacitor/core';

/**
 * Returns an absolute URL pointing to the primary web origin when running
 * inside the native Capacitor Android shell (where relative paths resolve to https://localhost),
 * or returns the relative path unchanged when running in the browser.
 *
 * @param path Relative path, e.g. '/api/app/version' or '/img/photo.webp'
 */
export function webUrl(path: string): string {
  if (!path) return '';
  if (Capacitor.isNativePlatform()) {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `https://www.currentnews.blog${cleanPath}`;
  }
  return path;
}
