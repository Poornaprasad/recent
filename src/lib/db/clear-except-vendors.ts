/**
 * Clear all data from database except vendors and vendor_types
 * WARNING: This will delete ALL data from ALL tables except vendors and vendor_types!
 * Run this script: npm run db:clear-except-vendors
 */

import 'dotenv/config';
import { initDb, closeDb } from './script';
import { getDb } from './script';
import { sql } from 'drizzle-orm';

async function clearDatabaseExceptVendors() {
  try {
    console.log('⚠️  WARNING: This will delete ALL data from ALL tables except vendors and vendor_types!');
    console.log('Initializing database connection...');
    
    await initDb();
    const db = getDb();
    
    console.log('✓ Database connected');
    console.log('Starting to clear tables (preserving vendors and vendor_types)...\n');
    
    // List of tables to clear (excluding vendors and vendor_types)
    // Order matters for foreign key constraints
    const tablesToClear = [
      'approval_audit_logs',
      'credit_authorizations',
      'invoice_attachments',
      'daily_run_updates',
      'approval_rules',
      'case_vendor_disbursement_types',
      'vendor_w9_status',
      'pending_vendors',
      'invoices',
      'users',
      'audit_logs',
      'disbursement_types',
      'disbursement_statuses',
      'bank_accounts',
      'expense_accounts',
      'permission_matrix',
    ];
    
    // Tables to preserve
    const tablesToPreserve = [
      'vendors',
      'vendor_types',
    ];
    
    // First, get counts of preserved tables
    console.log('📊 Current data counts:');
    for (const table of tablesToPreserve) {
      try {
        const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM "${table}";`));
        const count = result.rows[0]?.count || 0;
        console.log(`  ${table}: ${count} records (will be preserved)`);
      } catch (error) {
        console.log(`  ${table}: Unable to count (table may not exist)`);
      }
    }
    console.log('');
    
    // Clear tables
    let clearedCount = 0;
    for (const table of tablesToClear) {
      try {
        // Get count before deletion
        const countResult = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM "${table}";`));
        const beforeCount = countResult.rows[0]?.count || 0;
        
        // Use TRUNCATE CASCADE to automatically handle foreign key dependencies
        await db.execute(sql.raw(`TRUNCATE TABLE "${table}" CASCADE;`));
        console.log(`✓ Cleared: ${table} (${beforeCount} records deleted)`);
        clearedCount++;
      } catch (error) {
        // If table doesn't exist or has issues, try DELETE as fallback
        try {
          const countResult = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM "${table}";`));
          const beforeCount = countResult.rows[0]?.count || 0;
          
          await db.execute(sql.raw(`DELETE FROM "${table}";`));
          console.log(`✓ Cleared (using DELETE): ${table} (${beforeCount} records deleted)`);
          clearedCount++;
        } catch (deleteError) {
          console.error(`✗ Failed to clear ${table}:`, error instanceof Error ? error.message : String(error));
        }
      }
    }
    
    // Show final counts
    console.log('\n📊 Final data counts:');
    for (const table of tablesToPreserve) {
      try {
        const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM "${table}";`));
        const count = result.rows[0]?.count || 0;
        console.log(`  ${table}: ${count} records (preserved)`);
      } catch (error) {
        console.log(`  ${table}: Unable to count`);
      }
    }
    
    console.log(`\n✓ Database cleared successfully!`);
    console.log(`  Cleared ${clearedCount} out of ${tablesToClear.length} tables`);
    console.log(`  Preserved ${tablesToPreserve.length} tables (vendors and vendor_types)`);
    console.log('\nAll data has been deleted except vendor list.');
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
clearDatabaseExceptVendors();

