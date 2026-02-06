-- Split client_contact into structured fields and add billing contact
ALTER TABLE missions ADD COLUMN IF NOT EXISTS client_first_name text;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS client_last_name text;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS client_email text;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS billing_contact_name text;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS billing_contact_email text;

-- Migrate existing client_contact data to client_email (best guess - it was a free text field)
UPDATE missions SET client_email = client_contact WHERE client_contact IS NOT NULL AND client_contact != '';
