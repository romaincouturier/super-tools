-- ============================================================
-- Auto-indexation triggers for document_embeddings
--
-- Strategy: lightweight DB triggers that insert into a queue table,
-- then fire an async HTTP call via pg_net to process the queue.
-- pg_net sends the request AFTER the transaction commits, so the
-- queue item is always visible when the edge function runs.
-- ============================================================

-- 1. Queue table for pending indexation jobs
CREATE TABLE IF NOT EXISTS public.indexation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  operation text NOT NULL DEFAULT 'upsert',   -- 'upsert' or 'delete'
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX idx_indexation_queue_pending
  ON public.indexation_queue (created_at)
  WHERE processed_at IS NULL;

-- RLS: only service_role writes to this table
ALTER TABLE public.indexation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "indexation_queue_service_role_all" ON public.indexation_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users can read (for admin monitoring)
CREATE POLICY "indexation_queue_select" ON public.indexation_queue
  FOR SELECT TO authenticated USING (true);

-- 2. Generic trigger function
CREATE OR REPLACE FUNCTION public.enqueue_indexation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _source_type text;
  _source_id uuid;
  _op text;
  _supabase_url text;
  _service_role_key text;
BEGIN
  -- Determine source_type from trigger argument
  _source_type := TG_ARGV[0];

  IF TG_OP = 'DELETE' THEN
    _source_id := OLD.id;
    _op := 'delete';
  ELSE
    _source_id := NEW.id;
    _op := 'upsert';
  END IF;

  INSERT INTO public.indexation_queue (source_type, source_id, operation)
  VALUES (_source_type, _source_id, _op);

  -- Fire async HTTP call via pg_net to process the queue.
  -- pg_net sends the request AFTER the transaction commits,
  -- so the queue item is guaranteed to be visible.
  BEGIN
    SELECT decrypted_secret INTO _supabase_url
      FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL';
    SELECT decrypted_secret INTO _service_role_key
      FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';

    IF _supabase_url IS NOT NULL AND _service_role_key IS NOT NULL THEN
      PERFORM net.http_post(
        url := _supabase_url || '/functions/v1/process-indexation-queue',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || _service_role_key
        ),
        body := '{}'::jsonb
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- pg_net not available or vault secrets missing — silently skip.
    -- Queue items will be processed on the next successful trigger or manual backfill.
    RAISE WARNING 'enqueue_indexation: pg_net call failed: %', SQLERRM;
  END;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Prevent direct calls from users (only triggers should invoke this)
REVOKE EXECUTE ON FUNCTION public.enqueue_indexation() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_indexation() FROM authenticated;

-- 3. Attach triggers to source tables

-- CRM Cards
CREATE TRIGGER trg_index_crm_card
  AFTER INSERT OR UPDATE OF title, description_html, waiting_next_action_text
  ON public.crm_cards
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('crm_card');

-- CRM Comments
CREATE TRIGGER trg_index_crm_comment
  AFTER INSERT OR UPDATE OF content
  ON public.crm_comments
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('crm_comment');

-- CRM Emails
CREATE TRIGGER trg_index_crm_email
  AFTER INSERT
  ON public.crm_card_emails
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('crm_email');

-- Inbound Emails
CREATE TRIGGER trg_index_inbound_email
  AFTER INSERT OR UPDATE OF notes
  ON public.inbound_emails
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('inbound_email');

-- Trainings
CREATE TRIGGER trg_index_training
  AFTER INSERT OR UPDATE OF training_name, client_name, location
  ON public.trainings
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('training');

-- Missions
CREATE TRIGGER trg_index_mission
  AFTER INSERT OR UPDATE OF title, description, client_name
  ON public.missions
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('mission');

-- Quotes
CREATE TRIGGER trg_index_quote
  AFTER INSERT OR UPDATE OF synthesis, instructions, email_subject, email_body
  ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('quote');

-- Support Tickets
CREATE TRIGGER trg_index_support_ticket
  AFTER INSERT OR UPDATE OF title, description, resolution_notes
  ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('support_ticket');

-- Coaching Summaries
CREATE TRIGGER trg_index_coaching_summary
  AFTER INSERT OR UPDATE OF summary_text
  ON public.coaching_summaries
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('coaching_summary');

-- Content Cards
CREATE TRIGGER trg_index_content_card
  AFTER INSERT OR UPDATE OF title, description
  ON public.content_cards
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('content_card');

-- LMS Lessons
CREATE TRIGGER trg_index_lms_lesson
  AFTER INSERT OR UPDATE OF title, content_html
  ON public.lms_lessons
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('lms_lesson');

-- Activity Logs (micro-devis only — filtered in the extractor)
CREATE TRIGGER trg_index_activity_log
  AFTER INSERT
  ON public.activity_logs
  FOR EACH ROW
  WHEN (NEW.action_type = 'micro_devis_sent')
  EXECUTE FUNCTION public.enqueue_indexation('activity_log');

-- Cleanup: delete embeddings when source records are deleted
CREATE TRIGGER trg_delete_crm_card_embedding
  AFTER DELETE ON public.crm_cards
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('crm_card');

CREATE TRIGGER trg_delete_crm_comment_embedding
  AFTER DELETE ON public.crm_comments
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('crm_comment');

CREATE TRIGGER trg_delete_mission_embedding
  AFTER DELETE ON public.missions
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('mission');

CREATE TRIGGER trg_delete_quote_embedding
  AFTER DELETE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('quote');
