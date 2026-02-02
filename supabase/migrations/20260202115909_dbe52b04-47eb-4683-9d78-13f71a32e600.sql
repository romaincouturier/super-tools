-- Drop the old check constraint
ALTER TABLE public.training_participants DROP CONSTRAINT IF EXISTS training_participants_needs_survey_status_check;

-- Add updated check constraint with all valid status values
ALTER TABLE public.training_participants ADD CONSTRAINT training_participants_needs_survey_status_check 
CHECK (needs_survey_status = ANY (ARRAY['non_envoye'::text, 'envoye'::text, 'en_cours'::text, 'complete'::text, 'valide_formateur'::text, 'expire'::text, 'manuel'::text, 'accueil_envoye'::text, 'programme'::text]));