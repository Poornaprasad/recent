-- Migration: Rename disbursement_type to contact_type in case_vendor_disbursement_types table
-- This change reflects that in the vendor context, this field represents "Contact Type" rather than "Disbursement Type"

-- Rename the column from disbursement_type to contact_type
ALTER TABLE case_vendor_disbursement_types 
RENAME COLUMN disbursement_type TO contact_type;

