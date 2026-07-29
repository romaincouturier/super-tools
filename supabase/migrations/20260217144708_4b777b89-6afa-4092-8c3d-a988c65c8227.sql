-- Enable RLS on failed_emails table
ALTER TABLE public.failed_emails ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can view failed emails
DO $do$ BEGIN
  CREATE POLICY "Authenticated users can view failed emails"
  ON public.failed_emails FOR SELECT TO authenticated
  USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- Only authenticated users can insert failed emails
DO $do$ BEGIN
  CREATE POLICY "Authenticated users can insert failed emails"
  ON public.failed_emails FOR INSERT TO authenticated
  WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- Only authenticated users can update failed emails
DO $do$ BEGIN
  CREATE POLICY "Authenticated users can update failed emails"
  ON public.failed_emails FOR UPDATE TO authenticated
  USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- Only authenticated users can delete failed emails
DO $do$ BEGIN
  CREATE POLICY "Authenticated users can delete failed emails"
  ON public.failed_emails FOR DELETE TO authenticated
  USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;