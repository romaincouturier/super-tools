
-- Create mission_contacts table
CREATE TABLE public.mission_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT,
  language TEXT NOT NULL DEFAULT 'fr',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mission_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies (authenticated users only)
CREATE POLICY "Authenticated users can view mission contacts"
  ON public.mission_contacts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert mission contacts"
  ON public.mission_contacts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update mission contacts"
  ON public.mission_contacts FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete mission contacts"
  ON public.mission_contacts FOR DELETE
  TO authenticated
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_mission_contacts_updated_at
  BEFORE UPDATE ON public.mission_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
