/**
 * Database configuration
 * Note: No 'server-only' import to allow usage in Node.js scripts
 */

// Development-only fallback credentials - production must always use DATABASE_URL env var
const DEV_FALLBACK_URL = 'postgresql://postgres:postgres@localhost:5432/invoice_management';

// Warn if using fallback in non-development environment
if (!process.env.DATABASE_URL && process.env.NODE_ENV === 'production') {
  throw new Error('DATABASE_URL environment variable is required in production');
}

export const DATABASE_CONFIG = {
  // PostgreSQL connection string
  url: process.env.DATABASE_URL || DEV_FALLBACK_URL,

  // Connection pool settings
  max: parseInt(process.env.DB_POOL_MAX || '10', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,

  // SSL configuration (required for production)
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: true,
  } : false,
} as const;





