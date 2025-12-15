-- Migration: Add form_1099_status and form_1099_received_date columns to vendors table
-- Run this migration to add the new 1099 form tracking columns

-- Add form_1099_status column
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS form_1099_status TEXT 
CHECK (form_1099_status IN ('Not Required', 'Required', 'Received', 'Tracked', 'Pending')) 
DEFAULT 'Not Required';

-- Add form_1099_received_date column
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS form_1099_received_date TIMESTAMP;

-- Update existing vendors that require 1099 to have 'Required' status
UPDATE vendors 
SET form_1099_status = 'Required' 
WHERE requires_1099 = true 
AND (form_1099_status IS NULL OR form_1099_status = 'Not Required');

