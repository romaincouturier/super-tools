-- ============================================================
-- Module SuperTilt — Plan d'action simple
-- ============================================================

-- 1. Extend the app_module enum
DO $$ BEGIN
  ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'supertilt';
EXCEPTION WHEN others THEN NULL;
END $$;

-- 2. Actions table
CREATE TABLE IF NOT EXISTS public.supertilt_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assigned_to text,              -- free text (name or email)
  deadline date,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_supertilt_actions_user ON public.supertilt_actions(user_id, is_completed, created_at DESC);
CREATE INDEX idx_supertilt_actions_deadline ON public.supertilt_actions(deadline) WHERE NOT is_completed;

-- 3. RLS
ALTER TABLE public.supertilt_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supertilt_actions_select" ON public.supertilt_actions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "supertilt_actions_insert" ON public.supertilt_actions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "supertilt_actions_update" ON public.supertilt_actions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "supertilt_actions_delete" ON public.supertilt_actions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Service role for daily actions generation
CREATE POLICY "supertilt_actions_service_all" ON public.supertilt_actions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. Auto-update updated_at
CREATE OR REPLACE FUNCTION public.supertilt_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_supertilt_updated_at
  BEFORE UPDATE ON public.supertilt_actions
  FOR EACH ROW EXECUTE FUNCTION public.supertilt_updated_at();
