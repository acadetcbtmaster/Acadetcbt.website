import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { closePool, getPool, isDatabaseConfigured } from './index.js';

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'migrations');

let migrationsCompleted = false;
let inFlightMigration: Promise<{ applied: string[]; skipped: string[] }> | null = null;

export async function runMigrations(): Promise<{ applied: string[]; skipped: string[] }> {
  if (!isDatabaseConfigured()) {
    throw new Error('DATABASE_URL environment variable is required to run migrations.');
  }

  const pool = getPool();
  const applied: string[] = [];
  const skipped: string[] = [];

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const files = (await fs.readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  const existingResult = await pool.query<{ filename: string }>(
    'SELECT filename FROM schema_migrations'
  );
  const alreadyApplied = new Set(existingResult.rows.map((r) => r.filename));

  for (const file of files) {
    if (alreadyApplied.has(file)) {
      skipped.push(file);
      continue;
    }

    const sqlText = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf-8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sqlText);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      applied.push(file);
      console.log(`[Migration] Applied ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`[Migration] Failed applying ${file}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  migrationsCompleted = true;
  return { applied, skipped };
}

export async function ensureMigrated(): Promise<void> {
  if (migrationsCompleted || !isDatabaseConfigured()) return;
  if (!inFlightMigration) {
    inFlightMigration = runMigrations().finally(() => {
      inFlightMigration = null;
    });
  }
  await inFlightMigration;
}

const entryArg = process.argv[1] ? path.resolve(process.argv[1]) : '';
const isDirectRun =
  entryArg.endsWith(`${path.sep}migrate.ts`) || entryArg.endsWith(`${path.sep}migrate.js`);

if (isDirectRun) {
  runMigrations()
    .then(async (res) => {
      console.log(
        `[Migration] Complete. Applied: ${res.applied.length}, Skipped: ${res.skipped.length}`
      );
      await closePool();
    })
    .catch(async (err) => {
      console.error('[Migration] Error:', err);
      await closePool();
      process.exit(1);
    });
}
