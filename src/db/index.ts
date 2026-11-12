import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema.js';

export class DatabaseNotConfiguredError extends Error {
  public readonly statusCode = 503;

  constructor(
    message = 'PostgreSQL database is not configured. Set the DATABASE_URL environment variable.'
  ) {
    super(message);
    this.name = 'DatabaseNotConfiguredError';
  }
}

let poolInstance: Pool | null = null;
let dbInstance: NodePgDatabase<typeof schema> | null = null;

function resolveSslConfig(connectionString: string): PoolConfig['ssl'] {
  if (process.env.DATABASE_SSL === 'true') {
    return { rejectUnauthorized: false };
  }
  if (process.env.DATABASE_SSL === 'false') {
    return false;
  }

  try {
    const parsed = new URL(connectionString);
    const hostname = parsed.hostname.toLowerCase();
    const sslMode = parsed.searchParams.get('sslmode');

    if (sslMode === 'disable') {
      return false;
    }
    if (sslMode === 'require' || sslMode === 'verify-full' || sslMode === 'verify-ca') {
      return { rejectUnauthorized: false };
    }

    // Render internal hostnames look like "dpg-xxxxxx-a" (no dots) and do not require SSL.
    // Render external hostnames look like "dpg-xxxxxx-a.oregon-postgres.render.com" and require SSL.
    const isLocalHost =
      hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    const isRenderInternal = hostname.startsWith('dpg-') && !hostname.includes('.');

    if (isLocalHost || isRenderInternal) {
      return false;
    }

    if (hostname.includes('render.com') || process.env.NODE_ENV === 'production') {
      return { rejectUnauthorized: false };
    }
  } catch {
    if (process.env.NODE_ENV === 'production') {
      return { rejectUnauthorized: false };
    }
  }

  return false;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
}

export function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new DatabaseNotConfiguredError();
  }

  if (!poolInstance) {
    poolInstance = new Pool({
      connectionString,
      ssl: resolveSslConfig(connectionString),
      max: Number(process.env.PG_POOL_MAX || 15),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });

    poolInstance.on('error', (err) => {
      console.error('[PostgreSQL Pool Error]', err.message);
    });
  }

  return poolInstance;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!dbInstance) {
    dbInstance = drizzle(getPool(), { schema });
  }
  return dbInstance;
}

export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  configured: boolean;
  latencyMs?: number;
  error?: string;
}> {
  if (!isDatabaseConfigured()) {
    return {
      configured: false,
      connected: false,
      error: 'DATABASE_URL is not set',
    };
  }

  const start = Date.now();
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    return {
      configured: true,
      connected: true,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      configured: true,
      connected: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Database connection failed',
    };
  }
}

export async function closePool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
    dbInstance = null;
  }
}
