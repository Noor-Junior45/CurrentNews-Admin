import type { Post } from '../types';

export interface PublicationCounts {
  all: number;
  published: number;
  drafts: number;
}

/**
 * Merges incoming article pages into existing posts without duplicates or archived entries.
 */
export function mergePublicationPages(
  existing: Post[],
  incoming: Post[],
  replace: boolean
): Post[] {
  const seen = new Set<string>();
  const result: Post[] = [];

  const sourceList = replace ? incoming : [...existing, ...incoming];
  for (const post of sourceList) {
    if (!post || !post.id || post.status === 'archived') continue;
    if (seen.has(post.id)) continue;
    seen.add(post.id);
    result.push(post);
  }

  return result;
}

/**
 * Optimistically decrements tab counters when a publication is deleted.
 */
export function applyOptimisticDeleteCount(
  counts: PublicationCounts,
  deletedStatus?: string | null
): PublicationCounts {
  return {
    all: Math.max(0, counts.all - 1),
    published: deletedStatus === 'published' ? Math.max(0, counts.published - 1) : counts.published,
    drafts: deletedStatus === 'draft' ? Math.max(0, counts.drafts - 1) : counts.drafts,
  };
}

/**
 * Optimistically updates tab counters when a publication is added or changes status.
 */
export function applyOptimisticUpsertCount(
  counts: PublicationCounts,
  nextStatus?: string | null,
  prevStatus?: string | null
): PublicationCounts {
  if (!nextStatus || nextStatus === 'archived') return counts;
  if (!prevStatus) {
    return {
      all: counts.all + 1,
      published: nextStatus === 'published' ? counts.published + 1 : counts.published,
      drafts: nextStatus === 'draft' ? counts.drafts + 1 : counts.drafts,
    };
  }
  if (prevStatus === nextStatus) return counts;
  return {
    all: counts.all,
    published:
      nextStatus === 'published'
        ? counts.published + 1
        : prevStatus === 'published'
        ? Math.max(0, counts.published - 1)
        : counts.published,
    drafts:
      nextStatus === 'draft'
        ? counts.drafts + 1
        : prevStatus === 'draft'
        ? Math.max(0, counts.drafts - 1)
        : counts.drafts,
  };
}

/**
 * Parses a cursor formatted as "<updatedAtEpochMs>_<articleId>" even when articleId contains underscores.
 */
export function parseArticlesCursor(cursor: string): { updatedAtMs: number; id: string } | null {
  if (!cursor || typeof cursor !== 'string') return null;
  const trimmed = cursor.trim();
  const sepIdx = trimmed.indexOf('_');
  if (sepIdx <= 0 || sepIdx >= trimmed.length - 1) return null;

  const rawTime = trimmed.slice(0, sepIdx);
  const id = trimmed.slice(sepIdx + 1);
  if (!/^\d+$/.test(rawTime) || !id) return null;

  const updatedAtMs = parseInt(rawTime, 10);
  if (!Number.isFinite(updatedAtMs)) return null;

  return { updatedAtMs, id };
}
