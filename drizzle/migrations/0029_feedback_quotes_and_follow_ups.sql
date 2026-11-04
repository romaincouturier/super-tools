-- Retours après formation, étape 2 :
-- 1. une citation autorisée (questionnaire à froid participant ou retour libre) devient un
--    témoignage « à valider » dans testimonials, une seule fois par source ;
-- 2. une suite à donner (besoin coché dans le questionnaire à froid, suite saisie sur un
--    retour libre) reste ouverte jusqu'à follow_up_done_at, posé quand l'action du jour
--    « suites_retours » correspondante est cochée.
--
-- participant_cold_evaluations est créée hors de ce dossier (drizzle/migrations/0018) :
-- tout ce qui la touche est conditionné à son existence pour garder le rejeu possible.

ALTER TABLE public.training_feedbacks ADD COLUMN IF NOT EXISTS follow_up text;
ALTER TABLE public.training_feedbacks ADD COLUMN IF NOT EXISTS follow_up_done_at timestamptz;

DO $$
BEGIN
  IF to_regclass('public.participant_cold_evaluations') IS NOT NULL THEN
    ALTER TABLE public.participant_cold_evaluations ADD COLUMN IF NOT EXISTS follow_up_done_at timestamptz;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS testimonials_quote_source_unique
  ON public.testimonials ((metadata->>'source_type'), (metadata->>'source_id'))
  WHERE metadata ? 'source_id';

-- ── Citation autorisée -> témoignage à valider ─────────────────────────────

CREATE OR REPLACE FUNCTION public.create_quote_testimonial(
  p_source_type text, p_source_id uuid, p_training_id uuid, p_participant_id uuid,
  p_author text, p_company text, p_quote text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_quote IS NULL OR btrim(p_quote) = '' THEN RETURN; END IF;
  INSERT INTO testimonials (client_name, company, service_type, raw_transcript, status, metadata)
  SELECT p_author, p_company, t.training_name, btrim(p_quote), 'pending_review',
         jsonb_build_object('source_type', p_source_type, 'source_id', p_source_id::text,
                            'training_id', p_training_id::text, 'participant_id', p_participant_id::text,
                            'kind', 'written_quote')
  FROM trainings t WHERE t.id = p_training_id
  ON CONFLICT ((metadata->>'source_type'), (metadata->>'source_id')) WHERE metadata ? 'source_id' DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.create_quote_testimonial(text, uuid, uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_training_feedback_quote() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company text;
BEGIN
  IF NEW.consent_publication AND (TG_OP = 'INSERT' OR NOT OLD.consent_publication) THEN
    SELECT company INTO v_company FROM training_participants WHERE id = NEW.participant_id;
    PERFORM create_quote_testimonial('training_feedback', NEW.id, NEW.training_id, NEW.participant_id,
                                     NEW.author_name, v_company, NEW.content);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_training_feedbacks_quote ON public.training_feedbacks;
CREATE TRIGGER trg_training_feedbacks_quote AFTER INSERT OR UPDATE OF consent_publication ON public.training_feedbacks
  FOR EACH ROW EXECUTE FUNCTION public.trg_training_feedback_quote();

CREATE OR REPLACE FUNCTION public.trg_participant_cold_evaluation_quote() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.etat = 'soumis' AND NEW.consent_publication IS TRUE
     AND (OLD.etat IS DISTINCT FROM 'soumis' OR OLD.consent_publication IS NOT TRUE) THEN
    PERFORM create_quote_testimonial('participant_cold_evaluation', NEW.id, NEW.training_id, NEW.participant_id,
                                     NULLIF(btrim(concat_ws(' ', NEW.first_name, NEW.last_name)), ''), NEW.company, NEW.temoignage);
  END IF;
  RETURN NEW;
END $$;

DO $$
BEGIN
  IF to_regclass('public.participant_cold_evaluations') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_participant_cold_evaluations_quote ON public.participant_cold_evaluations;
    CREATE TRIGGER trg_participant_cold_evaluations_quote AFTER UPDATE ON public.participant_cold_evaluations
      FOR EACH ROW EXECUTE FUNCTION public.trg_participant_cold_evaluation_quote();
    -- Rattrapage : citations autorisées déjà soumises.
    PERFORM public.create_quote_testimonial('participant_cold_evaluation', e.id, e.training_id, e.participant_id,
                                            NULLIF(btrim(concat_ws(' ', e.first_name, e.last_name)), ''), e.company, e.temoignage)
    FROM public.participant_cold_evaluations e
    WHERE e.etat = 'soumis' AND e.consent_publication IS TRUE AND btrim(coalesce(e.temoignage, '')) <> '';
  END IF;
END $$;

-- ── Action du jour cochée -> suite marquée traitée ─────────────────────────

CREATE OR REPLACE FUNCTION public.trg_daily_action_follow_up_done() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_done timestamptz := CASE WHEN NEW.is_completed THEN now() ELSE NULL END;
BEGIN
  IF NEW.category <> 'suites_retours' OR NEW.entity_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.entity_type = 'training_feedback' THEN
    UPDATE training_feedbacks SET follow_up_done_at = v_done WHERE id::text = NEW.entity_id;
  ELSIF NEW.entity_type = 'participant_cold_evaluation' AND to_regclass('public.participant_cold_evaluations') IS NOT NULL THEN
    EXECUTE 'UPDATE participant_cold_evaluations SET follow_up_done_at = $1 WHERE id::text = $2' USING v_done, NEW.entity_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_daily_actions_follow_up_done ON public.daily_actions;
CREATE TRIGGER trg_daily_actions_follow_up_done AFTER UPDATE OF is_completed ON public.daily_actions
  FOR EACH ROW WHEN (OLD.is_completed IS DISTINCT FROM NEW.is_completed)
  EXECUTE FUNCTION public.trg_daily_action_follow_up_done();
