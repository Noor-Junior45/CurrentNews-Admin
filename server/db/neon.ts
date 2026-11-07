import { Pool, QueryResult, QueryResultRow } from 'pg';

let pool: Pool | null = null;
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
export function getPool(): Pool | null {
  const connectionString = (process.env.NEON_DATABASE_URL || '').trim();

  if (!connectionString) {
    if (!hasLoggedWarning) {
      console.warn('[Neon Database] WARNING: NEON_DATABASE_URL is not set. Editorial database persistence will be unavailable until provisioned in Secret Manager.');
      hasLoggedWarning = true;
    }
    return null;
  }

  if (!pool) {
    pool = new Pool({
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
