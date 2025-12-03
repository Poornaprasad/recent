/**
 * Database context
 * Centralized database connection management
 */

import 'server-only';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { getDb, initDb } from './index';
import * as schema from './schema';

class DbContext {
  private initialized = false;

  /**
   * Get database instance, initializing if necessary
   */
  async getDatabase(): Promise<BetterSQLite3Database<typeof schema>> {
    if (!this.initialized) {
      await initDb();
      this.initialized = true;
    }
    return getDb();
  }

  /**
   * Reset initialization state (useful for testing)
   */
  reset(): void {
    this.initialized = false;
  }
}

// Export singleton instance
export const dbContext = new DbContext();

/**
 * Convenience function to get database
 * Usage: const db = await getDatabase();
 */
export async function getDatabase() {
  return dbContext.getDatabase();
}
