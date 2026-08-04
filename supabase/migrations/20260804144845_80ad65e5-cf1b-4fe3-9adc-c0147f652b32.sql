ALTER TABLE public.transcripts
  ADD COLUMN IF NOT EXISTS editorial_analysis_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS editorial_analysis_error text;

CREATE INDEX IF NOT EXISTS transcripts_editorial_pending_idx
  ON public.transcripts (created_at DESC)
  WHERE editorial_qualification IS NULL AND editorial_analysis_attempts < 3;

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
REVOKE ALL ON FUNCTION public.record_editorial_analysis_failure(uuid, text) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.record_editorial_analysis_failure(uuid, text) TO service_role;