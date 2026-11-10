-- Migration: 005_users_role_default_writer.sql
-- Ensure existing databases update users.role default to 'writer'

ALTER TABLE IF EXISTS users ALTER COLUMN role SET DEFAULT 'writer';
UPDATE users SET role = 'writer' WHERE role = 'admin' AND uid NOT IN (SELECT uid FROM staff WHERE role = 'admin');

