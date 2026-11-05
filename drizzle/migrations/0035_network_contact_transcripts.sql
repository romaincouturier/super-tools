CREATE TABLE public.network_contact_transcripts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES public.network_contacts(id) ON DELETE CASCADE,
  transcript_id uuid NOT NULL REFERENCES public.transcripts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  interaction_id uuid REFERENCES public.network_interactions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contact_id, transcript_id)
);

GRANT SELECT, INSERT, DELETE ON public.network_contact_transcripts TO authenticated;
GRANT ALL ON public.network_contact_transcripts TO service_role;

ALTER TABLE public.network_contact_transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own network transcript links"
  ON public.network_contact_transcripts FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Staff owner links transcripts to own contacts"
  ON public.network_contact_transcripts FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND public.is_staff_user()
    AND EXISTS (SELECT 1 FROM public.network_contacts c WHERE c.id = contact_id AND c.user_id = auth.uid())
  );
CREATE POLICY "Owner deletes own network transcript links"
  ON public.network_contact_transcripts FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_network_contact_transcripts_contact ON public.network_contact_transcripts(contact_id);
CREATE INDEX idx_network_contact_transcripts_transcript ON public.network_contact_transcripts(transcript_id);

-- Date de réunion d'un transcript (Fireflies, Drive, sinon création), en jour Europe/Paris
CREATE OR REPLACE FUNCTION public.transcript_meeting_date(p_metadata jsonb, p_created_at timestamptz)
RETURNS date LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT (COALESCE(
    CASE WHEN p_metadata->>'fireflies_date' ~ '^\d{4}-\d{2}-\d{2}' THEN (p_metadata->>'fireflies_date')::timestamptz END,
    CASE WHEN p_metadata->>'file_date' ~ '^\d{4}-\d{2}-\d{2}' THEN (p_metadata->>'file_date')::timestamptz END,
    p_created_at
  ) AT TIME ZONE 'Europe/Paris')::date
$$;

-- Rattache un transcript à un contact Réseau de l'appelant : lien, interaction « meeting », dernier contact.
CREATE OR REPLACE FUNCTION public.link_transcript_to_network_contact(
  p_contact_id uuid, p_transcript_id uuid, p_transcript_url text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_t record;
  v_date date;
  v_interaction uuid;
  v_title text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  IF NOT EXISTS (SELECT 1 FROM network_contacts WHERE id = p_contact_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'Contact introuvable';
  END IF;
  SELECT id, title, ai_title, summary, metadata, created_at, status INTO v_t FROM transcripts WHERE id = p_transcript_id;
  IF v_t.id IS NULL THEN RAISE EXCEPTION 'Transcript introuvable'; END IF;
  IF EXISTS (SELECT 1 FROM network_contact_transcripts WHERE contact_id = p_contact_id AND transcript_id = p_transcript_id) THEN
    RETURN jsonb_build_object('status', 'already_assigned');
  END IF;
  v_date := transcript_meeting_date(v_t.metadata, v_t.created_at);
  v_title := COALESCE(NULLIF(v_t.ai_title, ''), NULLIF(v_t.title, ''), 'Transcript');
  INSERT INTO network_interactions (user_id, contact_id, interaction_type, notes, created_at)
  VALUES (v_uid, p_contact_id, 'meeting',
    'Réunion : ' || v_title || E'\n\n' || COALESCE(NULLIF(v_t.summary, ''), '(pas de résumé)')
      || CASE WHEN p_transcript_url IS NOT NULL AND p_transcript_url <> '' THEN E'\n\nTranscript : ' || p_transcript_url ELSE '' END,
    (v_date::timestamp + time '12:00') AT TIME ZONE 'Europe/Paris')
  RETURNING id INTO v_interaction;
  INSERT INTO network_contact_transcripts (contact_id, transcript_id, user_id, interaction_id)
  VALUES (p_contact_id, p_transcript_id, v_uid, v_interaction);
  UPDATE network_contacts SET last_contact_date = GREATEST(COALESCE(last_contact_date, v_date), v_date)
  WHERE id = p_contact_id;
  RETURN jsonb_build_object('status', 'assigned', 'interaction_id', v_interaction, 'meeting_date', v_date);
END $$;

REVOKE EXECUTE ON FUNCTION public.link_transcript_to_network_contact(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_transcript_to_network_contact(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_transcript_assignments()
 RETURNS TABLE(transcript_id uuid, kind text, entity_id uuid, label text)
 LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
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
  WHERE l.source_transcript_id IS NOT NULL
  UNION ALL
  SELECT nt.transcript_id, 'network_contact', n.id, COALESCE(n.name, 'Contact réseau')
  FROM public.network_contact_transcripts nt JOIN public.network_contacts n ON n.id = nt.contact_id;
$function$;