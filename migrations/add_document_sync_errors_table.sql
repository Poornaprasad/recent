-- Migration: Add document_sync_errors table
-- This table tracks failed document syncs from SmartAdvocate with full metadata

CREATE TABLE IF NOT EXISTS document_sync_errors (
  id TEXT PRIMARY KEY,
  document_id INTEGER NOT NULL,
  case_id INTEGER,
  case_number TEXT,
  document_name TEXT,
  error TEXT NOT NULL,
  error_type TEXT NOT NULL CHECK(error_type IN ('Unsupported File Type', 'Processing Error', 'API Error', 'Other')),
  content_type TEXT,
  file_size INTEGER,
  category_id INTEGER,
  category_name TEXT,
  sub_category_name TEXT,
  description TEXT,
  comments TEXT,
  created_date TIMESTAMP,
  modified_date TIMESTAMP,
  sync_date TIMESTAMP NOT NULL DEFAULT NOW(),
  metadata TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  resolved_by TEXT,
  resolution_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on document_id for quick lookups
CREATE INDEX IF NOT EXISTS idx_document_sync_errors_document_id ON document_sync_errors(document_id);

-- Create index on case_number for filtering
CREATE INDEX IF NOT EXISTS idx_document_sync_errors_case_number ON document_sync_errors(case_number);

-- Create index on resolved status
CREATE INDEX IF NOT EXISTS idx_document_sync_errors_resolved ON document_sync_errors(resolved);

-- Create index on sync_date for sorting
CREATE INDEX IF NOT EXISTS idx_document_sync_errors_sync_date ON document_sync_errors(sync_date DESC);

-- Create index on error_type for filtering
CREATE INDEX IF NOT EXISTS idx_document_sync_errors_error_type ON document_sync_errors(error_type);

