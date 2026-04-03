-- ============================================================
-- Additional indexation triggers for RAG coverage
-- Tables: mission_pages, mission_activities, evaluation_analyses,
--         questionnaire_besoins, okr_objectives, okr_key_results,
--         okr_initiatives
-- ============================================================

-- Mission Pages
CREATE TRIGGER trg_index_mission_page
  AFTER INSERT OR UPDATE OF title, content
  ON public.mission_pages
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('mission_page');

CREATE TRIGGER trg_delete_mission_page_embedding
  AFTER DELETE ON public.mission_pages
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('mission_page');

-- Mission Activities
CREATE TRIGGER trg_index_mission_activity
  AFTER INSERT OR UPDATE OF description
  ON public.mission_activities
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('mission_activity');

CREATE TRIGGER trg_delete_mission_activity_embedding
  AFTER DELETE ON public.mission_activities
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('mission_activity');

-- Evaluation Analyses
CREATE TRIGGER trg_index_evaluation_analysis
  AFTER INSERT OR UPDATE OF summary, strengths, weaknesses, recommendations
  ON public.evaluation_analyses
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('evaluation_analysis');

CREATE TRIGGER trg_delete_evaluation_analysis_embedding
  AFTER DELETE ON public.evaluation_analyses
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('evaluation_analysis');

-- Questionnaire Besoins
CREATE TRIGGER trg_index_questionnaire_besoins
  AFTER INSERT OR UPDATE OF experience_details, competences_actuelles, competences_visees, besoins_accessibilite, commentaires_libres
  ON public.questionnaire_besoins
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('questionnaire_besoins');

CREATE TRIGGER trg_delete_questionnaire_besoins_embedding
  AFTER DELETE ON public.questionnaire_besoins
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('questionnaire_besoins');

-- OKR Objectives
CREATE TRIGGER trg_index_okr_objective
  AFTER INSERT OR UPDATE OF title, description, status, progress_percentage
  ON public.okr_objectives
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('okr_objective');

CREATE TRIGGER trg_delete_okr_objective_embedding
  AFTER DELETE ON public.okr_objectives
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('okr_objective');

-- OKR Key Results
CREATE TRIGGER trg_index_okr_key_result
  AFTER INSERT OR UPDATE OF title, current_value
  ON public.okr_key_results
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('okr_key_result');

CREATE TRIGGER trg_delete_okr_key_result_embedding
  AFTER DELETE ON public.okr_key_results
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('okr_key_result');

-- OKR Initiatives
CREATE TRIGGER trg_index_okr_initiative
  AFTER INSERT OR UPDATE OF title, status
  ON public.okr_initiatives
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('okr_initiative');

CREATE TRIGGER trg_delete_okr_initiative_embedding
  AFTER DELETE ON public.okr_initiatives
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('okr_initiative');

-- ============================================================
-- Cron job: process indexation queue every 2 minutes
-- Ensures items are processed even if pg_net is unavailable
-- ============================================================
SELECT cron.schedule(
  'process-indexation-queue',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/process-indexation-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
