-- La table training_evaluations avait été créée directement en base (hors
-- migration), l'historique n'était donc pas rejouable : `supabase db start`
-- échouait ici sur "relation public.training_evaluations does not exist", et
-- avec lui le job CI des tests RLS. On la crée ici, juste avant sa première
-- utilisation. IF NOT EXISTS : sans effet sur les bases où elle existe déjà.
-- Les colonnes ajoutées par les migrations suivantes (certificate_url,
-- woocommerce_product_id, learndash_course_id) sont volontairement absentes.
CREATE TABLE IF NOT EXISTS public.training_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.training_participants(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  etat VARCHAR(50) NOT NULL DEFAULT 'non_envoye',

  -- Identification
  email VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  company VARCHAR(150),

  -- Appréciation de la formation
  appreciation_generale INT,
  formation_adaptee_public BOOLEAN,
  qualification_intervenant_adequate BOOLEAN,
  conditions_info_satisfaisantes BOOLEAN,
  equilibre_theorie_pratique TEXT,
  rythme TEXT,
  appreciations_prises_en_compte TEXT,
  amelioration_suggeree TEXT,
  remarques_libres TEXT,

  -- Suites données
  objectifs_evaluation JSONB,
  objectif_prioritaire TEXT,
  delai_application TEXT,
  freins_application TEXT,

  -- Recommandation
  recommandation TEXT,
  message_recommandation TEXT,
  consent_publication BOOLEAN,

  -- Suivi d'envoi
  date_envoi TIMESTAMP WITH TIME ZONE,
  date_premiere_ouverture TIMESTAMP WITH TIME ZONE,
  date_soumission TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.training_evaluations ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to delete evaluations
DROP POLICY IF EXISTS "Authenticated users can delete evaluations" ON public.training_evaluations;
CREATE POLICY "Authenticated users can delete evaluations"
ON public.training_evaluations
FOR DELETE
USING (true);
