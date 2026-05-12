ALTER TABLE public.supertilt_actions ADD COLUMN IF NOT EXISTS mission_id uuid REFERENCES public.missions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_supertilt_actions_mission_id ON public.supertilt_actions(mission_id);
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_missions_archived ON public.missions(archived) WHERE archived = false;