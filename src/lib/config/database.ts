/**
 * Database configuration
 */

import 'server-only';

export const DATABASE_CONFIG = {
  path: process.env.DATABASE_URL || './data/database.db',
  enableWAL: true,
  enableForeignKeys: true,
} as const;





