# Neon PostgreSQL Architecture & Provisioning Guide

## 1. Overview
Current News uses Neon Serverless PostgreSQL as the authoritative source of truth for the newsroom editorial desk (staff roles, drafts, revisions, and published articles). Public reads continue to be delivered at 0ms latency via Cloudflare Anycast CDN and R2 (`media.currentnews.blog`), while writers and editors persist content directly to Neon.

## 2. Limited-Permission Postgres Role
For production security on Google Cloud Run, never connect using the root default database owner (`neondb_owner`). Create a restricted application user:

```sql
-- Connect to Neon as database administrator:
CREATE ROLE currentnews_app WITH LOGIN PASSWORD 'YOUR_STRONG_RANDOM_PASSWORD';

-- Grant required schema permissions:
GRANT CONNECT ON DATABASE neondb TO currentnews_app;
GRANT USAGE ON SCHEMA public TO currentnews_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO currentnews_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO currentnews_app;

-- Ensure future tables inherit permissions:
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO currentnews_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO currentnews_app;
```

Construct the connection string:
```
postgresql://currentnews_app:YOUR_STRONG_RANDOM_PASSWORD@ep-xyz.region.aws.neon.tech/neondb?sslmode=require
```

## 3. Secret Manager & Environment Configuration
1. In Google Cloud Console, navigate to **Security** > **Secret Manager**.
2. Create a secret named `NEON_DATABASE_URL` with the pooled connection string.
3. In Google Cloud Run, mount `NEON_DATABASE_URL` as an Environment Variable referencing Secret Manager.
4. **CRITICAL:** `NEON_DATABASE_URL` must **NEVER** start with `VITE_` and must **NEVER** be committed to Git or exposed to the client bundle.

## 4. Authentication Architecture Notice
**Neon Auth is NOT used.**
All identity, sign-in, and role assertions are handled via **Firebase Authentication Custom Claims** verified cryptographically server-side with Application Default Credentials (`adminAuth.verifyIdToken(token, true)`). Neon strictly stores the data rows and validates permissions based on the verified `author_uid` and `role`.
