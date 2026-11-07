-- Migration: 003_push
-- Creates push_subscriptions table for storing Web Push device registrations.
-- Replaces the previous local data/push_subscriptions.json file storage.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         bigserial   PRIMARY KEY,
  endpoint   text        UNIQUE NOT NULL,
  p256dh     text        NOT NULL,
  auth       text        NOT NULL,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

