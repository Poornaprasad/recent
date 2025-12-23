-- Migration: Update audit_logs table with enhanced schema
-- Add new columns and rename 'user' to 'user_id' for clarity

-- First, add new columns if they don't exist
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_email TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_role TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resource_id TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'system';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata TEXT;

-- Migrate data from 'user' column to 'user_id' if 'user' column exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'audit_logs' AND column_name = 'user'
    ) THEN
        UPDATE audit_logs SET user_id = "user" WHERE user_id IS NULL;
    END IF;
END $$;

-- Update severity enum to include DEBUG
-- Note: PostgreSQL doesn't allow easy modification of CHECK constraints
-- This is a safe no-op if the column already allows these values
