ALTER TABLE public.quotes 
  ADD COLUMN IF NOT EXISTS travel_data jsonb DEFAULT null,
  ADD COLUMN IF NOT EXISTS workflow_step integer DEFAULT 0;