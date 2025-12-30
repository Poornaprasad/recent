-- ============================================================================
-- Production Schema Migration
-- ============================================================================
-- This migration defines the complete database schema for TBF ReconX.
-- It is idempotent and safe to run multiple times.
--
-- Date: 2024
-- Purpose: Complete database schema with all tables, indexes, and data migrations
--          for production deployment
--
-- IMPORTANT: This migration creates tables only. Foreign key constraints are
--            defined in 0001_add_foreign_keys.sql and should be applied after
--            this migration completes successfully.
-- ============================================================================

-- ============================================================================
-- 1. CORE TABLES
-- ============================================================================

-- Invoices table (main invoice/document storage)
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT,
  invoice_date TEXT,
  vendor_name TEXT,
  vendor_address TEXT,
  customer_name TEXT,
  total_amount REAL,
  payment_terms TEXT,
  line_items TEXT, -- JSON string
  amount REAL, -- Alternative field name for totalAmount
  client_name TEXT, -- Alternative field name for customerName
  description TEXT, -- High-level description of the invoice/receipt
  due_date TEXT, -- Payment due date
  status TEXT NOT NULL CHECK(status IN ('Paid', 'Pending', 'Review', 'Draft')) DEFAULT 'Pending',
  document_type TEXT CHECK(document_type IN ('Webhook Source', 'Invoice', 'Receipt', 'Per Diem', 'Estate', 'Other Document', 'Other', 'Office Disbursement', 'Office Reimbursement', 'Case Details', 'Reimbursement', 'Office Credit Card Bill')),
  invoice_data_uri TEXT NOT NULL,
  is_duplicate BOOLEAN DEFAULT FALSE,
  duplicate_reason TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_pattern TEXT, -- e.g., "monthly", "quarterly"
  has_amount_anomaly BOOLEAN DEFAULT FALSE,
  amount_anomaly_reason TEXT,
  expected_amount REAL, -- Expected amount based on historical average
  amount_deviation_percent REAL, -- Percentage deviation from expected
  is_high_value BOOLEAN DEFAULT FALSE,
  high_value_reason TEXT,
  requires_escalation BOOLEAN DEFAULT FALSE,
  escalation_level TEXT, -- 'standard', 'high', 'critical'
  escalation_reason TEXT, -- 'low_accuracy', 'duplicate', 'multiple_vendors', 'no_clarity'
  has_multiple_vendors BOOLEAN DEFAULT FALSE,
  accuracy_score REAL, -- 0-100 score for extraction accuracy
  requires_special_handling BOOLEAN DEFAULT FALSE,
  special_handling_reason TEXT, -- 'per_diem', 'mixed_document_types', 'other'
  comment TEXT, -- User comments/notes on the invoice
  case_number TEXT, -- SmartAdvocate case number
  plaintiff_name TEXT, -- Plaintiff name from case lookup (stored after case search)
  state TEXT CHECK(state IN ('CA', 'NY')), -- State: CA (California) or NY (New York)
  payment_type TEXT CHECK(payment_type IN ('Receipt', 'Invoice', 'Non-Financial', 'Other')), -- Payment type category
  approval_status TEXT CHECK(approval_status IN ('Pending', 'Approved', 'Rejected', 'Requires_Approval')) DEFAULT 'Pending',
  approved_by TEXT, -- User ID who approved
  approved_at TIMESTAMP, -- Timestamp of approval
  created_by TEXT, -- User ID who created/uploaded
  assigned_to TEXT, -- User ID assigned to process
  disbursement_response TEXT, -- JSON string of disbursement creation response from CRM
  crm_status TEXT CHECK(crm_status IN ('Associated', 'Draft', 'Not Found', 'Duplicate')), -- CRM status
  document_hash TEXT, -- Hash of document ID and case number for duplicate detection
  document_id INTEGER, -- SmartAdvocate document ID (for disbursement creation)
  
  -- SmartAdvocate document metadata fields
  sa_case_id INTEGER, -- SmartAdvocate case ID
  sa_document_name TEXT, -- SmartAdvocate document name
  sa_from_unique_contact_id INTEGER,
  sa_to_contact_name TEXT,
  sa_from_contact_name TEXT,
  sa_doc_type TEXT,
  sa_template_id INTEGER,
  sa_attach_flag BOOLEAN,
  sa_created_user_id INTEGER,
  sa_created_date TIMESTAMP,
  sa_modified_user_id INTEGER,
  sa_modified_date TIMESTAMP,
  sa_category_id INTEGER,
  sa_category_name TEXT,
  sa_sub_category_id INTEGER,
  sa_sub_category_name TEXT,
  sa_sub_sub_category_id INTEGER,
  sa_sub_sub_sub_category_id INTEGER,
  sa_med_prov_unique_contact_id INTEGER,
  sa_is_reviewed BOOLEAN,
  sa_to_unique_contact_id INTEGER,
  sa_document_date TIMESTAMP,
  sa_priority INTEGER,
  sa_priority_name TEXT,
  sa_document_direction INTEGER,
  sa_direction_name TEXT,
  sa_document_origin INTEGER,
  sa_origin_name TEXT,
  sa_is_shared_in_portal BOOLEAN,
  sa_is_shared_with_everyone_in_portal BOOLEAN,
  sa_case_document_id INTEGER,
  sa_delivery_method_id INTEGER,
  sa_delivery_name TEXT,
  sa_metadata TEXT, -- JSON string for additional SmartAdvocate metadata
  
  -- Extracted field metadata (JSON strings)
  invoice_number_meta TEXT, -- {confidence, reasoning, bbox}
  invoice_date_meta TEXT,
  vendor_name_meta TEXT,
  vendor_address_meta TEXT,
  customer_name_meta TEXT,
  total_amount_meta TEXT,
  payment_terms_meta TEXT,
  line_items_meta TEXT,
  document_type_meta TEXT,
  amount_meta TEXT, -- {confidence, reasoning, bbox}
  client_name_meta TEXT,
  description_meta TEXT,
  due_date_meta TEXT,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT, -- Hashed password (nullable for OAuth users)
  role TEXT NOT NULL CHECK(role IN ('admin', 'director', 'manager', 'senior_accountant', 'ny_accountant', 'ca_accountant')),
  status TEXT NOT NULL CHECK(status IN ('Active', 'Inactive', 'Invited')),
  assigned_states TEXT, -- JSON array of states for accountant roles: ["CA", "NY"]
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Vendor types table (company-wide approved types)
CREATE TABLE IF NOT EXISTS vendor_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Vendors table
CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  vendor_type TEXT, -- References vendor_types.name
  unique_contact_id TEXT, -- CRM contact ID for linking
  tax_id TEXT, -- Tax ID (SSN/EIN) - if exists, W9 is considered received
  requires_1099 BOOLEAN DEFAULT FALSE,
  requires_w9 BOOLEAN DEFAULT FALSE,
  w9_status TEXT CHECK(w9_status IN ('Not Required', 'Required', 'Received', 'Pending', 'Expired')) DEFAULT 'Not Required',
  w9_received_date TIMESTAMP,
  w9_expiry_date TIMESTAMP,
  form_1099_status TEXT CHECK(form_1099_status IN ('Not Required', 'Required', 'Received', 'Tracked', 'Pending')) DEFAULT 'Not Required',
  form_1099_received_date TIMESTAMP,
  is_paused BOOLEAN DEFAULT FALSE,
  paused_reason TEXT,
  paused_until TIMESTAMP,
  status TEXT NOT NULL CHECK(status IN ('Active', 'Inactive')) DEFAULT 'Active',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Pending vendors table (vendors detected during invoice processing, awaiting setup)
