
CREATE TABLE public.supertilt_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to TEXT,
  deadline DATE,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.supertilt_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own supertilt actions"
  ON public.supertilt_actions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own supertilt actions"
  ON public.supertilt_actions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own supertilt actions"
  ON public.supertilt_actions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own supertilt actions"
  ON public.supertilt_actions FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_supertilt_actions_user_id ON public.supertilt_actions (user_id);
