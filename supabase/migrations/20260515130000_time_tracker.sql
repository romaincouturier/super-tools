-- Time tracker module for SuperTools development time valorization

-- Add 'time_tracker' to app_module enum
DO $$ BEGIN
  ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'time_tracker';
EXCEPTION WHEN others THEN NULL;
END $$;

-- Time entries: each manual or imported entry
CREATE TABLE IF NOT EXISTS public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  description TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'github_import')),
  github_pr_number INTEGER,
  github_pr_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON public.time_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_time_entries_source ON public.time_entries(source);

-- RLS
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_entries_select" ON public.time_entries
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "time_entries_insert" ON public.time_entries
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "time_entries_update" ON public.time_entries
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "time_entries_delete" ON public.time_entries
  FOR DELETE TO authenticated USING (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_time_entries_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER time_entries_updated_at
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_time_entries_updated_at();

-- GitHub token setting (for retroactive import)
INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES ('github_personal_token', '', 'Token GitHub personnel pour l''import rétroactif des PRs (repo romaincouturier/super-tools)')
ON CONFLICT (setting_key) DO NOTHING;
