#!/usr/bin/env node
/**
 * scripts/migrate-neon.mjs
 * 
 * Executes all SQL migration files in /migrations in sequential order.
 * Uses NEON_DATABASE_URL from environment variables or .env.
 * 
 * Usage:
 *   node scripts/migrate-neon.mjs
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import pg from 'pg';

const { Client } = pg;

// Load environment variables from .env if present
dotenv.config();
const envLocalPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}

const connectionString = (process.env.NEON_DATABASE_URL || '').trim();

if (!connectionString) {
  console.error('\n[ERROR] NEON_DATABASE_URL is not set.');
  console.error('Please configure NEON_DATABASE_URL in .env or your shell environment before migrating.\n');
  process.exit(1);
}

async function runMigrations() {
  console.log(`\n======================================================`);
  console.log(` CURRENT NEWS - Neon PostgreSQL Database Migrations`);
  console.log(`======================================================\n`);

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('[OK] Connected to Neon PostgreSQL.');

    // Ensure migration tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz DEFAULT now()
      );
    `);

    const migrationsDir = path.resolve(process.cwd(), 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('No /migrations directory found.');
      await client.end();
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} migration file(s):\n`);

    for (const file of files) {
      const checkRes = await client.query('SELECT version FROM _schema_migrations WHERE version = $1', [file]);
      if (checkRes.rows.length > 0) {
        console.log(`  [SKIP] ${file} (already applied)`);
        continue;
      }

      console.log(`  [APPLYING] ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`  [OK] ${file} applied successfully.`);
      } catch (sqlErr) {
        await client.query('ROLLBACK');
        console.error(`  [FAILED] ${file}:`, sqlErr?.message || sqlErr);
        throw sqlErr;
      }
    }

    console.log(`\n------------------------------------------------------`);
    console.log(` ALL MIGRATIONS COMPLETED SUCCESSFULLY!`);
    console.log(`------------------------------------------------------\n`);
  } catch (err) {
    console.error('\n[MIGRATION ERROR]:', err?.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
