-- ============================================================================
-- Add Foreign Key Constraints for Enterprise-Grade Database Integrity
-- ============================================================================
-- This migration adds proper foreign key constraints to ensure referential
-- integrity and data consistency across all tables.
--
-- Date: 2024
-- Purpose: Add enterprise-grade foreign key constraints to all relationships
--
-- PREREQUISITE: This migration must be run AFTER 0000_production_schema.sql
--               as it requires all tables to exist before adding constraints.
-- ============================================================================

-- ============================================================================
-- 1. FOREIGN KEYS FOR INVOICES
-- ============================================================================

-- pending_vendors.invoice_id -> invoices.id
ALTER TABLE pending_vendors
  ADD CONSTRAINT fk_pending_vendors_invoice_id 
  FOREIGN KEY (invoice_id) 
  REFERENCES invoices(id) 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

-- approval_audit_logs.invoice_id -> invoices.id
ALTER TABLE approval_audit_logs
  ADD CONSTRAINT fk_approval_audit_logs_invoice_id 
  FOREIGN KEY (invoice_id) 
  REFERENCES invoices(id) 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

-- credit_authorizations.invoice_id -> invoices.id
ALTER TABLE credit_authorizations
  ADD CONSTRAINT fk_credit_authorizations_invoice_id 
  FOREIGN KEY (invoice_id) 
  REFERENCES invoices(id) 
  ON DELETE CASCADE 
  ON UPDATE CASCADE;

-- invoice_attachments.invoice_id -> invoices.id
ALTER TABLE invoice_attachments
  ADD CONSTRAINT fk_invoice_attachments_invoice_id 
  FOREIGN KEY (invoice_id) 
  REFERENCES invoices(id) 
  ON DELETE CASCADE 
  ON UPDATE CASCADE;

-- case_vendor_disbursement_types.invoice_id -> invoices.id
ALTER TABLE case_vendor_disbursement_types
  ADD CONSTRAINT fk_case_vendor_disbursement_types_invoice_id 
  FOREIGN KEY (invoice_id) 
  REFERENCES invoices(id) 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

-- ============================================================================
-- 2. FOREIGN KEYS FOR USERS
-- ============================================================================

-- audit_logs.user_id -> users.id
ALTER TABLE audit_logs
  ADD CONSTRAINT fk_audit_logs_user_id 
  FOREIGN KEY (user_id) 
  REFERENCES users(id) 
  ON DELETE RESTRICT 
  ON UPDATE CASCADE;

-- approval_audit_logs.user_id -> users.id
ALTER TABLE approval_audit_logs
  ADD CONSTRAINT fk_approval_audit_logs_user_id 
  FOREIGN KEY (user_id) 
  REFERENCES users(id) 
  ON DELETE RESTRICT 
  ON UPDATE CASCADE;

-- invoices.approved_by -> users.id
ALTER TABLE invoices
  ADD CONSTRAINT fk_invoices_approved_by 
  FOREIGN KEY (approved_by) 
  REFERENCES users(id) 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

-- invoices.created_by -> users.id
ALTER TABLE invoices
  ADD CONSTRAINT fk_invoices_created_by 
  FOREIGN KEY (created_by) 
  REFERENCES users(id) 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

-- invoices.assigned_to -> users.id
ALTER TABLE invoices
  ADD CONSTRAINT fk_invoices_assigned_to 
  FOREIGN KEY (assigned_to) 
  REFERENCES users(id) 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

-- credit_authorizations.requested_by -> users.id
ALTER TABLE credit_authorizations
  ADD CONSTRAINT fk_credit_authorizations_requested_by 
  FOREIGN KEY (requested_by) 
  REFERENCES users(id) 
  ON DELETE RESTRICT 
  ON UPDATE CASCADE;

-- credit_authorizations.authorized_by -> users.id
ALTER TABLE credit_authorizations
  ADD CONSTRAINT fk_credit_authorizations_authorized_by 
  FOREIGN KEY (authorized_by) 
  REFERENCES users(id) 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

-- invoice_attachments.uploaded_by -> users.id
ALTER TABLE invoice_attachments
  ADD CONSTRAINT fk_invoice_attachments_uploaded_by 
  FOREIGN KEY (uploaded_by) 
  REFERENCES users(id) 
  ON DELETE RESTRICT 
  ON UPDATE CASCADE;

-- approval_rules.created_by -> users.id
ALTER TABLE approval_rules
  ADD CONSTRAINT fk_approval_rules_created_by 
  FOREIGN KEY (created_by) 
  REFERENCES users(id) 
  ON DELETE RESTRICT 
  ON UPDATE CASCADE;

-- permission_matrix.created_by -> users.id
ALTER TABLE permission_matrix
  ADD CONSTRAINT fk_permission_matrix_created_by 
  FOREIGN KEY (created_by) 
  REFERENCES users(id) 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

-- permission_matrix.updated_by -> users.id
ALTER TABLE permission_matrix
  ADD CONSTRAINT fk_permission_matrix_updated_by 
  FOREIGN KEY (updated_by) 
  REFERENCES users(id) 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

-- vendor_w9_status.last_updated_by -> users.id
ALTER TABLE vendor_w9_status
  ADD CONSTRAINT fk_vendor_w9_status_last_updated_by 
  FOREIGN KEY (last_updated_by) 
  REFERENCES users(id) 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

