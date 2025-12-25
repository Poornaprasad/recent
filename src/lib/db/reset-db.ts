/**
 * Reset database - Drop all tables and recreate from consolidated migration
 * WARNING: This will DELETE ALL TABLES and ALL DATA!
 * Run this script: npm run db:reset
 * 
 * This script will:
 * 1. Drop all existing tables (in correct order to handle foreign keys)
 * 2. Run the consolidated migration to recreate all tables
 */

import 'dotenv/config';
import { initDb, closeDb } from './script';
import { getDb } from './script';
import { sql } from 'drizzle-orm';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getPool } from './script';

async function resetDatabase() {
  try {
    console.log('⚠️  WARNING: This will DELETE ALL TABLES and ALL DATA!');
    console.log('This will drop all tables and recreate them from the consolidated migration.\n');
    
    await initDb();
    const db = getDb();
    
    console.log('✓ Database connected');
    console.log('Step 1: Dropping all existing tables...\n');
    
    // List of all tables in reverse dependency order (drop children first)
    // This ensures we can drop tables with foreign keys
    const tables = [
      // Tables with foreign keys (drop first)
      'approval_audit_logs',
      'credit_authorizations',
      'invoice_attachments',
      'daily_run_updates',
      'approval_rules',
      'case_vendor_disbursement_types',
      'vendor_w9_status',
      'pending_vendors',
      'document_sync_errors',
      'permission_matrix',
      'invoices',
      'vendors',
      'vendor_types',
      'users',
      'audit_logs',
      'disbursement_types',
      'disbursement_statuses',
      'bank_accounts',
      'expense_accounts',
    ];
    
    // Drop all tables
    let droppedCount = 0;
    for (const table of tables) {
      try {
        await db.execute(sql.raw(`DROP TABLE IF EXISTS "${table}" CASCADE;`));
        console.log(`✓ Dropped: ${table}`);
        droppedCount++;
      } catch (error) {
        console.error(`✗ Failed to drop ${table}:`, error instanceof Error ? error.message : String(error));
      }
    }
    
    console.log(`\n✓ Dropped ${droppedCount} tables`);
    console.log('\nStep 2: Running consolidated migration to recreate all tables...\n');
    
    // Read and execute the consolidated migration
    const migrationPath = join(process.cwd(), 'drizzle', 'migrations', '0000_consolidated_production_schema.sql');
    
    try {
      const migrationSQL = readFileSync(migrationPath, 'utf-8');
      
      console.log('Executing consolidated migration...');
      
      // Use the pool directly to execute the SQL file
      // This handles multi-statement SQL files better than drizzle's execute
      const pool = getPool();
      const client = await pool.connect();
      
      try {
        // Execute the entire migration file
        await client.query(migrationSQL);
        console.log('✓ Consolidated migration executed successfully');
      } finally {
        client.release();
      }
      
      // Verify tables were created
      console.log('\nStep 3: Verifying tables were created...\n');
      
      const verifyResult = await db.execute(sql.raw(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `));
      
      const createdTables = verifyResult.rows.map((row: any) => row.table_name);
      console.log(`✓ Found ${createdTables.length} tables:`);
      createdTables.forEach((table: string) => {
        console.log(`  - ${table}`);
      });
      
      // Check for expected tables
      const expectedTables = [
        'invoices',
        'users',
        'vendors',
        'vendor_types',
        'pending_vendors',
        'audit_logs',
        'approval_audit_logs',
        'disbursement_types',
        'disbursement_statuses',
        'case_vendor_disbursement_types',
        'bank_accounts',
        'expense_accounts',
        'vendor_w9_status',
        'credit_authorizations',
        'approval_rules',
        'invoice_attachments',
        'document_sync_errors',
        'daily_run_updates',
        'permission_matrix',
      ];
      
      const missingTables = expectedTables.filter(table => !createdTables.includes(table));
      
      if (missingTables.length > 0) {
        console.warn(`\n⚠️  Warning: Some expected tables are missing:`);
        missingTables.forEach(table => console.warn(`  - ${table}`));
      } else {
        console.log('\n✓ All expected tables are present!');
      }
      
      console.log('\n✅ Database reset complete!');
      console.log('All tables have been dropped and recreated from the consolidated migration.');
      console.log('\nNext steps:');
      console.log('  - Run seed scripts if needed');
      console.log('  - Verify schema: npm run db:studio');
      
    } catch (migrationError) {
      console.error('✗ Failed to execute migration:', migrationError);
      console.error('\nYou may need to run the migration manually:');
      console.error('  npm run db:migrate');
      throw migrationError;
    }
    
  } catch (error) {
    console.error('✗ Failed to reset database:', error);
    throw error;
  } finally {
    await closeDb();
    process.exit(0);
  }
}

// Run the script
resetDatabase();

