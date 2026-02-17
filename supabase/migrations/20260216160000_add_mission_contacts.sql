-- Mission Contacts: multiple contacts per mission with primary contact and language
-- Replaces single client_first_name/client_last_name/client_email fields on missions

-- Create mission_contacts table
CREATE TABLE IF NOT EXISTS public.mission_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT, -- e.g. "Responsable formation", "DRH", "Facturation"
  language TEXT DEFAULT 'fr',
  is_primary BOOLEAN DEFAULT false,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mission_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as mission_pages)
CREATE POLICY "Users can view their own mission contacts"
  ON public.mission_contacts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.missions m
      WHERE m.id = mission_contacts.mission_id
        AND m.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can create contacts for their missions"
  ON public.mission_contacts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.missions m
      WHERE m.id = mission_contacts.mission_id
        AND m.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update their own mission contacts"
  ON public.mission_contacts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.missions m
      WHERE m.id = mission_contacts.mission_id
        AND m.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own mission contacts"
  ON public.mission_contacts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.missions m
      WHERE m.id = mission_contacts.mission_id
        AND m.created_by = auth.uid()
    )
  );

-- Index for fast lookup by mission
CREATE INDEX idx_mission_contacts_mission_id ON public.mission_contacts(mission_id);

-- Migrate existing single-contact data into mission_contacts
-- Only migrate if the mission has at least a first_name, last_name, or email
INSERT INTO public.mission_contacts (mission_id, first_name, last_name, email, language, is_primary, position)
SELECT
  m.id,
  m.client_first_name,
  m.client_last_name,
  m.client_email,
  COALESCE(m.language, 'fr'),
  true,
  0
FROM public.missions m
WHERE m.client_first_name IS NOT NULL
   OR m.client_last_name IS NOT NULL
   OR m.client_email IS NOT NULL;

-- Also migrate billing contacts as secondary contacts where they exist
INSERT INTO public.mission_contacts (mission_id, first_name, last_name, email, role, language, is_primary, position)
SELECT
  m.id,
  m.billing_contact_name,
  NULL,
  m.billing_contact_email,
  'Facturation',
  COALESCE(m.language, 'fr'),
  false,
  1
FROM public.missions m
WHERE m.billing_contact_name IS NOT NULL
   OR m.billing_contact_email IS NOT NULL;