-- bank_accounts.last_updated_by -> users.id
ALTER TABLE bank_accounts
  ADD CONSTRAINT fk_bank_accounts_last_updated_by 
  FOREIGN KEY (last_updated_by) 
  REFERENCES users(id) 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

-- expense_accounts.last_updated_by -> users.id
ALTER TABLE expense_accounts
  ADD CONSTRAINT fk_expense_accounts_last_updated_by 
  FOREIGN KEY (last_updated_by) 
  REFERENCES users(id) 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

-- document_sync_errors.resolved_by -> users.id
ALTER TABLE document_sync_errors
  ADD CONSTRAINT fk_document_sync_errors_resolved_by 
  FOREIGN KEY (resolved_by) 
  REFERENCES users(id) 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

-- ============================================================================
-- 3. FOREIGN KEYS FOR VENDORS
-- ============================================================================

-- vendors.vendor_type -> vendor_types.name
ALTER TABLE vendors
  ADD CONSTRAINT fk_vendors_vendor_type 
  FOREIGN KEY (vendor_type) 
  REFERENCES vendor_types(name) 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

-- vendor_w9_status.vendor_id -> vendors.id
ALTER TABLE vendor_w9_status
  ADD CONSTRAINT fk_vendor_w9_status_vendor_id 
  FOREIGN KEY (vendor_id) 
  REFERENCES vendors(id) 
  ON DELETE CASCADE 
  ON UPDATE CASCADE;

-- ============================================================================
-- 4. SELF-REFERENCING FOREIGN KEYS
-- ============================================================================

-- expense_accounts.parent_account_id -> expense_accounts.id (hierarchical accounts)
ALTER TABLE expense_accounts
  ADD CONSTRAINT fk_expense_accounts_parent_account_id 
  FOREIGN KEY (parent_account_id) 
  REFERENCES expense_accounts(id) 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

-- ============================================================================
-- 5. ADDITIONAL INDEXES ON FOREIGN KEYS FOR PERFORMANCE
-- ============================================================================
-- Note: Some indexes may already exist, but we ensure all FK columns are indexed

-- These indexes are likely already created, but we ensure they exist
CREATE INDEX IF NOT EXISTS idx_pending_vendors_invoice_id_fk ON pending_vendors(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_approval_audit_logs_invoice_id_fk ON approval_audit_logs(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_approval_audit_logs_user_id_fk ON approval_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id_fk ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_approved_by_fk ON invoices(approved_by) WHERE approved_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_created_by_fk ON invoices(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_assigned_to_fk ON invoices(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendor_w9_status_vendor_id_fk ON vendor_w9_status(vendor_id);
CREATE INDEX IF NOT EXISTS idx_expense_accounts_parent_account_id_fk ON expense_accounts(parent_account_id) WHERE parent_account_id IS NOT NULL;

-- ============================================================================
-- 6. ADD UNIQUE CONSTRAINTS WHERE NEEDED
-- ============================================================================

-- Ensure document_hash is unique for duplicate detection
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_document_hash_unique ON invoices(document_hash) WHERE document_hash IS NOT NULL;

-- Ensure case_number + vendor_name + contact_type combination is unique in case_vendor_disbursement_types
CREATE UNIQUE INDEX IF NOT EXISTS idx_case_vendor_disbursement_types_unique 
  ON case_vendor_disbursement_types(case_number, vendor_name, contact_type);

-- ============================================================================
-- 7. ADD CHECK CONSTRAINTS FOR DATA VALIDATION
-- ============================================================================

-- Ensure amounts are non-negative
ALTER TABLE invoices
  ADD CONSTRAINT chk_invoices_total_amount_non_negative 
  CHECK (total_amount IS NULL OR total_amount >= 0);

ALTER TABLE invoices
  ADD CONSTRAINT chk_invoices_amount_non_negative 
  CHECK (amount IS NULL OR amount >= 0);

ALTER TABLE credit_authorizations
  ADD CONSTRAINT chk_credit_authorizations_amount_positive 
  CHECK (amount > 0);

ALTER TABLE credit_authorizations
  ADD CONSTRAINT chk_credit_authorizations_threshold_positive 
  CHECK (threshold_amount > 0);

ALTER TABLE vendor_w9_status
  ADD CONSTRAINT chk_vendor_w9_status_threshold_non_negative 
  CHECK (threshold_amount >= 0);

-- Ensure email format is valid (basic check)
ALTER TABLE users
  ADD CONSTRAINT chk_users_email_format 
  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

ALTER TABLE vendors
  ADD CONSTRAINT chk_vendors_email_format 
  CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Ensure timestamps are logical
ALTER TABLE invoices
  ADD CONSTRAINT chk_invoices_approved_at_after_created_at 
  CHECK (approved_at IS NULL OR approved_at >= created_at);

ALTER TABLE credit_authorizations
  ADD CONSTRAINT chk_credit_authorizations_expiry_after_authorization 
  CHECK (expiry_date IS NULL OR authorization_date IS NULL OR expiry_date >= authorization_date);

ALTER TABLE vendor_w9_status
  ADD CONSTRAINT chk_vendor_w9_status_expiry_after_received 
  CHECK (expiry_date IS NULL OR received_date IS NULL OR expiry_date >= received_date);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS COMPLETE
-- ============================================================================

