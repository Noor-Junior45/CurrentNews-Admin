-- Cloudflare D1 Schema for Current News Live Reader-Side Data
-- High-throughput, scale-to-zero SQLite at the Cloudflare Edge

CREATE TABLE IF NOT EXISTS posts_stats (
  post_id TEXT PRIMARY KEY,
  likes INTEGER DEFAULT 0,
  dislikes INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reactions (
  user_id TEXT,
  post_id TEXT,
  type TEXT CHECK(type IN ('like', 'dislike')),
  updated_at INTEGER,
  PRIMARY KEY(user_id, post_id)
);

CREATE TABLE IF NOT EXISTS subscribers (
  email TEXT PRIMARY KEY,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  subscription TEXT,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS users (
  uid TEXT PRIMARY KEY,
  pen_name TEXT
);

CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON reactions(user_id);
