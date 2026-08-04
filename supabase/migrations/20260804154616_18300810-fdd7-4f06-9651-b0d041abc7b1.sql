ALTER TABLE public.trainings
  ADD COLUMN IF NOT EXISTS admin_contact_same_as_sponsor boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS admin_contact_first_name text,
  ADD COLUMN IF NOT EXISTS admin_contact_last_name text,
  ADD COLUMN IF NOT EXISTS admin_contact_email text,
  ADD COLUMN IF NOT EXISTS admin_contact_phone text;