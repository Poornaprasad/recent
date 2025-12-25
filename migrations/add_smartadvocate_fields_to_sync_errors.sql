-- Migration: Add SmartAdvocate metadata fields to document_sync_errors table
-- This ensures all SmartAdvocate document fields are stored when errors occur

-- Add new SmartAdvocate metadata columns
ALTER TABLE document_sync_errors
  ADD COLUMN IF NOT EXISTS sub_category_id INTEGER,
  ADD COLUMN IF NOT EXISTS sub_sub_category_id INTEGER,
  ADD COLUMN IF NOT EXISTS sub_sub_sub_category_id INTEGER,
  ADD COLUMN IF NOT EXISTS sa_from_unique_contact_id INTEGER,
  ADD COLUMN IF NOT EXISTS sa_to_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS sa_from_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS sa_doc_type TEXT,
  ADD COLUMN IF NOT EXISTS sa_template_id INTEGER,
  ADD COLUMN IF NOT EXISTS sa_attach_flag BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sa_created_user_id INTEGER,
  ADD COLUMN IF NOT EXISTS sa_modified_user_id INTEGER,
  ADD COLUMN IF NOT EXISTS sa_med_prov_unique_contact_id INTEGER,
  ADD COLUMN IF NOT EXISTS sa_is_reviewed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sa_to_unique_contact_id INTEGER,
  ADD COLUMN IF NOT EXISTS sa_document_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS sa_priority INTEGER,
  ADD COLUMN IF NOT EXISTS sa_priority_name TEXT,
  ADD COLUMN IF NOT EXISTS sa_document_direction INTEGER,
  ADD COLUMN IF NOT EXISTS sa_direction_name TEXT,
  ADD COLUMN IF NOT EXISTS sa_document_origin INTEGER,
  ADD COLUMN IF NOT EXISTS sa_origin_name TEXT,
  ADD COLUMN IF NOT EXISTS sa_is_shared_in_portal BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sa_is_shared_with_everyone_in_portal BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sa_case_document_id INTEGER,
  ADD COLUMN IF NOT EXISTS sa_delivery_method_id INTEGER,
  ADD COLUMN IF NOT EXISTS sa_delivery_name TEXT;

-- Create index on sa_doc_type for filtering
CREATE INDEX IF NOT EXISTS idx_document_sync_errors_sa_doc_type ON document_sync_errors(sa_doc_type);

