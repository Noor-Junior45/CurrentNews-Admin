-- D1 Migration 0001: Articles table for high-throughput public reader edge queries
-- Idempotent schema definition holding ONLY published articles

CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  category TEXT,
  hashtags TEXT DEFAULT '[]',
  youtube_url TEXT,
  facebook_url TEXT,
  custom_links TEXT DEFAULT '[]',
  image_url TEXT,
  image_url_fallback TEXT,
  image_urls TEXT DEFAULT '[]',
  image_urls_fallback TEXT DEFAULT '[]',
  image_position TEXT,
  gallery_positions TEXT DEFAULT '[]',
  author_name TEXT,
  published_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category, published_at DESC, id DESC);
