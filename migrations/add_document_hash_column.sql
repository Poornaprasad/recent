-- Add document_hash column to invoices table for duplicate detection
-- This column stores a hash of document ID and case number to prevent duplicate documents from SmartAdvocate sync

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS document_hash TEXT;

-- Create index on document_hash for faster duplicate lookups
CREATE INDEX IF NOT EXISTS idx_invoices_document_hash ON invoices(document_hash);

-- Add comment to the column
COMMENT ON COLUMN invoices.document_hash IS 'SHA-256 hash of SmartAdvocate document ID and case number for duplicate detection';

