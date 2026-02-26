
-- Create mission_actions table for standalone actions (not activities)
CREATE TABLE public.mission_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mission_actions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view mission actions"
  ON public.mission_actions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert mission actions"
  ON public.mission_actions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update mission actions"
  ON public.mission_actions FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete mission actions"
  ON public.mission_actions FOR DELETE
  USING (auth.role() = 'authenticated');

-- Public read for summary page (no auth)
CREATE POLICY "Public can view mission actions"
  ON public.mission_actions FOR SELECT
  USING (true);
