/**
 * Database initialization script
 * Run this to set up the database schema
 */

import 'server-only';

import { initDb } from './index';

async function main() {
  console.log('Initializing database...');
  await initDb();
  console.log('Database initialized successfully!');
  process.exit(0);
}

main().catch((error) => {
  console.error('Error initializing database:', error);
  process.exit(1);
});





