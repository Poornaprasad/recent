/**
 * Database connection and utilities
 * PostgreSQL with Drizzle ORM
 */

import 'server-only';

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { DATABASE_CONFIG } from '../config/database';

// Create PostgreSQL connection pool
let pool: Pool | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Get PostgreSQL connection pool
 */
function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_CONFIG.url,
      max: DATABASE_CONFIG.max,
      idleTimeoutMillis: DATABASE_CONFIG.idleTimeoutMillis,
      connectionTimeoutMillis: DATABASE_CONFIG.connectionTimeoutMillis,
      ssl: DATABASE_CONFIG.ssl || undefined,
    });

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('[Database] Unexpected error on idle client', err);
    });
  }

  return pool;
}

/**
 * Get Drizzle ORM database instance
 */
export function getDb() {
  if (!dbInstance) {
    const poolInstance = getPool();
    dbInstance = drizzle(poolInstance, { schema });
  }

  return dbInstance;
}

/**
 * Initialize database (create tables, run migrations)
 * This should be called on application startup
 */
export async function initDb() {
  try {
    const db = getDb();

    // Test connection
    const poolInstance = getPool();
    const client = await poolInstance.connect();
    console.log('[Database] ✓ PostgreSQL connection successful');
    client.release();

    // Note: Migrations should be run separately using \`npm run db:migrate\`
    // This ensures proper version control and rollback capabilities

    return db;
  } catch (error) {
    console.error('[Database] ✗ Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Close database connections
 * Should be called on application shutdown
 */
export async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
    dbInstance = null;
    console.log('[Database] Connection pool closed');
  }
}

/**
 * Check database health
 */
export async function checkDbHealth(): Promise<boolean> {
  try {
    const poolInstance = getPool();
    const client = await poolInstance.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('[Database] Health check failed:', error);
    return false;
  }
}
