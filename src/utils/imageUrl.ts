/**
 * Image URL sanitization and self-healing domain fallback utilities.
 * Handles misconfigured domain prefixes, duplicated protocols, and automatic
 * switching between Cloudflare R2 custom domain (media.currentnews.blog)
 * and R2 direct dev domain (pub-03dd1274c4824531a1478f20e0485d75.r2.dev).
 */

export const R2_CUSTOM_DOMAIN = 'media.currentnews.blog';
export const R2_DEV_DOMAIN = 'pub-03dd1274c4824531a1478f20e0485d75.r2.dev';
export const DEFAULT_BRAND_EMBLEM = 'https://i.imgur.com/gFgShoZ.jpeg';
import { webUrl } from './webBase';

/**
 * Known non-image sites or patterns (such as online converter tools or generic page roots)
 * that users sometimes mistakenly paste into image fields.
 */
const NON_IMAGE_HOSTS_AND_PATTERNS = [
  'freeconvert.com',
  'convertio.co',
  'cloudconvert.com',
  'iloveimg.com',
  'online-convert.com',
  'zamzar.com',
  'tinyurl.com',
  'bit.ly',
  'jpg-converter',
  'png-converter',
  'image-converter'
];

/**
 * Validates whether a given string is likely an actual image URL rather than an HTML page or converter link.
 */
export function isLikelyImageUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return false;

  // Reject known file converter sites or tool pages
  for (const pattern of NON_IMAGE_HOSTS_AND_PATTERNS) {
    if (trimmed.includes(pattern)) {
      return false;
    }
  }

  // Reject HTML / script / server-side document page extensions
  if (/\.(html?|php|asp|aspx|jsp|cgi)($|\?|#)/i.test(trimmed)) {
    return false;
  }

  // Accept data URLs or blob URLs
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('blob:')) {
    return true;
  }

  // Accept relative /img/ or /uploads/ paths
  if (trimmed.startsWith('/img/') || trimmed.startsWith('/uploads/')) {
    return true;
  }

  // Accept common image extensions
  if (/\.(jpe?g|png|webp|gif|svg|avif|bmp|ico)($|\?|#)/i.test(trimmed)) {
    return true;
  }

  // Accept known image hosting domains & CDNs
  const knownImageDomains = [
    'media.currentnews.blog',
    'r2.dev',
    'imgur.com',
    'images.unsplash.com',
    'img.youtube.com',
    'ytimg.com',
    'pbs.twimg.com',
    'res.cloudinary.com',
    'firebasestorage.googleapis.com',
    'googleusercontent.com'
  ];

  for (const domain of knownImageDomains) {
    if (trimmed.includes(domain)) {
      return true;
    }
  }

  return false;
}

/**
 * Extracts a high-resolution thumbnail URL for an attached YouTube video if present.
 */
export function getYoutubeThumbnailUrl(youtubeUrl?: string | null): string | null {
  if (!youtubeUrl || typeof youtubeUrl !== 'string') return null;
  const match = youtubeUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  if (match && match[1]) {
    return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
  }
  return null;
}

/**
 * Strips accidental protocol or path inputs from domain settings.
 * E.g., "https//media.currentnews.blog/uploads/photo.jpg" -> "media.currentnews.blog"
 */
