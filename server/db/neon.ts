import pg from 'pg';
import type { Pool as PgPool, QueryResult, QueryResultRow } from 'pg';

let pool: PgPool | null = null;
let hasLoggedWarning = false;

/**
 * Checks if Neon database connection string is configured in the environment.
 */
export function isNeonConfigured(): boolean {
  return Boolean(process.env.NEON_DATABASE_URL && process.env.NEON_DATABASE_URL.trim().length > 0);
}

/**
 * Returns the pooled PostgreSQL client for Cloud Run server-side operations.
 * Lazily initialized so missing configuration does not crash public reader routes on startup.
 */
export function getPool(): PgPool | null {
  const connectionString = (process.env.NEON_DATABASE_URL || '').trim();

  if (!connectionString) {
    if (!hasLoggedWarning) {
      console.warn('[Neon Database] WARNING: NEON_DATABASE_URL is not set. Editorial database persistence will be unavailable until provisioned in Secret Manager.');
      hasLoggedWarning = true;
    }
    return null;
  }

  if (!pool) {
    pool = new pg.Pool({
      connectionString,
      ssl: true,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('[Neon Database] Unexpected idle client error:', err?.message || err);
    });
  }

  return pool;
}

/**
 * Safely executes a parameterized SQL query against the Neon PostgreSQL database.
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params: any[] = []
): Promise<QueryResult<T>> {
  const p = getPool();
  if (!p) {
    throw new Error('NEON_DATABASE_UNAVAILABLE: NEON_DATABASE_URL environment variable is not configured.');
  }

  const start = Date.now();
  try {
    const res = await p.query<T>(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`[Neon Database] Slow query (${duration}ms): ${text.substring(0, 80)}...`);
    }
    return res;
  } catch (err: any) {
    console.error(`[Neon Database] Query error:`, err?.message || err);
    throw err;
  }
}

/**
 * Idempotently verifies that core schema tables (push_subscriptions, users, subscribers) exist.
 */
export async function ensureDatabaseSchema(): Promise<void> {
  if (!isNeonConfigured()) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id bigserial PRIMARY KEY,
        endpoint text UNIQUE NOT NULL,
        p256dh text NOT NULL DEFAULT '',
        auth text NOT NULL DEFAULT '',
        user_agent text,
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS users (
        uid text PRIMARY KEY,
        email text UNIQUE NOT NULL,
        role text DEFAULT 'writer',
        display_name text,
        photo_url text,
        last_login_at timestamptz DEFAULT now(),
        created_at timestamptz DEFAULT now()
      );

      ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamptz DEFAULT now();

      CREATE TABLE IF NOT EXISTS subscribers (
        id bigserial PRIMARY KEY,
        email text UNIQUE NOT NULL,
        created_at timestamptz DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(lower(email));
      CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(lower(email));
    `);
    console.log('[Neon Database] Core schema tables (push_subscriptions, users, subscribers) verified.');
  } catch (err: any) {
    console.warn('[Neon Database] Schema initialization notice:', err?.message || err);
  }
}

