ALTER TABLE public.training_participants
  ADD COLUMN IF NOT EXISTS repositioned_to_training_id uuid REFERENCES public.trainings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS repositioned_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_training_participants_repositioned_to
  ON public.training_participants(repositioned_to_training_id)
  WHERE repositioned_to_training_id IS NOT NULL;