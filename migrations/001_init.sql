-- Migration 001: Initial schema for CurrentNews Editorial Desk
-- Idempotent schema definition

CREATE TABLE IF NOT EXISTS staff (
  uid text PRIMARY KEY,
  email text NOT NULL,
  pen_name text,
  role text NOT NULL CHECK (role IN ('admin', 'writer')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS articles (
  id text PRIMARY KEY,
  slug text UNIQUE,
  title text NOT NULL,
  excerpt text,
  content text NOT NULL,
  category text,
  hashtags text[] DEFAULT '{}',
  youtube_url text,
  facebook_url text,
  custom_links text[] DEFAULT '{}',
  image_url text,
  image_url_fallback text,
  image_urls text[] DEFAULT '{}',
  image_urls_fallback text[] DEFAULT '{}',
  image_position text,
  gallery_positions text[] DEFAULT '{}',
  author_uid text,
  author_name text,
  author_email text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  synced_at timestamptz,
  sync_error text
);

-- Performance and query indexes
CREATE INDEX IF NOT EXISTS idx_articles_status_pub ON articles(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category_pub ON articles(category, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_author_uid ON articles(author_uid);

-- Partial index for background R2/CDN synchronization worker
CREATE INDEX IF NOT EXISTS idx_articles_un_synced ON articles(id) WHERE synced_at IS NULL AND status = 'published';

-- Administrative audit trail for tamper-evident compliance
CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  actor_uid text,
  actor_email text,
  action text NOT NULL,
  entity text,
  entity_id text,
  meta jsonb,
  ip text,
  created_at timestamptz DEFAULT now()
);
