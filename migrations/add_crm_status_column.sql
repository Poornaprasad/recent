-- Migration: Add crm_status column to invoices table
-- This column tracks the CRM status of invoices: Associated, Draft, Not Found, or Duplicate
-- Duplicate status is set when duplicates are found via "Check Case for Duplicates"

ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS crm_status TEXT CHECK (crm_status IN ('Associated', 'Draft', 'Not Found', 'Duplicate'));

-- Add comment to explain the column
COMMENT ON COLUMN invoices.crm_status IS 'CRM status: Associated (found in CRM), Draft (draft in CRM), Not Found (not in CRM), or Duplicate (duplicate found, should not be uploaded to CRM)';

