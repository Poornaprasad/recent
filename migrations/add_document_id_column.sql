-- Add document_id column to invoices table
-- This column stores the SmartAdvocate document ID for disbursement creation

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS document_id INTEGER;

-- Create index on document_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoices_document_id ON invoices(document_id);

-- Add comment to the column
COMMENT ON COLUMN invoices.document_id IS 'SmartAdvocate document ID (for disbursement creation)';

