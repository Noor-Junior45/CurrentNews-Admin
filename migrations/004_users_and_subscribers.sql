-- Migration: 004_users_and_subscribers
-- Ensures users and subscribers tables exist for audience tracking and user login registration.

CREATE TABLE IF NOT EXISTS users (
  uid           text PRIMARY KEY,
  email         text UNIQUE NOT NULL,
  role          text DEFAULT 'writer',
  display_name  text,
  photo_url     text,
  last_login_at timestamptz DEFAULT now(),
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscribers (
  id         bigserial PRIMARY KEY,
  email      text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Ensure indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(lower(email));
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(lower(email));
