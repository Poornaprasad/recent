/**
 * Database configuration
 * Note: No 'server-only' import to allow usage in Node.js scripts
 */

export const DATABASE_CONFIG = {
  // PostgreSQL connection string
  url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/invoice_management',

  // Connection pool settings
  max: parseInt(process.env.DB_POOL_MAX || '10', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,

  // SSL configuration (required for production)
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: true,
  } : false,
} as const;





