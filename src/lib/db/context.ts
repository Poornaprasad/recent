/**
 * Database context
 * Centralized database connection management for PostgreSQL
 */

import 'server-only';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { getDb, initDb } from './index';
import * as schema from './schema';

class DbContext {
  private initialized = false;

  /**
   * Get database instance, initializing if necessary
   */
  async getDatabase(): Promise<NodePgDatabase<typeof schema>> {
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
