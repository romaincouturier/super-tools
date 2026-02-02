-- Add funder fields to training_participants for inter-enterprise trainings
ALTER TABLE public.training_participants
ADD COLUMN financeur_same_as_sponsor boolean DEFAULT true,
ADD COLUMN financeur_name text,
ADD COLUMN financeur_url text;

-- Add comment to explain the purpose
COMMENT ON COLUMN public.training_participants.financeur_same_as_sponsor IS 'For inter-enterprise trainings: indicates if funder is same as sponsor';
COMMENT ON COLUMN public.training_participants.financeur_name IS 'For inter-enterprise trainings: funder name if different from sponsor';
COMMENT ON COLUMN public.training_participants.financeur_url IS 'For inter-enterprise trainings: funder URL if different from sponsor';