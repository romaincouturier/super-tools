ALTER TABLE public.mission_pages
  ADD COLUMN IF NOT EXISTS source_transcript_id uuid REFERENCES public.transcripts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS mission_pages_source_transcript_id_idx ON public.mission_pages(source_transcript_id);

UPDATE public.mission_pages p
SET source_transcript_id = t.id
FROM public.transcripts t
WHERE p.source_transcript_id IS NULL
  AND t.status = 'ready'
  AND p.title IN (t.ai_title, t.title)
  AND p.title IS NOT NULL AND p.title <> '';

CREATE OR REPLACE FUNCTION public.get_transcript_assignments()
RETURNS TABLE(transcript_id uuid, kind text, entity_id uuid, label text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT ct.transcript_id, 'opportunity', c.id, COALESCE(NULLIF(c.company, '') || ' · ', '') || COALESCE(c.title, 'Opportunité')
  FROM public.crm_card_transcripts ct JOIN public.crm_cards c ON c.id = ct.card_id
  UNION ALL
  SELECT et.transcript_id, 'event', e.id, COALESCE(e.title, 'Événement')
  FROM public.event_transcripts et JOIN public.events e ON e.id = et.event_id
  UNION ALL
  SELECT DISTINCT p.source_transcript_id, 'mission', m.id, COALESCE(NULLIF(m.client_name, '') || ' · ', '') || COALESCE(m.title, 'Mission')
  FROM public.mission_pages p JOIN public.missions m ON m.id = p.mission_id
  WHERE p.source_transcript_id IS NOT NULL
  UNION ALL
  SELECT l.source_transcript_id, 'lesson', l.id, COALESCE(l.title, 'Leçon e-learning')
  FROM public.lms_lessons l
  WHERE l.source_transcript_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_transcript_assignments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_transcript_assignments() TO authenticated, service_role;