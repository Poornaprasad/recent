/**
 * Apply Foreign Key Constraints
 * Run this script: npm run db:apply-fks
 * 
 * This script applies the foreign key constraints migration directly
 */

import 'dotenv/config';
import { initDb, closeDb, getPool } from './script';
import { readFileSync } from 'fs';
import { join } from 'path';

async function applyForeignKeys() {
  try {
    console.log('Applying foreign key constraints...\n');
    
    await initDb();
    const pool = getPool();
    const client = await pool.connect();
    
    try {
      // Read and execute the foreign keys migration
      const migrationPath = join(process.cwd(), 'drizzle', 'migrations', '0002_add_foreign_keys.sql');
      const migrationSQL = readFileSync(migrationPath, 'utf-8');
      
      console.log('Executing foreign key constraints migration...');
      await client.query(migrationSQL);
      
      console.log('✅ Foreign key constraints applied successfully!');
      
      // Verify foreign keys were created
      const fkResult = await client.query(`
        SELECT
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name,
          rc.delete_rule,
          rc.update_rule
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        JOIN information_schema.referential_constraints AS rc
          ON rc.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        ORDER BY tc.table_name, kcu.column_name;
      `);
      
      console.log(`\n✅ Found ${fkResult.rows.length} foreign key constraints:`);
      fkResult.rows.forEach((fk: any) => {
        console.log(`  - ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name} (ON DELETE ${fk.delete_rule}, ON UPDATE ${fk.update_rule})`);
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('✗ Failed to apply foreign keys:', error);
    throw error;
  } finally {
    await closeDb();
    process.exit(0);
  }
}

applyForeignKeys();

