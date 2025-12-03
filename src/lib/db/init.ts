/**
 * Database initialization script
 * Run this to initialize the database: npm run db:init
 */

import 'dotenv/config';
import { initDb, checkDbHealth, closeDb } from './script';

async function main() {
  try {
    console.log('Initializing database...');

    await initDb();
    console.log('✓ Database initialized');

    const isHealthy = await checkDbHealth();
    if (isHealthy) {
      console.log('✓ Database health check passed');
    } else {
      console.error('✗ Database health check failed');
      process.exit(1);
    }

    console.log('\n✓ Database setup complete!');
    console.log('\nNext steps:');
    console.log('1. Run migrations: npm run db:push');
    console.log('2. (Optional) Open Drizzle Studio: npm run db:studio');

  } catch (error) {
    console.error('✗ Database initialization failed:', error);
    process.exit(1);
  } finally {
    await closeDb();
    process.exit(0);
  }
}

main();





