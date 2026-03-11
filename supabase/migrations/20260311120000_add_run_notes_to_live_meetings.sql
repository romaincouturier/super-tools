-- Add run_notes column to training_live_meetings for post-live session notes
ALTER TABLE public.training_live_meetings
  ADD COLUMN IF NOT EXISTS run_notes TEXT;
