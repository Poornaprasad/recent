-- Migration: Add SmartAdvocate document metadata fields to invoices table
-- This migration adds all fields from the SmartAdvocate API document response

-- Add SmartAdvocate metadata fields
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS sa_case_id INTEGER,
  ADD COLUMN IF NOT EXISTS sa_document_name TEXT,
  ADD COLUMN IF NOT EXISTS sa_from_unique_contact_id INTEGER,
  ADD COLUMN IF NOT EXISTS sa_to_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS sa_from_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS sa_doc_type TEXT,
  ADD COLUMN IF NOT EXISTS sa_template_id INTEGER,
  ADD COLUMN IF NOT EXISTS sa_attach_flag BOOLEAN,
  ADD COLUMN IF NOT EXISTS sa_created_user_id INTEGER,
  ADD COLUMN IF NOT EXISTS sa_created_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS sa_modified_user_id INTEGER,
  ADD COLUMN IF NOT EXISTS sa_modified_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS sa_category_id INTEGER,
  ADD COLUMN IF NOT EXISTS sa_category_name TEXT,
  ADD COLUMN IF NOT EXISTS sa_sub_category_id INTEGER,
  ADD COLUMN IF NOT EXISTS sa_sub_category_name TEXT,
  ADD COLUMN IF NOT EXISTS sa_sub_sub_category_id INTEGER,
  ADD COLUMN IF NOT EXISTS sa_sub_sub_sub_category_id INTEGER,
  ADD COLUMN IF NOT EXISTS sa_med_prov_unique_contact_id INTEGER,
  ADD COLUMN IF NOT EXISTS sa_is_reviewed BOOLEAN,
  ADD COLUMN IF NOT EXISTS sa_to_unique_contact_id INTEGER,
  ADD COLUMN IF NOT EXISTS sa_document_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS sa_priority INTEGER,
  ADD COLUMN IF NOT EXISTS sa_priority_name TEXT,
  ADD COLUMN IF NOT EXISTS sa_document_direction INTEGER,
  ADD COLUMN IF NOT EXISTS sa_direction_name TEXT,
  ADD COLUMN IF NOT EXISTS sa_document_origin INTEGER,
  ADD COLUMN IF NOT EXISTS sa_origin_name TEXT,
  ADD COLUMN IF NOT EXISTS sa_is_shared_in_portal BOOLEAN,
  ADD COLUMN IF NOT EXISTS sa_is_shared_with_everyone_in_portal BOOLEAN,
  ADD COLUMN IF NOT EXISTS sa_case_document_id INTEGER,
  ADD COLUMN IF NOT EXISTS sa_delivery_method_id INTEGER,
  ADD COLUMN IF NOT EXISTS sa_delivery_name TEXT,
  ADD COLUMN IF NOT EXISTS sa_metadata JSONB; -- Store any additional fields as JSON

-- Add comments for documentation
COMMENT ON COLUMN invoices.sa_case_id IS 'SmartAdvocate case ID';
COMMENT ON COLUMN invoices.sa_document_name IS 'SmartAdvocate document name';
COMMENT ON COLUMN invoices.sa_metadata IS 'Additional SmartAdvocate metadata stored as JSON';

