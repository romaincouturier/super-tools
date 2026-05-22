-- Add is_special_section to lms_modules.
-- Modules with this flag are displayed with distinct styling (e.g. "Lives & Replays")
-- and are excluded from module numbering and progression calculations.
ALTER TABLE lms_modules ADD COLUMN IF NOT EXISTS is_special_section BOOLEAN NOT NULL DEFAULT FALSE;
