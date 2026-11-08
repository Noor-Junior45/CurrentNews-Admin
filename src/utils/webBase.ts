/**
 * Returns an absolute URL pointing to the primary web origin when running
 * inside a native mobile shell or returns the relative path unchanged.
 *
 * @param path Relative path, e.g. '/api/app/version' or '/img/photo.webp'
 */
export function webUrl(path: string): string {
  if (!path) return '';
  try {
    if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      return `https://www.currentnews.blog${cleanPath}`;
    }
  } catch (_) {}
  return path;
}
