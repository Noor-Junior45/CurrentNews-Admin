/**
 * Reading Progress & Offline Article Cache Manager
 * Automatically saves reading scroll position, percentage, and article data to cache memory
 * so users can resume reading right where they left off.
 */

export interface ReadingProgressRecord {
  id: string;
  title: string;
  slug: string;
  imageUrl?: string;
  category?: string;
  scrollY: number;
  progress: number; // 0 to 100 percentage
  updatedAt: number;
  snippet?: string;
}

const STORAGE_KEY_PREFIX = 'cn_progress_';
const SESSIONS_INDEX_KEY = 'cn_in_progress_articles';

/**
 * Save user's reading position in cache memory
 */
export function saveReadingProgress(
  id: string,
  title: string,
  slug: string,
  scrollY: number,
  maxScroll: number,
  imageUrl?: string,
  category?: string,
  snippet?: string
): void {
  if (!id || maxScroll <= 0) return;

  const progress = Math.min(100, Math.max(0, Math.round((scrollY / maxScroll) * 100)));

  const record: ReadingProgressRecord = {
    id,
    title,
    slug,
    imageUrl: imageUrl || '',
    category: category || 'General',
    scrollY: Math.round(scrollY),
    progress,
    updatedAt: Date.now(),
    snippet: snippet || '',
  };

  try {
    // 1. Save specific article record
    localStorage.setItem(STORAGE_KEY_PREFIX + id, JSON.stringify(record));

    // 2. Update global recent in-progress list
    let index: ReadingProgressRecord[] = getRecentInProgressArticles();

    // If finished (> 92%) or just barely opened (< 3%), remove from in-progress list
    if (progress >= 92 || progress < 3) {
      index = index.filter((item) => item.id !== id);
    } else {
      // Keep at the front
      index = [record, ...index.filter((item) => item.id !== id)].slice(0, 10);
    }

    localStorage.setItem(SESSIONS_INDEX_KEY, JSON.stringify(index));

    // Broadcast progress update event for reactive UI updates
    window.dispatchEvent(new CustomEvent('reading-progress-updated', { detail: record }));
  } catch (e) {
    console.debug('[ReadingProgress] Failed to save progress:', e);
  }
}

/**
 * Retrieve saved reading progress for an article
 */
export function getReadingProgress(id: string): ReadingProgressRecord | null {
  if (!id) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + id);
    if (!raw) return null;
    return JSON.parse(raw) as ReadingProgressRecord;
  } catch {
    return null;
  }
}

/**
 * Get all articles currently in progress
 */
export function getRecentInProgressArticles(): ReadingProgressRecord[] {
  try {
    const raw = localStorage.getItem(SESSIONS_INDEX_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (Array.isArray(list)) {
      // Filter out stale items older than 30 days
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      return list.filter((item) => item.updatedAt > thirtyDaysAgo);
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Remove reading progress when user completes the article
 */
export function clearReadingProgress(id: string): void {
  if (!id) return;
  try {
    localStorage.removeItem(STORAGE_KEY_PREFIX + id);
    const index = getRecentInProgressArticles().filter((item) => item.id !== id);
    localStorage.setItem(SESSIONS_INDEX_KEY, JSON.stringify(index));
    window.dispatchEvent(new CustomEvent('reading-progress-updated'));
  } catch {}
}
