/**
 * Database connection and utilities
 * Uses SQLite for development, can be migrated to Postgres for production
 */

import 'server-only';

import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import { mkdir } from 'fs/promises';
import { DATABASE_CONFIG } from '../config/database';

const DB_PATH = DATABASE_CONFIG.path.startsWith('./') 
  ? path.join(process.cwd(), DATABASE_CONFIG.path.replace('./', ''))
  : DATABASE_CONFIG.path;

// Ensure data directory exists
async function ensureDataDir() {
  const dataDir = path.dirname(DB_PATH);
  try {
    await mkdir(dataDir, { recursive: true });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code !== 'EEXIST') {
      throw error;
    }
  }
}

// Initialize database connection
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let sqliteInstance: DatabaseType | null = null;

let migrationRun = false;

export function getDb() {
  // Ensure directory exists (synchronous for better-sqlite3)
  try {
    const dataDir = path.dirname(DB_PATH);
    require('fs').mkdirSync(dataDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }

  if (!sqliteInstance) {
    sqliteInstance = new Database(DB_PATH);
    
    // Enable foreign keys
    if (DATABASE_CONFIG.enableForeignKeys) {
      sqliteInstance.pragma('foreign_keys = ON');
    }
    
    // Enable WAL mode for better concurrency
    if (DATABASE_CONFIG.enableWAL) {
      sqliteInstance.pragma('journal_mode = WAL');
    }
  }
  
  // Run migrations synchronously before creating Drizzle instance
  if (!migrationRun) {
    runMigrationsSync(sqliteInstance);
    migrationRun = true;
  }
  
  if (!dbInstance) {
    dbInstance = drizzle(sqliteInstance, { schema });
  }
  
  return dbInstance;
}

export function getSqlite() {
  if (!sqliteInstance) {
    getDb(); // Initialize if not already
  }
  return sqliteInstance!;
}

// Run migrations synchronously (called from getDb)
function runMigrationsSync(sqlite: DatabaseType) {
  // Create tables
  const createTables = `
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT,
      invoice_date TEXT,
      vendor_name TEXT,
      vendor_address TEXT,
      customer_name TEXT,
      total_amount REAL,
      payment_terms TEXT,
      line_items TEXT,
      status TEXT NOT NULL CHECK(status IN ('Paid', 'Pending', 'Review', 'Draft')),
      document_type TEXT CHECK(document_type IN ('Invoice', 'Receipt', 'Reimbursement', 'Office Credit Card Bill')),
      invoice_data_uri TEXT NOT NULL,
      is_duplicate INTEGER DEFAULT 0,
      duplicate_reason TEXT,
      is_recurring INTEGER DEFAULT 0,
      recurring_pattern TEXT,
      has_amount_anomaly INTEGER DEFAULT 0,
      amount_anomaly_reason TEXT,
      expected_amount REAL,
      amount_deviation_percent REAL,
      is_high_value INTEGER DEFAULT 0,
      high_value_reason TEXT,
      requires_escalation INTEGER DEFAULT 0,
      escalation_level TEXT,
      comment TEXT,
      case_number TEXT,
      state TEXT CHECK(state IN ('CA', 'NY')),
      payment_type TEXT CHECK(payment_type IN ('Receipt', 'Invoice', 'Non-Financial', 'Other')),
      approval_status TEXT CHECK(approval_status IN ('Pending', 'Approved', 'Rejected', 'Requires_Approval')) DEFAULT 'Pending',
      approved_by TEXT,
      approved_at INTEGER,
      created_by TEXT,
      assigned_to TEXT,
      invoice_number_meta TEXT,
      invoice_date_meta TEXT,
      vendor_name_meta TEXT,
      vendor_address_meta TEXT,
      customer_name_meta TEXT,
      total_amount_meta TEXT,
      payment_terms_meta TEXT,
      line_items_meta TEXT,
      document_type_meta TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK(role IN ('admin', 'director', 'manager', 'account', 'user')),
      status TEXT NOT NULL CHECK(status IN ('Active', 'Inactive', 'Invited')) DEFAULT 'Active',
      assigned_states TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS vendor_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS vendors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      vendor_type TEXT,
      requires_1099 INTEGER DEFAULT 0,
      status TEXT NOT NULL CHECK(status IN ('Active', 'Inactive')) DEFAULT 'Active',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS pending_vendors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      vendor_type TEXT,
      invoice_id TEXT,
      status TEXT NOT NULL CHECK(status IN ('Pending', 'Completed', 'Rejected')) DEFAULT 'Pending',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
      user TEXT NOT NULL,
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      severity TEXT NOT NULL CHECK(severity IN ('INFO', 'WARNING', 'ERROR', 'CRITICAL')) DEFAULT 'INFO'
    );

    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
    CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
    CREATE INDEX IF NOT EXISTS idx_invoices_vendor ON invoices(vendor_name);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user);
    CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors(name);
    CREATE INDEX IF NOT EXISTS idx_vendors_type ON vendors(vendor_type);
    CREATE INDEX IF NOT EXISTS idx_vendors_1099 ON vendors(requires_1099);
    CREATE INDEX IF NOT EXISTS idx_pending_vendors_status ON pending_vendors(status);
    CREATE INDEX IF NOT EXISTS idx_pending_vendors_invoice ON pending_vendors(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_state ON invoices(state);
    CREATE INDEX IF NOT EXISTS idx_invoices_approval_status ON invoices(approval_status);
    CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON invoices(created_by);
    CREATE INDEX IF NOT EXISTS idx_invoices_assigned_to ON invoices(assigned_to);
  `;

  sqlite.exec(createTables);

  // Migrate existing tables to add new columns if they don't exist
  // IMPORTANT: Run migrations BEFORE any queries to ensure columns exist
  try {
    // Check if new columns exist, if not add them
    const tableInfo = sqlite.prepare("PRAGMA table_info(invoices)").all() as Array<{ name: string }>;
    const columnNames = tableInfo.map(col => col.name);
    
    // Log current columns for debugging
    console.log('[DB Migration] Current invoice columns:', columnNames);
    console.log('[DB Migration] Checking for missing columns...');

    const migrations = [];

    if (!columnNames.includes('is_recurring')) {
      migrations.push('ALTER TABLE invoices ADD COLUMN is_recurring INTEGER DEFAULT 0');
    }
    if (!columnNames.includes('recurring_pattern')) {
      migrations.push('ALTER TABLE invoices ADD COLUMN recurring_pattern TEXT');
    }
    if (!columnNames.includes('has_amount_anomaly')) {
      migrations.push('ALTER TABLE invoices ADD COLUMN has_amount_anomaly INTEGER DEFAULT 0');
    }
    if (!columnNames.includes('amount_anomaly_reason')) {
      migrations.push('ALTER TABLE invoices ADD COLUMN amount_anomaly_reason TEXT');
    }
    if (!columnNames.includes('expected_amount')) {
      migrations.push('ALTER TABLE invoices ADD COLUMN expected_amount REAL');
    }
    if (!columnNames.includes('amount_deviation_percent')) {
      migrations.push('ALTER TABLE invoices ADD COLUMN amount_deviation_percent REAL');
    }
    if (!columnNames.includes('is_high_value')) {
      migrations.push('ALTER TABLE invoices ADD COLUMN is_high_value INTEGER DEFAULT 0');
    }
    if (!columnNames.includes('high_value_reason')) {
      migrations.push('ALTER TABLE invoices ADD COLUMN high_value_reason TEXT');
    }
    if (!columnNames.includes('requires_escalation')) {
      migrations.push('ALTER TABLE invoices ADD COLUMN requires_escalation INTEGER DEFAULT 0');
    }
    if (!columnNames.includes('escalation_level')) {
      migrations.push('ALTER TABLE invoices ADD COLUMN escalation_level TEXT');
    }
    if (!columnNames.includes('comment')) {
      migrations.push('ALTER TABLE invoices ADD COLUMN comment TEXT');
    }
    if (!columnNames.includes('case_number')) {
      migrations.push('ALTER TABLE invoices ADD COLUMN case_number TEXT');
    }
    if (!columnNames.includes('state')) {
      // Add column without CHECK constraint first (SQLite doesn't support CHECK in ALTER TABLE)
      console.log('[DB Migration] Adding state column...');
      migrations.push('ALTER TABLE invoices ADD COLUMN state TEXT');
    } else {
      console.log('[DB Migration] state column already exists');
    }
    if (!columnNames.includes('payment_type')) {
      migrations.push('ALTER TABLE invoices ADD COLUMN payment_type TEXT');
    }
    if (!columnNames.includes('approval_status')) {
      migrations.push('ALTER TABLE invoices ADD COLUMN approval_status TEXT DEFAULT \'Pending\'');
    }
    if (!columnNames.includes('approved_by')) {
      migrations.push('ALTER TABLE invoices ADD COLUMN approved_by TEXT');
    }
    if (!columnNames.includes('approved_at')) {
      migrations.push('ALTER TABLE invoices ADD COLUMN approved_at INTEGER');
    }
    if (!columnNames.includes('created_by')) {
      migrations.push('ALTER TABLE invoices ADD COLUMN created_by TEXT');
    }
    if (!columnNames.includes('assigned_to')) {
      migrations.push('ALTER TABLE invoices ADD COLUMN assigned_to TEXT');
    }

    // Migrate users table
    const userTableInfo = sqlite.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
    const userColumnNames = userTableInfo.map(col => col.name);
    
    if (!userColumnNames.includes('assigned_states')) {
      migrations.push('ALTER TABLE users ADD COLUMN assigned_states TEXT');
    }

    // Create approval_rules table if it doesn't exist
    const approvalRulesTable = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='approval_rules'").all() as Array<{ name: string }>;
    if (approvalRulesTable.length === 0) {
      migrations.push(`
        CREATE TABLE approval_rules (
          id TEXT PRIMARY KEY,
          state TEXT NOT NULL CHECK(state IN ('CA', 'NY', 'ALL')) DEFAULT 'ALL',
          threshold_amount REAL NOT NULL DEFAULT 5000,
          requires_roles TEXT,
          is_active INTEGER DEFAULT 1,
          created_by TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
      `);
      // Insert default approval rule
      migrations.push(`
        INSERT INTO approval_rules (id, state, threshold_amount, requires_roles, is_active, created_by, created_at, updated_at)
        VALUES ('rule-default-all', 'ALL', 5000, '["director", "admin"]', 1, 'system', unixepoch(), unixepoch())
      `);
    }

    // Create invoice_attachments table if it doesn't exist
    const attachmentsTable = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='invoice_attachments'").all() as Array<{ name: string }>;
    if (attachmentsTable.length === 0) {
      migrations.push(`
        CREATE TABLE invoice_attachments (
          id TEXT PRIMARY KEY,
          invoice_id TEXT NOT NULL,
          file_name TEXT NOT NULL,
          file_path TEXT NOT NULL,
          file_size INTEGER,
          mime_type TEXT,
          storage_type TEXT CHECK(storage_type IN ('local', 's3', 'gcs')) DEFAULT 'local',
          uploaded_by TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
      `);
      migrations.push('CREATE INDEX IF NOT EXISTS idx_invoice_attachments_invoice ON invoice_attachments(invoice_id)');
    }

    // Migrate vendors table
    const vendorTableInfo = sqlite.prepare("PRAGMA table_info(vendors)").all() as Array<{ name: string }>;
    const vendorColumnNames = vendorTableInfo.map(col => col.name);

    if (!vendorColumnNames.includes('vendor_type')) {
      migrations.push('ALTER TABLE vendors ADD COLUMN vendor_type TEXT');
    }
    if (!vendorColumnNames.includes('requires_1099')) {
      migrations.push('ALTER TABLE vendors ADD COLUMN requires_1099 INTEGER DEFAULT 0');
    }

    // Check if pending_vendors table exists
    const pendingVendorsTable = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pending_vendors'").all() as Array<{ name: string }>;
    if (pendingVendorsTable.length === 0) {
      migrations.push(`
        CREATE TABLE pending_vendors (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          address TEXT,
          vendor_type TEXT,
          invoice_id TEXT,
          status TEXT NOT NULL CHECK(status IN ('Pending', 'Completed', 'Rejected')) DEFAULT 'Pending',
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
      `);
    }

    // Check if vendor_types table exists
    const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='vendor_types'").all() as Array<{ name: string }>;
    if (tables.length === 0) {
      migrations.push(`
        CREATE TABLE vendor_types (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          is_active INTEGER DEFAULT 1,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
      `);
      // Insert default vendor types
      const defaultTypes = [
        { id: '1', name: 'Service Provider', description: 'Companies providing services', is_active: 1 },
        { id: '2', name: 'Supplier', description: 'Companies supplying goods/materials', is_active: 1 },
        { id: '3', name: 'Contractor', description: 'Independent contractors', is_active: 1 },
        { id: '4', name: 'Consultant', description: 'Consulting services', is_active: 1 },
        { id: '5', name: 'Utility', description: 'Utility companies (electric, water, etc.)', is_active: 1 },
        { id: '6', name: 'Software/IT', description: 'Software and IT services', is_active: 1 },
        { id: '7', name: 'Professional Services', description: 'Legal, accounting, etc.', is_active: 1 },
        { id: '8', name: 'Other', description: 'Other vendor types', is_active: 1 },
      ];
      for (const type of defaultTypes) {
        migrations.push(`
          INSERT INTO vendor_types (id, name, description, is_active, created_at, updated_at)
          VALUES ('${type.id}', '${type.name}', '${type.description}', ${type.is_active}, unixepoch(), unixepoch())
        `);
      }
    }

    // Execute migrations
    if (migrations.length > 0) {
      console.log(`[DB Migration] Applying ${migrations.length} migration(s)...`);
      for (const migration of migrations) {
        try {
          sqlite.exec(migration);
          const preview = migration.length > 100 ? migration.substring(0, 100) + '...' : migration;
          console.log('[DB Migration] ✓ Applied:', preview);
        } catch (migrationError) {
          const preview = migration.length > 100 ? migration.substring(0, 100) + '...' : migration;
          console.error('[DB Migration] ✗ Failed to apply:', preview);
          console.error('[DB Migration] Error:', migrationError);
          // Don't continue if critical migration fails - throw error
          if (migration.includes('state') || migration.includes('payment_type') || migration.includes('approval_status')) {
            throw new Error(`Critical migration failed: ${migrationError}`);
          }
        }
      }
      
      // Verify critical columns were added
      const verifyTableInfo = sqlite.prepare("PRAGMA table_info(invoices)").all() as Array<{ name: string }>;
      const verifyColumnNames = verifyTableInfo.map(col => col.name);
      const criticalColumns = ['state', 'payment_type', 'approval_status'];
      const missingColumns = criticalColumns.filter(col => !verifyColumnNames.includes(col));
      
      if (missingColumns.length > 0) {
        console.error('[DB Migration] ✗ Critical columns still missing after migration:', missingColumns);
        throw new Error(`Failed to add critical columns: ${missingColumns.join(', ')}`);
      }
      
      console.log('[DB Migration] ✓ Migration complete - all columns verified');
    } else {
      console.log('[DB Migration] No migrations needed');
    }
  } catch (error) {
    console.error('[DB Migration] Error in migration process:', error);
    // Continue even if migrations fail - table might already have columns
  }
}

// Initialize schema (create tables if they don't exist)
// This is now mainly for async operations - migrations run sync in getDb()
export async function initDb() {
  await ensureDataDir();
  // Migrations are now run synchronously in getDb()
  // Just ensure the DB instance is created
  getDb();
  return getDb();
}
