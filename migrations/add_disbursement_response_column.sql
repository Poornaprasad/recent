-- Migration: Add disbursement_response column to invoices table
-- Run this migration to add the new disbursement response tracking column
-- This column stores the JSON response from the CRM after a disbursement is created

-- Add disbursement_response column
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS disbursement_response TEXT;

-- Add comment to document the column
COMMENT ON COLUMN invoices.disbursement_response IS 'JSON string of disbursement creation response from CRM';

