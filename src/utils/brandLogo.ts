import React from 'react';
import bundledLogo from '../assets/CurrentNews.png';

export const CURRENT_NEWS_LOGO = bundledLogo;
export const CURRENT_NEWS_LOGO_PUBLIC = '/CurrentNews.png';
export const CURRENT_NEWS_LOGO_LOWER = '/currentnews.png';

/**
 * Universal SVG emblem fallback (valid base64 URI) if any network or CDN issue prevents PNG load.
 */
export const CURRENT_NEWS_LOGO_SVG = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiI+PHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIHJ4PSIxMTIiIGZpbGw9IiMwZjE3MmEiLz48Y2lyY2xlIGN4PSIyNTYiIGN5PSIyNTYiIHI9IjE2MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMzhiZGY4IiBzdHJva2Utd2lkdGg9IjIwIi8+PHBhdGggZD0iTTE3NiAyNTZoMTYwTTI1NiAxNzZ2MTYwIiBzdHJva2U9IiNmOGZhZmMiIHN0cm9rZS13aWR0aD0iMjgiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjx0ZXh0IHg9IjI1NiIgeT0iNDQwIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC13ZWlnaHQ9IjkwMCIgZm9udC1zaXplPSI0NCIgZmlsbD0iI2ZmZmZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgbGV0dGVyLXNwYWNpbmc9IjQiPkNVUlJFTlQgTkVXUzwvdGV4dD48L3N2Zz4=';

/**
 * Fail-safe error handler ensuring the brand logo NEVER appears broken in any browser.
 */
export function handleLogoError(e: React.SyntheticEvent<HTMLImageElement, Event>) {
  const img = e.currentTarget;
  const level = parseInt(img.dataset.retryLevel || '0', 10);
  if (level === 0) {
    img.dataset.retryLevel = '1';
    img.src = CURRENT_NEWS_LOGO_PUBLIC;
  } else if (level === 1) {
    img.dataset.retryLevel = '2';
    img.src = CURRENT_NEWS_LOGO_LOWER;
  } else if (level === 2) {
    img.dataset.retryLevel = '3';
    img.src = CURRENT_NEWS_LOGO_SVG;
  } else {
    // Ultimate fallback: lock to base64 SVG and remove onerror handler to prevent loop
    img.onerror = null;
    img.src = CURRENT_NEWS_LOGO_SVG;
  }
}
