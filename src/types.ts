export interface Post {
  id: string;
  title: string;
  content: string; // HTML string from rich text editor
  youtubeUrl: string;
  facebookUrl: string;
  customLinks?: string[]; // Multiple additional social/custom embed links
  authorName?: string; // Optional user choice for editorial signature
  authorEmail?: string; // Unique admin email identifier
  authorId?: string; // Unique admin UID identifier
  category?: string; // e.g. Politics, Tech, Sports, Opinion, Business, etc.
  createdAt: any; // Firestore Timestamp or Date representation
  updatedAt?: any; // Firestore Timestamp or Date representation
  publishedAt?: any; // Publication timestamp representation (ISO string, Date, or epoch ms)
  status?: 'published' | 'draft' | 'archived'; // Publication status
  likes?: number; // Upvotes count
  dislikes?: number; // Downvotes count
  imageUrl?: string; // Opt to attach image/link
  imageUrlFallback?: string; // Secondary self-healing fallback URL
  imageUrls?: string[]; // Multiple extra image links
  imageUrlsFallback?: string[]; // Secondary self-healing fallback URLs for gallery
  imagePosition?: 'top' | 'middle' | 'bottom'; // Position mapping: top, middle, bottom
  galleryPositions?: ('gallery' | 'top' | 'middle' | 'bottom' | 'inline')[]; // Flow placement for all photos
  views?: number; // Total article views
  hashtags?: string[]; // Custom social/instagram hashtags
  excerpt?: string; // Light feed plain-text excerpt (~200 chars)
  version?: number; // Editorial monotonic revision number
  syncPending?: boolean; // Outbox sync to Cloudflare D1
  syncedVersion?: number; // Synced version in D1
  syncError?: string | null; // D1 sync error message if failed
}

export function slugify(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}

export function toSafeSlug(value: string): string {
  if (!value) return '';
  return value
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
    .replace(/-+$/, '');
}
