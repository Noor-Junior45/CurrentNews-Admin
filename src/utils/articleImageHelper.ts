export const MAX_ARTICLE_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_ARTICLE_IMAGE_MIMES: Record<string, 'webp' | 'jpg' | 'png'> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

export interface ParsedBase64ImageResult {
  ok: boolean;
  buffer?: Buffer;
  mime?: 'image/webp' | 'image/jpeg' | 'image/png';
  ext?: 'webp' | 'jpg' | 'png';
  error?: string;
}

export interface HttpsImageUrlResult {
  ok: boolean;
  url?: string;
  error?: string;
}

/**
 * Sanitizes articleId for safe use in R2 object keys (prevents path traversal).
 */
export function sanitizeR2ArticleIdSegment(articleId: string): string {
  const cleaned = String(articleId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  return cleaned || 'article';
}

/**
 * Parses and validates a data:image/*;base64,... string:
 * - Only allows image/webp, image/jpeg, image/png
 * - Validates canonical base64 encoding and non-empty decoded payload
 * - Enforces <= 5 MB decoded size
 * - Rejects disguised SVG/XML/HTML/script payloads
 */
export function parseAndValidateBase64Image(dataUri: string, fieldName = 'image'): ParsedBase64ImageResult {
  const trimmed = String(dataUri || '').trim();
  const match = trimmed.match(/^data:([^;,]+);base64,([\s\S]+)$/i);
  if (!match) {
    return {
      ok: false,
      error: `${fieldName} must be a valid base64 data:image/* URI`,
    };
  }

  const mime = match[1].trim().toLowerCase();
  const ext = ALLOWED_ARTICLE_IMAGE_MIMES[mime];
  if (!ext) {
    return {
      ok: false,
      error: `${fieldName} has unsupported image type "${mime}". Allowed types: image/webp, image/jpeg, image/png`,
    };
  }

  const cleanBase64 = match[2].replace(/\s+/g, '');
  if (!cleanBase64 || !/^[A-Za-z0-9+/]*={0,2}$/.test(cleanBase64)) {
    return {
      ok: false,
      error: `${fieldName} contains invalid base64 image data`,
    };
  }

  // Quick upper-bound check before allocating decoded buffer
  const maxBase64Chars = Math.ceil((MAX_ARTICLE_IMAGE_BYTES * 4) / 3) + 4;
  if (cleanBase64.length > maxBase64Chars) {
    return {
      ok: false,
      error: `${fieldName} exceeds the maximum allowed size of 5 MB`,
    };
  }

  const buffer = Buffer.from(cleanBase64, 'base64');
  if (buffer.length === 0) {
    return {
      ok: false,
      error: `${fieldName} decoded to an empty image payload`,
    };
  }

  if (buffer.length > MAX_ARTICLE_IMAGE_BYTES) {
    return {
      ok: false,
      error: `${fieldName} exceeds the maximum allowed size of 5 MB`,
    };
  }

  // Prevent polyglot SVG / XML / HTML injection disguised under an allowed MIME header
  const headText = buffer.subarray(0, 512).toString('utf8').toLowerCase();
  if (
    headText.includes('<svg') ||
    headText.includes('<?xml') ||
    headText.includes('<!doctype') ||
    headText.includes('<script') ||
    headText.includes('<html')
  ) {
    return {
      ok: false,
      error: `${fieldName} contains prohibited SVG or markup content`,
    };
  }

  return {
    ok: true,
    buffer,
    mime: mime as 'image/webp' | 'image/jpeg' | 'image/png',
    ext,
  };
}

/**
 * Validates that any non-empty remaining image URL is strictly https://.
 */
export function normalizeAndValidateHttpsImageUrl(
  rawUrl: string,
  fieldName = 'image'
): HttpsImageUrlResult {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) {
    return { ok: true, url: '' };
  }

  if (/^data:/i.test(trimmed)) {
    return {
      ok: false,
      error: `${fieldName} cannot contain raw data: URIs`,
    };
  }

  if (!/^https:\/\//i.test(trimmed)) {
    return {
      ok: false,
      error: `${fieldName} must use https:// (got invalid URL scheme)`,
    };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' || !parsed.hostname) {
      return {
        ok: false,
        error: `${fieldName} must be a valid https:// URL`,
      };
    }
    const normalized = trimmed.replace(/^https:\/\//i, 'https://');
    return { ok: true, url: normalized };
  } catch {
    return {
      ok: false,
      error: `${fieldName} must be a valid https:// URL`,
    };
  }
}
