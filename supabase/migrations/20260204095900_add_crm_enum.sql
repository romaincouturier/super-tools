-- Add 'crm' to app_module enum
-- This must be in a separate migration because new enum values
-- cannot be used in the same transaction they are created
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'crm';
