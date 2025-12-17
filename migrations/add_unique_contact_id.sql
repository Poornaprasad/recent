-- Migration: Add unique_contact_id column to vendors table
-- Run this migration to add the CRM contact ID field for linking vendors to CRM

-- Add unique_contact_id column
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS unique_contact_id TEXT;

-- Create index for faster lookups by uniqueContactId
CREATE INDEX IF NOT EXISTS idx_vendors_unique_contact_id ON vendors(unique_contact_id);

