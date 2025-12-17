-- Migration: Add tax_id column to vendors table
-- Run this migration to add the Tax ID field for vendors

-- Add tax_id column
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS tax_id TEXT;

-- Create index for faster lookups by tax_id
CREATE INDEX IF NOT EXISTS idx_vendors_tax_id ON vendors(tax_id);

-- Update existing vendors: if tax_id exists, set w9_status to 'Received'
UPDATE vendors 
SET w9_status = 'Received', 
    w9_received_date = COALESCE(w9_received_date, CURRENT_TIMESTAMP)
WHERE tax_id IS NOT NULL 
  AND tax_id != '' 
  AND w9_status != 'Received';

