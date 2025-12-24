-- Add plaintiff_name column to invoices table
-- This column stores the plaintiff name from case lookup (searched from case number)

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS plaintiff_name TEXT;

-- Create index on plaintiff_name for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoices_plaintiff_name ON invoices(plaintiff_name);

-- Add comment to the column
COMMENT ON COLUMN invoices.plaintiff_name IS 'Plaintiff name from SmartAdvocate case lookup (stored after case search, formatted as First Last)';

