-- Create the sponsor_cold_evaluations table for cold evaluations sent to sponsors/commanditaires
CREATE TABLE public.sponsor_cold_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES public.training_participants(id) ON DELETE SET NULL,
  token TEXT NOT NULL UNIQUE,
  etat TEXT NOT NULL DEFAULT 'envoye',

  -- Sponsor info
  sponsor_email TEXT,
  sponsor_name TEXT,
  company TEXT,

  -- Section 1: Satisfaction globale
  satisfaction_globale INTEGER CHECK (satisfaction_globale BETWEEN 1 AND 5),
  attentes_satisfaites TEXT CHECK (attentes_satisfaites IN ('oui', 'partiellement', 'non')),

  -- Section 2: Impact et résultats
  objectifs_atteints TEXT CHECK (objectifs_atteints IN ('oui', 'partiellement', 'non')),
  impact_competences TEXT CHECK (impact_competences IN ('oui', 'partiellement', 'non', 'trop_tot')),
  description_impact TEXT,

  -- Section 3: Organisation et communication
  organisation_satisfaisante BOOLEAN,
  communication_satisfaisante BOOLEAN,

  -- Section 4: Recommandation
  recommandation TEXT CHECK (recommandation IN ('oui', 'non', 'peut_etre')),
  message_recommandation TEXT,
  consent_publication BOOLEAN DEFAULT false,

  -- Section 5: Amélioration
  points_forts TEXT,
  axes_amelioration TEXT,
  commentaires_libres TEXT,

  -- Tracking
  date_envoi TIMESTAMPTZ,
  date_premiere_ouverture TIMESTAMPTZ,
  date_soumission TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_sponsor_cold_evaluations_token ON public.sponsor_cold_evaluations(token);
CREATE INDEX idx_sponsor_cold_evaluations_training ON public.sponsor_cold_evaluations(training_id);
CREATE INDEX idx_sponsor_cold_evaluations_etat ON public.sponsor_cold_evaluations(etat);

-- RLS policies
ALTER TABLE public.sponsor_cold_evaluations ENABLE ROW LEVEL SECURITY;

-- Authenticated users (admin/trainer) can read all
CREATE POLICY "Authenticated users can read sponsor cold evaluations"
  ON public.sponsor_cold_evaluations FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can insert/update their own
CREATE POLICY "Authenticated users can insert sponsor cold evaluations"
  ON public.sponsor_cold_evaluations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update sponsor cold evaluations"
  ON public.sponsor_cold_evaluations FOR UPDATE
  TO authenticated
  USING (true);

-- Anonymous users (sponsors filling the form) can read/update by token
CREATE POLICY "Anonymous can read sponsor cold evaluations by token"
  ON public.sponsor_cold_evaluations FOR SELECT
  TO anon
  USING (token IS NOT NULL);

CREATE POLICY "Anonymous can update sponsor cold evaluations by token"
  ON public.sponsor_cold_evaluations FOR UPDATE
  TO anon
  USING (token IS NOT NULL);

-- Service role has full access (for edge functions)
CREATE POLICY "Service role full access to sponsor cold evaluations"
  ON public.sponsor_cold_evaluations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
