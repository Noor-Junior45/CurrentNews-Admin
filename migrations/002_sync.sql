-- Migration 002: Add sync outbox columns to articles table
-- Tracks pending live synchronization to Cloudflare D1 reader edge

ALTER TABLE articles 
  ADD COLUMN IF NOT EXISTS sync_pending boolean NOT NULL DEFAULT true, 
  ADD COLUMN IF NOT EXISTS synced_version int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_articles_sync_pending ON articles(updated_at) WHERE sync_pending;

-- Backfill: set sync_pending=false for rows that have synced_at set and status='archived'/'draft' with no D1 copy needed
UPDATE articles 
  SET sync_pending = false 
  WHERE synced_at IS NOT NULL AND status IN ('archived', 'draft');
