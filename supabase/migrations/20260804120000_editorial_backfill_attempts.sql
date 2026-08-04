-- Boucle de retry infinie du backfill éditorial.
--
-- `editorial-backfill` (cron toutes les 10 min, 20 transcripts par run)
-- sélectionne les transcripts où `editorial_qualification IS NULL`. Quand
-- `analyze-transcript-editorial` échoue de façon reproductible (sortie IA non
-- parsable, prompt absent), le champ reste NULL : le même transcript est
-- réanalysé 144 fois par jour, indéfiniment, en brûlant des crédits IA.
--
-- On compte les tentatives et on sort du lot après 3 échecs. Un opérateur
-- relance en remettant le compteur à zéro.
--
-- Règle [036] : cette migration ne replanifie PAS le cron. Le garde SQL du cron
-- (`WHERE EXISTS … editorial_qualification IS NULL`) ne décide que du
-- déclenchement d'un appel HTTP ; c'est le filtre côté fonction qui coupe les
-- appels IA. Le garde peut être resserré à la main en base en ajoutant
-- `AND editorial_analysis_attempts < 3`, mais ce n'est qu'une économie de no-op.

ALTER TABLE public.transcripts
  ADD COLUMN IF NOT EXISTS editorial_analysis_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS editorial_analysis_error text;

-- Index partiel utilisé par le backfill : uniquement les candidats restants.
CREATE INDEX IF NOT EXISTS transcripts_editorial_pending_idx
  ON public.transcripts (created_at DESC)
  WHERE editorial_qualification IS NULL AND editorial_analysis_attempts < 3;

-- Incrément atomique du compteur d'échecs, appelé par
-- analyze-transcript-editorial. En RPC pour éviter un read-modify-write depuis
-- l'edge function (deux analyses concurrentes perdraient une tentative).
CREATE OR REPLACE FUNCTION public.record_editorial_analysis_failure(
  p_transcript_id uuid,
  p_error text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.transcripts
  SET editorial_analysis_attempts = editorial_analysis_attempts + 1,
      editorial_analysis_error = p_error
  WHERE id = p_transcript_id;
$$;

REVOKE ALL ON FUNCTION public.record_editorial_analysis_failure(uuid, text) FROM PUBLIC;
