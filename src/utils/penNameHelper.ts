export const PEN_NAME_MIN_LENGTH = 1;
export const PEN_NAME_MAX_LENGTH = 100;

export function normalizePenNameInput(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

export function isValidPenName(value: unknown): boolean {
  const normalized = normalizePenNameInput(value);
  return normalized.length >= PEN_NAME_MIN_LENGTH && normalized.length <= PEN_NAME_MAX_LENGTH;
}

export interface ResolveDraftAuthorOptions {
  isAdminUser: boolean;
  savedPenName?: string | null;
  displayName?: string | null;
  existingPostAuthorName?: string | null;
  fallbackAuthor?: string | null;
}

/**
 * Resolves the editorial author name for DraftPublicationView:
 * - Non-admin writers always use their saved Neon staff.pen_name (when available).
 * - Admins default to their saved pen name and only fall back to displayName (then fallbackAuthor) if no pen name exists,
 *   while preserving existingPostAuthorName when editing an existing post.
 */
export function resolveDraftAuthorName(options: ResolveDraftAuthorOptions): string {
  const cleanPenName = normalizePenNameInput(options.savedPenName);
  const cleanDisplayName = normalizePenNameInput(options.displayName);
  const cleanExistingAuthor = normalizePenNameInput(options.existingPostAuthorName);
  const cleanFallback = normalizePenNameInput(options.fallbackAuthor) || 'Current News';

  if (!options.isAdminUser) {
    return cleanPenName || cleanDisplayName || cleanFallback;
  }

  return cleanExistingAuthor || cleanPenName || cleanDisplayName || cleanFallback;
}
