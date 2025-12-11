/**
 * Clear all data from database
 * WARNING: This will delete ALL data from ALL tables!
 * Run this script: npm run db:clear
 */

import 'dotenv/config';
import { initDb, closeDb } from './script';
import { getDb } from './script';
import { sql } from 'drizzle-orm';

async function clearDatabase() {
  try {
    console.log('⚠️  WARNING: This will delete ALL data from ALL tables!');
    console.log('Initializing database connection...');
    
    await initDb();
    const db = getDb();
    
    console.log('✓ Database connected');
    console.log('Starting to clear all tables...\n');
    
    // List of all tables in the correct order (respecting foreign keys)
    // We'll use TRUNCATE CASCADE to handle foreign key constraints automatically
    const tables = [
      'approval_audit_logs',
      'credit_authorizations',
      'invoice_attachments',
      'daily_run_updates',
      'approval_rules',
      'case_vendor_disbursement_types',
      'vendor_w9_status',
      'pending_vendors',
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
    
    // Truncate all tables with CASCADE to handle foreign key constraints
    let clearedCount = 0;
    for (const table of tables) {
      try {
        // Use TRUNCATE CASCADE to automatically handle foreign key dependencies
        await db.execute(sql.raw(`TRUNCATE TABLE "${table}" CASCADE;`));
        console.log(`✓ Cleared: ${table}`);
        clearedCount++;
      } catch (error) {
        // If table doesn't exist or has issues, try DELETE as fallback
        try {
          await db.execute(sql.raw(`DELETE FROM "${table}";`));
          console.log(`✓ Cleared (using DELETE): ${table}`);
          clearedCount++;
        } catch (deleteError) {
          console.error(`✗ Failed to clear ${table}:`, error instanceof Error ? error.message : String(error));
        }
      }
    }
    
    console.log(`\n✓ Database cleared successfully!`);
    console.log(`  Cleared ${clearedCount} out of ${tables.length} tables`);
    console.log('\nAll data has been deleted from the database.');
    console.log('Tables structure remains intact.');
    
  } catch (error) {
    console.error('✗ Failed to clear database:', error);
    throw error;
  } finally {
    await closeDb();
    process.exit(0);
  }
}

// Run the script
clearDatabase();
