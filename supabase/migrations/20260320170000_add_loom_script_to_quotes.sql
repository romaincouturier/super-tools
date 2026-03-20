-- Add loom_script column to persist the generated script outline
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS loom_script text;