export function sanitizeDomainName(domainStr?: string | null, defaultDomain = R2_CUSTOM_DOMAIN): string {
  if (!domainStr || typeof domainStr !== 'string') return defaultDomain;
  let d = domainStr.trim();
  // Strip leading protocols or protocol typos
  d = d.replace(/^(?:https?:\/?\/?)+/i, '').replace(/^https\/\//i, '').replace(/^http\/\//i, '');
  // Strip any accidental path components (e.g., /uploads/photo.jpg)
  d = d.split('/')[0];
  d = d.replace(/\/+$/, '').trim();
  return d || defaultDomain;
}

/**
 * Sanitizes any image URL by fixing duplicate protocols, accidental path injections,
 * double slashes, and non-direct image hosting links.
 * Returns empty string if the URL is not an actual image.
 */
export function cleanImageUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const cleaned = url.trim();
  if (!cleaned) return '';

  // CRITICAL: If the URL is a data URL (base64 image) or blob URL, preserve it untouched!
  // Any string replacement of // or slashes will corrupt the binary base64 data.
  if (cleaned.startsWith('data:image/') || cleaned.startsWith('blob:')) {
    return cleaned;
  }

  // Filter out obvious non-image tool pages or invalid converter URLs
  if (!isLikelyImageUrl(cleaned)) {
    return '';
  }

  // 1. Fix duplicated, malformed, or missing-colon protocols (e.g. "https://https//", "https//", "http://https://", "https:")
  let formatted = cleaned;
  if (!formatted.startsWith('/img/') && !formatted.startsWith('/uploads/')) {
    formatted = formatted.replace(/^(?:https?[:/]*)+/i, 'https://');
  }

  // 2. Fix accidental path insertions like "/uploads/photo.jpg/uploads/" or "/photo.jpg/uploads/" or "/uploads/photo.jpg/img/"
  // e.g. "media.currentnews.blog/uploads/photo.jpg/uploads/2026/..." -> "media.currentnews.blog/uploads/2026/..."
  formatted = formatted.replace(/\/uploads\/[^/]+\.(?:jpe?g|png|webp|gif|svg)\/uploads\//gi, '/uploads/');
  formatted = formatted.replace(/\/uploads\/[^/]+\.(?:jpe?g|png|webp|gif|svg)\/img\//gi, '/img/');
  formatted = formatted.replace(/\/uploads\/uploads\//gi, '/uploads/');

  // 3. Fix double slashes inside the path (excluding https://)
  formatted = formatted.replace(/(https?:\/\/)|(\/+)/g, (match, protocol) => {
    return protocol ? protocol : '/';
  });

  // 4. Imgur non-direct link normalization (e.g. imgur.com/abc -> i.imgur.com/abc.jpg)
  if (formatted.includes('imgur.com') && !/\.(png|jpg|jpeg|gif|webp)$/i.test(formatted)) {
    formatted = formatted.replace('imgur.com', 'i.imgur.com') + '.jpg';
  }

  // 5. Wrap relative /img/ or /uploads/ with webUrl for Android native shell
  if (formatted.startsWith('/img/') || formatted.startsWith('/uploads/')) {
    return webUrl(formatted);
  }

  return formatted;
}

/**
 * Returns a reliable fallback URL. If an explicit fallback is provided and valid,
 * it is cleaned and used. Otherwise, it automatically maps between the custom domain
 * and the direct R2 dev domain.
 */
export function getFallbackImageUrl(primaryUrl?: string | null, explicitFallback?: string | null): string {
  const cleanPrimary = cleanImageUrl(primaryUrl);
  if (cleanPrimary.startsWith('data:image/') || cleanPrimary.startsWith('blob:')) {
    return cleanPrimary;
  }

  if (explicitFallback && typeof explicitFallback === 'string' && explicitFallback.trim().length > 0) {
    const cleanExplicit = cleanImageUrl(explicitFallback);
    if (cleanExplicit && cleanExplicit !== cleanPrimary) {
      return cleanExplicit;
    }
  }

  if (!cleanPrimary) return '';

  if (cleanPrimary.includes(R2_CUSTOM_DOMAIN)) {
    return cleanPrimary.replace(R2_CUSTOM_DOMAIN, R2_DEV_DOMAIN);
  }
  if (cleanPrimary.includes(R2_DEV_DOMAIN)) {
    return cleanPrimary.replace(R2_DEV_DOMAIN, R2_CUSTOM_DOMAIN);
  }

  return cleanPrimary;
}

/**
 * Normalizes all image URLs in a post object, repairing malformed primary and
 * gallery URLs as well as populating fallback URLs. Automatically derives
 * YouTube video thumbnails if an image is missing or invalid.
 */
export function sanitizePostImages<T extends {
  imageUrl?: string;
  imageUrlFallback?: string;
  imageUrls?: string[];
  imageUrlsFallback?: string[];
  content?: string;
  youtubeUrl?: string;
}>(post: T): T {
  if (!post) return post;

  const sanitized = { ...post };

  // 1. Process primary imageUrl
  if (sanitized.imageUrl) {
    if (!isLikelyImageUrl(sanitized.imageUrl)) {
      // If primary imageUrl is an invalid webpage (like freeconvert.com), try YouTube thumbnail if available
      const ytThumb = getYoutubeThumbnailUrl(sanitized.youtubeUrl);
      if (ytThumb) {
        sanitized.imageUrl = ytThumb;
        sanitized.imageUrlFallback = ytThumb;
      } else {
        sanitized.imageUrl = '';
        sanitized.imageUrlFallback = '';
      }
    } else {
      const clean = cleanImageUrl(sanitized.imageUrl);
      sanitized.imageUrlFallback = getFallbackImageUrl(clean, sanitized.imageUrlFallback);
      sanitized.imageUrl = clean;
    }
  } else if (sanitized.youtubeUrl) {
    // If post has no imageUrl but has an attached youtubeUrl, automatically populate thumbnail
    const ytThumb = getYoutubeThumbnailUrl(sanitized.youtubeUrl);
    if (ytThumb) {
      sanitized.imageUrl = ytThumb;
      sanitized.imageUrlFallback = ytThumb;
    }
  }

  // 2. Process gallery imageUrls
  if (Array.isArray(sanitized.imageUrls)) {
    const cleanUrls: string[] = [];
    const cleanFallbacks: string[] = [];

    sanitized.imageUrls.forEach((rawUrl, idx) => {
      if (rawUrl && typeof rawUrl === 'string' && isLikelyImageUrl(rawUrl)) {
        const c = cleanImageUrl(rawUrl);
        if (c) {
          cleanUrls.push(c);
          const explicitFb = sanitized.imageUrlsFallback?.[idx];
          cleanFallbacks.push(getFallbackImageUrl(c, explicitFb));
        }
      }
    });

    sanitized.imageUrls = cleanUrls;
    sanitized.imageUrlsFallback = cleanFallbacks;
  }

  // Also clean any malformed image tags or URLs inside content
  if (sanitized.content && typeof sanitized.content === 'string') {
    sanitized.content = sanitized.content.replace(
      /https:\/\/(?:https\/\/)?media\.currentnews\.blog\/uploads\/photo\.jpg\/uploads\//g,
      'https://media.currentnews.blog/uploads/'
    );
    sanitized.content = sanitized.content.replace(
      /https:\/\/(?:https\/\/)?media\.currentnews\.blog\/uploads\/photo\.jpg\/img\//g,
      'https://media.currentnews.blog/img/'
    );
    sanitized.content = sanitized.content.replace(
      /https:\/\/https\/\/media\.currentnews\.blog\//g,
      'https://media.currentnews.blog/'
    );
    sanitized.content = sanitized.content.replace(
      /https:\/\/https\/\/pub-[a-zA-Z0-9]+\.r2\.dev\//g,
      'https://pub-03dd1274c4824531a1478f20e0485d75.r2.dev/'
    );
  }

  return sanitized;
}
