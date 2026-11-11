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
    let sanitizedConnectionString = connectionString;
    // Suppress pg/libpq warning when sslmode=require is used without uselibpqcompat
    if (
      sanitizedConnectionString.includes('sslmode=require') &&
      !sanitizedConnectionString.includes('uselibpqcompat')
    ) {
      sanitizedConnectionString += (sanitizedConnectionString.includes('?') ? '&' : '?') + 'uselibpqcompat=true';
    }

    pool = new pg.Pool({
      connectionString: sanitizedConnectionString,
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

const tablePrivilegeCache = new Map<string, boolean>();

/**
 * Checks whether the connected PostgreSQL user has permission to perform the requested operation on a table.
 * Caches results in memory to avoid redundant catalog lookups on high-frequency routes.
 */
export async function hasTablePrivilege(
  tableName: string,
  privilege: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' = 'SELECT'
): Promise<boolean> {
  const cacheKey = `${tableName}:${privilege}`;
  if (tablePrivilegeCache.has(cacheKey)) {
    return tablePrivilegeCache.get(cacheKey)!;
  }
  try {
    const res = await query<{ can_access: boolean }>(
      `SELECT (to_regclass($1) IS NOT NULL AND has_table_privilege(current_user, $1, $2)) as can_access`,
      [`public.${tableName}`, privilege]
    );
    const allowed = Boolean(res.rows[0]?.can_access);
    tablePrivilegeCache.set(cacheKey, allowed);
    return allowed;
  } catch {
    tablePrivilegeCache.set(cacheKey, false);
    return false;
  }
}

/**
 * Idempotently verifies that core schema tables exist and logs verification.
 * Checks for DDL (CREATE) schema privileges first before attempting CREATE TABLE statements,
 * ensuring non-owner application users (e.g. cn_app) connect cleanly without permission denied errors.
 */
export async function ensureDatabaseSchema(): Promise<void> {
  if (!isNeonConfigured()) return;
  try {
    // 1. Probe if the active connection has DDL (CREATE) privileges on schema public
    const privRes = await query<{ can_create: boolean }>(
      "SELECT has_schema_privilege(current_user, 'public', 'CREATE') as can_create"
    );
    const canCreate = Boolean(privRes.rows[0]?.can_create);

    if (!canCreate) {
      // The connected database role (such as cn_app) is a production least-privilege DML user.
      // DDL operations are intentionally managed by migrations or DB admins.
      // Verify table availability safely via to_regclass without throwing permission errors.
      const tableStatus = await query<{ tbl: string; exists: boolean }>(`
        SELECT 'articles' as tbl, to_regclass('public.articles') IS NOT NULL as exists
        UNION ALL
        SELECT 'staff' as tbl, to_regclass('public.staff') IS NOT NULL as exists
        UNION ALL
        SELECT 'push_subscriptions' as tbl, to_regclass('public.push_subscriptions') IS NOT NULL as exists
        UNION ALL
        SELECT 'audit_log' as tbl, to_regclass('public.audit_log') IS NOT NULL as exists
      `);
      const existing = tableStatus.rows.filter(r => r.exists).map(r => r.tbl);
      console.log(`[Neon Database] Core tables verified for application role (${existing.join(', ')}).`);
      return;
    }

    // 2. If connected with administrative/migration DDL privileges, run schema migrations idempotently
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