CREATE TABLE IF NOT EXISTS pending_vendors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  vendor_type TEXT,
  invoice_id TEXT, -- Reference to the invoice that detected this vendor
  status TEXT NOT NULL CHECK(status IN ('Pending', 'Completed', 'Rejected')) DEFAULT 'Pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. AUDIT & TRACKING TABLES
-- ============================================================================

-- Audit logs table - comprehensive audit trail for the system
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  user_id TEXT NOT NULL, -- Renamed from 'user' to 'user_id' for clarity
  user_name TEXT,
  user_email TEXT,
  user_role TEXT,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  category TEXT NOT NULL DEFAULT 'system',
  details TEXT, -- JSON string with action-specific details
  metadata TEXT, -- JSON string with request metadata (ip, user agent, etc.)
  severity TEXT NOT NULL CHECK(severity IN ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL')) DEFAULT 'INFO'
);

-- Enhanced audit logs for approvals and edits
CREATE TABLE IF NOT EXISTS approval_audit_logs (
  id TEXT PRIMARY KEY,
  invoice_id TEXT, -- References invoices.id (nullable for other resources)
  user_id TEXT NOT NULL, -- User who performed the action
  action TEXT NOT NULL CHECK(action IN ('Approved', 'Rejected', 'Requested Approval', 'Edited', 'Created', 'Deleted', 'Assigned', 'Unassigned')),
  resource_type TEXT NOT NULL CHECK(resource_type IN ('Invoice', 'Vendor', 'User', 'Disbursement', 'Other')),
  resource_id TEXT NOT NULL,
  previous_value TEXT, -- JSON string of previous state
  new_value TEXT, -- JSON string of new state
  changed_fields TEXT, -- JSON array of field names that changed
  reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. DISBURSEMENT & FINANCIAL TABLES
-- ============================================================================

-- Disbursement types table
CREATE TABLE IF NOT EXISTS disbursement_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Disbursement statuses table
CREATE TABLE IF NOT EXISTS disbursement_statuses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Case-vendor-contact type mappings table
-- Stores which contact type was used for a vendor in a specific case
CREATE TABLE IF NOT EXISTS case_vendor_disbursement_types (
  id TEXT PRIMARY KEY,
  case_number TEXT NOT NULL, -- SmartAdvocate case number
  vendor_name TEXT NOT NULL, -- Vendor name
  contact_type TEXT NOT NULL, -- Contact type name from API (renamed from disbursement_type)
  invoice_id TEXT, -- Optional reference to the invoice that set this mapping
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Bank accounts table
CREATE TABLE IF NOT EXISTS bank_accounts (
  id TEXT PRIMARY KEY,
  account_name TEXT NOT NULL,
  account_number TEXT,
  routing_number TEXT,
  bank_name TEXT NOT NULL,
  account_type TEXT CHECK(account_type IN ('Checking', 'Savings', 'Money Market', 'Other')),
  state TEXT CHECK(state IN ('CA', 'NY')),
  is_active BOOLEAN DEFAULT TRUE,
  last_updated_by TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Expense accounts table
CREATE TABLE IF NOT EXISTS expense_accounts (
  id TEXT PRIMARY KEY,
  account_code TEXT NOT NULL UNIQUE,
  account_name TEXT NOT NULL,
  description TEXT,
  account_type TEXT CHECK(account_type IN ('Expense', 'Asset', 'Liability', 'Revenue', 'Equity')),
  parent_account_id TEXT, -- For hierarchical accounts
  state TEXT CHECK(state IN ('CA', 'NY')),
  is_active BOOLEAN DEFAULT TRUE,
  last_updated_by TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. W9 & 1099 TRACKING TABLES
-- ============================================================================

-- W9 tracking table
CREATE TABLE IF NOT EXISTS vendor_w9_status (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL, -- References vendors.id
  is_required BOOLEAN DEFAULT FALSE,
  status TEXT CHECK(status IN ('Not Required', 'Required', 'Received', 'Pending', 'Expired')) DEFAULT 'Not Required',
  received_date TIMESTAMP,
  expiry_date TIMESTAMP,
  document_path TEXT, -- Path to stored W9 document
  threshold_amount REAL DEFAULT 600, -- Default $600 threshold
  notes TEXT,
  last_updated_by TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. APPROVAL & AUTHORIZATION TABLES
-- ============================================================================

-- Credit authorization table (for amounts above $5000)
CREATE TABLE IF NOT EXISTS credit_authorizations (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL, -- References invoices.id
  amount REAL NOT NULL,
  threshold_amount REAL DEFAULT 5000,
  requested_by TEXT NOT NULL, -- User ID
  authorized_by TEXT, -- User ID who authorized
  authorization_status TEXT CHECK(authorization_status IN ('Pending', 'Approved', 'Rejected', 'Expired')) DEFAULT 'Pending',
  authorization_date TIMESTAMP,
  expiry_date TIMESTAMP,
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Approval rules table (configurable approval thresholds)
CREATE TABLE IF NOT EXISTS approval_rules (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK(state IN ('CA', 'NY', 'ALL')) DEFAULT 'ALL',
  threshold_amount REAL NOT NULL DEFAULT 5000,
  requires_roles TEXT, -- JSON array: ["director", "admin"]
  is_active BOOLEAN DEFAULT TRUE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 6. DOCUMENT & SYNC TABLES
-- ============================================================================

-- Invoice attachments table (for file storage)
CREATE TABLE IF NOT EXISTS invoice_attachments (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL, -- References invoices.id
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Path in storage (S3, local, etc.)
  file_size INTEGER, -- Size in bytes
  mime_type TEXT,
  storage_type TEXT CHECK(storage_type IN ('local', 's3', 'gcs')) DEFAULT 'local',
  uploaded_by TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Document sync errors table (tracks failed document syncs from SmartAdvocate)
CREATE TABLE IF NOT EXISTS document_sync_errors (
  id TEXT PRIMARY KEY,
  document_id INTEGER NOT NULL, -- SmartAdvocate document ID
  case_id INTEGER,
  case_number TEXT,
  document_name TEXT,
  error TEXT NOT NULL, -- Error message
  error_type TEXT NOT NULL CHECK(error_type IN ('Unsupported File Type', 'Processing Error', 'API Error', 'Other')),
  content_type TEXT, -- MIME type of the document
  file_size INTEGER, -- Size in bytes
  category_id INTEGER,
  category_name TEXT,
  sub_category_id INTEGER,
  sub_category_name TEXT,
  sub_sub_category_id INTEGER,
  sub_sub_sub_category_id INTEGER,
  description TEXT,
  comments TEXT,
  created_date TIMESTAMP, -- Document creation date from SmartAdvocate
  modified_date TIMESTAMP, -- Document modification date from SmartAdvocate
  sync_date TIMESTAMP NOT NULL DEFAULT NOW(), -- When the sync error occurred
  
  -- SmartAdvocate metadata fields (matching invoices table)
  sa_from_unique_contact_id INTEGER,
  sa_to_contact_name TEXT,
  sa_from_contact_name TEXT,
  sa_doc_type TEXT, -- Document type (e.g., "Img", "Pdf", etc.)
  sa_template_id INTEGER,
  sa_attach_flag BOOLEAN DEFAULT FALSE,
  sa_created_user_id INTEGER,
  sa_modified_user_id INTEGER,
  sa_med_prov_unique_contact_id INTEGER,
  sa_is_reviewed BOOLEAN DEFAULT FALSE,
  sa_to_unique_contact_id INTEGER,
  sa_document_date TIMESTAMP,
  sa_priority INTEGER,
  sa_priority_name TEXT,
  sa_document_direction INTEGER,
  sa_direction_name TEXT,
  sa_document_origin INTEGER,
  sa_origin_name TEXT,
  sa_is_shared_in_portal BOOLEAN DEFAULT FALSE,
  sa_is_shared_with_everyone_in_portal BOOLEAN DEFAULT FALSE,
  sa_case_document_id INTEGER,
  sa_delivery_method_id INTEGER,
  sa_delivery_name TEXT,
  
  metadata TEXT, -- JSON string with additional metadata not in schema
  resolved BOOLEAN DEFAULT FALSE, -- Whether the error has been resolved
  resolved_at TIMESTAMP,
  resolved_by TEXT, -- User ID who resolved it
  resolution_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 7. SYSTEM & CONFIGURATION TABLES
-- ============================================================================

-- Daily run updates tracking
CREATE TABLE IF NOT EXISTS daily_run_updates (
  id TEXT PRIMARY KEY,
  run_date TIMESTAMP NOT NULL,
  update_type TEXT NOT NULL CHECK(update_type IN ('Disbursement Type', 'Disbursement Status', 'Bank Account', 'Expense Account', 'Vendor', 'Other')),
  resource_id TEXT NOT NULL,
  previous_value TEXT, -- JSON string
  new_value TEXT, -- JSON string
  updated_by TEXT, -- System or user ID
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Permission matrix table (stores role-permission mappings, editable only by Admin and Director)
CREATE TABLE IF NOT EXISTS permission_matrix (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK(role IN ('admin', 'director', 'manager', 'senior_accountant', 'ny_accountant', 'ca_accountant')),
  permission TEXT NOT NULL, -- Permission name (e.g., 'view_invoices', 'edit_invoices')
  is_granted BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by TEXT, -- User ID who created this permission mapping
  updated_by TEXT -- User ID who last updated this permission mapping
);

-- ============================================================================
-- 8. ENSURE COLUMNS EXIST (for existing databases)
-- ============================================================================
-- This section ensures all columns exist even if tables were created
-- with an older schema. Safe to run multiple times.

-- Invoices: Add any missing columns that might not exist in older schemas
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS plaintiff_name TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS document_id INTEGER;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS document_hash TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS disbursement_response TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS crm_status TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_case_id INTEGER;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_document_name TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_from_unique_contact_id INTEGER;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_to_contact_name TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_from_contact_name TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_doc_type TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_template_id INTEGER;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_attach_flag BOOLEAN;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_created_user_id INTEGER;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_created_date TIMESTAMP;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_modified_user_id INTEGER;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_modified_date TIMESTAMP;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_category_id INTEGER;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_category_name TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_sub_category_id INTEGER;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_sub_category_name TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_sub_sub_category_id INTEGER;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_sub_sub_sub_category_id INTEGER;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_med_prov_unique_contact_id INTEGER;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_is_reviewed BOOLEAN;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_to_unique_contact_id INTEGER;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_document_date TIMESTAMP;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_priority INTEGER;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_priority_name TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_document_direction INTEGER;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_direction_name TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_document_origin INTEGER;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_origin_name TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_is_shared_in_portal BOOLEAN;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_is_shared_with_everyone_in_portal BOOLEAN;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_case_document_id INTEGER;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_delivery_method_id INTEGER;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_delivery_name TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sa_metadata TEXT;

-- Vendors: Add any missing columns
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS unique_contact_id TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tax_id TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS form_1099_status TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS form_1099_received_date TIMESTAMP;

-- Audit logs: Add any missing columns
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_email TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_role TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resource_id TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata TEXT;

-- Document sync errors: Add any missing SmartAdvocate columns
ALTER TABLE document_sync_errors ADD COLUMN IF NOT EXISTS sub_category_id INTEGER;
ALTER TABLE document_sync_errors ADD COLUMN IF NOT EXISTS sub_sub_category_id INTEGER;
ALTER TABLE document_sync_errors ADD COLUMN IF NOT EXISTS sub_sub_sub_category_id INTEGER;
ALTER TABLE document_sync_errors ADD COLUMN IF NOT EXISTS sa_from_unique_contact_id INTEGER;
ALTER TABLE document_sync_errors ADD COLUMN IF NOT EXISTS sa_to_contact_name TEXT;
ALTER TABLE document_sync_errors ADD COLUMN IF NOT EXISTS sa_from_contact_name TEXT;
ALTER TABLE document_sync_errors ADD COLUMN IF NOT EXISTS sa_doc_type TEXT;
ALTER TABLE document_sync_errors ADD COLUMN IF NOT EXISTS sa_template_id INTEGER;
ALTER TABLE document_sync_errors ADD COLUMN IF NOT EXISTS sa_attach_flag BOOLEAN;
ALTER TABLE document_sync_errors ADD COLUMN IF NOT EXISTS sa_created_user_id INTEGER;
ALTER TABLE document_sync_errors ADD COLUMN IF NOT EXISTS sa_modified_user_id INTEGER;
ALTER TABLE document_sync_errors ADD COLUMN IF NOT EXISTS sa_med_prov_unique_contact_id INTEGER;
ALTER TABLE document_sync_errors ADD COLUMN IF NOT EXISTS sa_is_reviewed BOOLEAN;
ALTER TABLE document_sync_errors ADD COLUMN IF NOT EXISTS sa_to_unique_contact_id INTEGER;
ALTER TABLE document_sync_errors ADD COLUMN IF NOT EXISTS sa_document_date TIMESTAMP;
ALTER TABLE document_sync_errors ADD COLUMN IF NOT EXISTS sa_priority INTEGER;
ALTER TABLE document_sync_errors ADD COLUMN IF NOT EXISTS sa_priority_name TEXT;
ALTER TABLE document_sync_errors ADD COLUMN IF NOT EXISTS sa_document_direction INTEGER;
ALTER TABLE document_sync_errors ADD COLUMN IF NOT EXISTS sa_direction_name TEXT;
ALTER TABLE document_sync_errors ADD COLUMN IF NOT EXISTS sa_document_origin INTEGER;
ALTER TABLE document_sync_errors ADD COLUMN IF NOT EXISTS sa_origin_name TEXT;
ALTER TABLE document_sync_errors ADD COLUMN IF NOT EXISTS sa_is_shared_in_portal BOOLEAN;
ALTER TABLE document_sync_errors ADD COLUMN IF NOT EXISTS sa_is_shared_with_everyone_in_portal BOOLEAN;
ALTER TABLE document_sync_errors ADD COLUMN IF NOT EXISTS sa_case_document_id INTEGER;
ALTER TABLE document_sync_errors ADD COLUMN IF NOT EXISTS sa_delivery_method_id INTEGER;
ALTER TABLE document_sync_errors ADD COLUMN IF NOT EXISTS sa_delivery_name TEXT;

-- Case vendor disbursement types: Rename column if needed
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'case_vendor_disbursement_types' AND column_name = 'disbursement_type'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'case_vendor_disbursement_types' AND column_name = 'contact_type'
    ) THEN
        ALTER TABLE case_vendor_disbursement_types RENAME COLUMN disbursement_type TO contact_type;
    END IF;
END $$;

-- ============================================================================
-- 9. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Invoices indexes
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_case_number ON invoices(case_number);
CREATE INDEX IF NOT EXISTS idx_invoices_vendor_name ON invoices(vendor_name);
CREATE INDEX IF NOT EXISTS idx_invoices_approval_status ON invoices(approval_status);
CREATE INDEX IF NOT EXISTS idx_invoices_state ON invoices(state);
CREATE INDEX IF NOT EXISTS idx_invoices_document_type ON invoices(document_type);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_plaintiff_name ON invoices(plaintiff_name);
CREATE INDEX IF NOT EXISTS idx_invoices_document_id ON invoices(document_id);
CREATE INDEX IF NOT EXISTS idx_invoices_document_hash ON invoices(document_hash);
CREATE INDEX IF NOT EXISTS idx_invoices_sa_case_id ON invoices(sa_case_id);
CREATE INDEX IF NOT EXISTS idx_invoices_sa_doc_type ON invoices(sa_doc_type);

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Vendors indexes
CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors(name);
CREATE INDEX IF NOT EXISTS idx_vendors_unique_contact_id ON vendors(unique_contact_id);
CREATE INDEX IF NOT EXISTS idx_vendors_tax_id ON vendors(tax_id);
CREATE INDEX IF NOT EXISTS idx_vendors_w9_status ON vendors(w9_status);
CREATE INDEX IF NOT EXISTS idx_vendors_form_1099_status ON vendors(form_1099_status);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors(status);

-- Pending vendors indexes
CREATE INDEX IF NOT EXISTS idx_pending_vendors_status ON pending_vendors(status);
CREATE INDEX IF NOT EXISTS idx_pending_vendors_invoice_id ON pending_vendors(invoice_id);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);

-- Approval audit logs indexes
CREATE INDEX IF NOT EXISTS idx_approval_audit_logs_invoice_id ON approval_audit_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_approval_audit_logs_user_id ON approval_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_approval_audit_logs_resource ON approval_audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_approval_audit_logs_timestamp ON approval_audit_logs(timestamp DESC);

-- Document sync errors indexes
CREATE INDEX IF NOT EXISTS idx_document_sync_errors_document_id ON document_sync_errors(document_id);
CREATE INDEX IF NOT EXISTS idx_document_sync_errors_case_number ON document_sync_errors(case_number);
CREATE INDEX IF NOT EXISTS idx_document_sync_errors_resolved ON document_sync_errors(resolved);
CREATE INDEX IF NOT EXISTS idx_document_sync_errors_sync_date ON document_sync_errors(sync_date DESC);
CREATE INDEX IF NOT EXISTS idx_document_sync_errors_error_type ON document_sync_errors(error_type);
CREATE INDEX IF NOT EXISTS idx_document_sync_errors_sa_doc_type ON document_sync_errors(sa_doc_type);

-- Case vendor disbursement types indexes
CREATE INDEX IF NOT EXISTS idx_case_vendor_disbursement_types_case_number ON case_vendor_disbursement_types(case_number);
CREATE INDEX IF NOT EXISTS idx_case_vendor_disbursement_types_vendor_name ON case_vendor_disbursement_types(vendor_name);

-- Vendor W9 status indexes
CREATE INDEX IF NOT EXISTS idx_vendor_w9_status_vendor_id ON vendor_w9_status(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_w9_status_status ON vendor_w9_status(status);

-- Credit authorizations indexes
CREATE INDEX IF NOT EXISTS idx_credit_authorizations_invoice_id ON credit_authorizations(invoice_id);
CREATE INDEX IF NOT EXISTS idx_credit_authorizations_status ON credit_authorizations(authorization_status);

-- Invoice attachments indexes
CREATE INDEX IF NOT EXISTS idx_invoice_attachments_invoice_id ON invoice_attachments(invoice_id);

-- Permission matrix indexes
CREATE INDEX IF NOT EXISTS idx_permission_matrix_role ON permission_matrix(role);
CREATE INDEX IF NOT EXISTS idx_permission_matrix_permission ON permission_matrix(permission);

-- ============================================================================
-- 10. DATA MIGRATIONS & UPDATES
-- ============================================================================

-- Migrate audit_logs 'user' column to 'user_id' if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'audit_logs' AND column_name = 'user'
    ) THEN
        UPDATE audit_logs SET user_id = "user" WHERE user_id IS NULL;
    END IF;
END $$;

-- Update existing vendors: if tax_id exists, set w9_status to 'Received'
UPDATE vendors 
SET w9_status = 'Received', 
    w9_received_date = COALESCE(w9_received_date, CURRENT_TIMESTAMP)
WHERE tax_id IS NOT NULL 
  AND tax_id != '' 
  AND w9_status != 'Received';

-- Update existing vendors that require 1099 to have 'Required' status
UPDATE vendors 
SET form_1099_status = 'Required' 
WHERE requires_1099 = true 
AND (form_1099_status IS NULL OR form_1099_status = 'Not Required');

-- ============================================================================
-- 11. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE invoices IS 'Main invoice/document storage table with SmartAdvocate integration';
COMMENT ON COLUMN invoices.plaintiff_name IS 'Plaintiff name from SmartAdvocate case lookup (stored after case search, formatted as First Last)';
COMMENT ON COLUMN invoices.document_id IS 'SmartAdvocate document ID (for disbursement creation)';
COMMENT ON COLUMN invoices.document_hash IS 'SHA-256 hash of SmartAdvocate document ID and case number for duplicate detection';
COMMENT ON COLUMN invoices.disbursement_response IS 'JSON string of disbursement creation response from CRM';
COMMENT ON COLUMN invoices.crm_status IS 'CRM status: Associated (found in CRM), Draft (draft in CRM), Not Found (not in CRM), or Duplicate (duplicate found, should not be uploaded to CRM)';
COMMENT ON COLUMN invoices.sa_case_id IS 'SmartAdvocate case ID';
COMMENT ON COLUMN invoices.sa_document_name IS 'SmartAdvocate document name';
COMMENT ON COLUMN invoices.sa_metadata IS 'Additional SmartAdvocate metadata stored as JSON';

COMMENT ON TABLE document_sync_errors IS 'Tracks failed document syncs from SmartAdvocate with full metadata';
COMMENT ON TABLE case_vendor_disbursement_types IS 'Stores which contact type was used for a vendor in a specific case';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
--
-- NOTE: Foreign key constraints are defined in a separate migration file
-- (0001_add_foreign_keys.sql) to allow for:
-- 1. Flexible application order (can apply schema first, then constraints)
-- 2. Easier troubleshooting if constraint issues arise
-- 3. Clear separation of concerns (schema structure vs. relationships)
--
-- Foreign keys should be applied after this migration completes successfully.
-- ============================================================================

