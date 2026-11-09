CREATE TABLE public.training_transcripts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), training_id uuid NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE, transcript_id uuid NOT NULL REFERENCES public.transcripts(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), created_by uuid NOT NULL DEFAULT auth.uid(), UNIQUE(training_id,transcript_id));
GRANT SELECT, INSERT ON public.training_transcripts TO authenticated;
GRANT ALL ON public.training_transcripts TO service_role;
ALTER TABLE public.training_transcripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY training_transcripts_staff_read ON public.training_transcripts FOR SELECT TO authenticated USING (public.is_staff_user() AND EXISTS(SELECT 1 FROM public.trainings t WHERE t.id=training_id) AND EXISTS(SELECT 1 FROM public.transcripts tr WHERE tr.id=transcript_id));
CREATE POLICY training_transcripts_staff_insert ON public.training_transcripts FOR INSERT TO authenticated WITH CHECK (public.is_staff_user() AND created_by=auth.uid() AND EXISTS(SELECT 1 FROM public.trainings t WHERE t.id=training_id) AND EXISTS(SELECT 1 FROM public.transcripts tr WHERE tr.id=transcript_id));
CREATE INDEX training_transcripts_transcript_idx ON public.training_transcripts(transcript_id);
CREATE OR REPLACE FUNCTION public.get_transcript_assignments() RETURNS TABLE(transcript_id uuid,kind text,entity_id uuid,label text) LANGUAGE sql STABLE SET search_path=public AS $function$
 SELECT ct.transcript_id,'opportunity',c.id,COALESCE(NULLIF(c.company,'')||' · ','')||COALESCE(c.title,'Opportunité') FROM public.crm_card_transcripts ct JOIN public.crm_cards c ON c.id=ct.card_id
 UNION ALL SELECT et.transcript_id,'event',e.id,COALESCE(e.title,'Événement') FROM public.event_transcripts et JOIN public.events e ON e.id=et.event_id
 UNION ALL SELECT DISTINCT p.source_transcript_id,'mission',m.id,COALESCE(NULLIF(m.client_name,'')||' · ','')||COALESCE(m.title,'Mission') FROM public.mission_pages p JOIN public.missions m ON m.id=p.mission_id WHERE p.source_transcript_id IS NOT NULL
 UNION ALL SELECT l.source_transcript_id,'lesson',l.id,COALESCE(l.title,'Leçon e-learning') FROM public.lms_lessons l WHERE l.source_transcript_id IS NOT NULL
 UNION ALL SELECT nt.transcript_id,'network_contact',n.id,COALESCE(n.name,'Contact réseau') FROM public.network_contact_transcripts nt JOIN public.network_contacts n ON n.id=nt.contact_id
 UNION ALL SELECT tt.transcript_id,'training',t.id,COALESCE(t.training_name,'Formation') FROM public.training_transcripts tt JOIN public.trainings t ON t.id=tt.training_id;
$function$;
REVOKE ALL ON FUNCTION public.get_transcript_assignments() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_transcript_assignments() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.link_transcript_to_training(p_training_id uuid,p_transcript_id uuid,p_allow_multiple boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $function$
DECLARE assignments jsonb; new_id uuid;
BEGIN
 IF NOT public.is_staff_user() THEN RAISE EXCEPTION 'Accès personnel requis' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.transcripts WHERE id=p_transcript_id AND status='ready' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Transcript indisponible'; END IF;
 PERFORM 1 FROM public.trainings WHERE id=p_training_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Formation introuvable'; END IF;
 IF EXISTS(SELECT 1 FROM public.training_transcripts WHERE training_id=p_training_id AND transcript_id=p_transcript_id) THEN RETURN jsonb_build_object('status','already_assigned'); END IF;
 SELECT jsonb_agg(to_jsonb(a)) INTO assignments FROM public.get_transcript_assignments() a WHERE a.transcript_id=p_transcript_id;
 IF assignments IS NOT NULL AND p_allow_multiple IS NOT TRUE THEN RETURN jsonb_build_object('status','needs_confirmation','current_assignments',assignments); END IF;
 INSERT INTO public.training_transcripts(training_id,transcript_id,created_by) VALUES(p_training_id,p_transcript_id,auth.uid()) RETURNING id INTO new_id;
 INSERT INTO public.activity_logs(action_type,recipient_email,user_id,details) VALUES('training_transcript_linked',COALESCE(auth.jwt()->>'email','mcp'),auth.uid(),jsonb_build_object('training_id',p_training_id,'transcript_id',p_transcript_id,'link_id',new_id));
 RETURN jsonb_build_object('status','assigned','link_id',new_id,'training_id',p_training_id,'transcript_id',p_transcript_id);
END;
$function$;
REVOKE ALL ON FUNCTION public.link_transcript_to_training(uuid,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.link_transcript_to_training(uuid,uuid,boolean) TO authenticated;