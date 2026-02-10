-- Fix etat constraint to include "accueil_envoye" state
ALTER TABLE public.questionnaire_besoins DROP CONSTRAINT questionnaire_besoins_etat_check;

ALTER TABLE public.questionnaire_besoins ADD CONSTRAINT questionnaire_besoins_etat_check
  CHECK (etat::text = ANY (ARRAY['non_envoye', 'envoye', 'accueil_envoye', 'en_cours', 'complete', 'valide_formateur', 'expire']::text[]));

-- Fix prerequis_validation constraint - it now stores JSON objects, not simple strings
ALTER TABLE public.questionnaire_besoins DROP CONSTRAINT questionnaire_besoins_prerequis_validation_check;