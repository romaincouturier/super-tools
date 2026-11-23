CREATE TABLE public.book_analysis_control (id boolean PRIMARY KEY DEFAULT true CHECK(id), lease_id uuid, lease_until timestamptz, pause_reason text, resume_after timestamptz);
GRANT SELECT ON public.book_analysis_control TO authenticated;
GRANT ALL ON public.book_analysis_control TO service_role;
ALTER TABLE public.book_analysis_control ENABLE ROW LEVEL SECURITY;
CREATE POLICY book_analysis_control_read ON public.book_analysis_control FOR SELECT TO authenticated USING(public.has_module_access(auth.uid(),'book'));
CREATE TABLE public.book_analysis_jobs (production_id uuid PRIMARY KEY REFERENCES public.book_productions(id) ON DELETE CASCADE, requested_by uuid, mode text NOT NULL DEFAULT 'enrich' CHECK(mode IN ('enrich','regenerate')), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','done','error')), error_message text, snapshot jsonb, run_id uuid, created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz);
GRANT SELECT ON public.book_analysis_jobs TO authenticated;
GRANT ALL ON public.book_analysis_jobs TO service_role;
ALTER TABLE public.book_analysis_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY book_analysis_jobs_read ON public.book_analysis_jobs FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.book_productions p WHERE p.id=production_id));
CREATE FUNCTION public.enqueue_book_image() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF NEW.file_type='image' THEN INSERT INTO public.book_analysis_jobs(production_id,requested_by) VALUES(NEW.id,NEW.user_id) ON CONFLICT DO NOTHING; END IF; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.enqueue_book_image() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER book_image_analysis_queue AFTER INSERT ON public.book_productions FOR EACH ROW EXECUTE FUNCTION public.enqueue_book_image();
CREATE FUNCTION public.request_book_analysis(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE p public.book_productions; BEGIN
SELECT * INTO p FROM public.book_productions WHERE id=p_id;
IF p.id IS NULL OR auth.uid() IS NULL OR NOT (p.user_id=auth.uid() OR public.has_module_access(auth.uid(),'book')) THEN RAISE EXCEPTION 'Accès Book requis'; END IF;
IF p.file_type<>'image' THEN RAISE EXCEPTION 'Une image est requise'; END IF;
IF EXISTS(SELECT 1 FROM public.book_analysis_jobs WHERE production_id=p_id AND status='processing') THEN RAISE EXCEPTION 'Analyse déjà en cours'; END IF;
INSERT INTO public.book_analysis_jobs(production_id,requested_by,mode) VALUES(p_id,auth.uid(),'regenerate') ON CONFLICT(production_id) DO UPDATE SET mode='regenerate',requested_by=auth.uid(),status='pending',error_message=NULL,finished_at=NULL WHERE book_analysis_jobs.status<>'processing';
INSERT INTO public.activity_logs(action_type,user_id,details) VALUES('book_analysis_requested',auth.uid(),jsonb_build_object('production_id',p_id)); END $$;
REVOKE ALL ON FUNCTION public.request_book_analysis(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_book_analysis(uuid) TO authenticated;
CREATE FUNCTION public.claim_book_analysis(p_run uuid) RETURNS SETOF public.book_analysis_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE c public.book_analysis_control; BEGIN
INSERT INTO public.book_analysis_control(id) VALUES(true) ON CONFLICT DO NOTHING;
SELECT * INTO c FROM public.book_analysis_control WHERE id=true FOR UPDATE;
IF c.lease_until>now() OR (c.pause_reason IS NOT NULL AND (c.resume_after IS NULL OR c.resume_after>now())) THEN RETURN; END IF;
UPDATE public.book_analysis_jobs SET status='error',error_message='Traitement interrompu : résultat IA inconnu, régénération manuelle requise',finished_at=now() WHERE status='processing';
UPDATE public.book_analysis_control SET lease_id=p_run,lease_until=now()+interval '10 minutes',pause_reason=NULL,resume_after=NULL WHERE id=true;
RETURN QUERY WITH batch AS (SELECT j.production_id FROM public.book_analysis_jobs j WHERE j.status='pending' ORDER BY j.created_at LIMIT 3 FOR UPDATE SKIP LOCKED) UPDATE public.book_analysis_jobs j SET status='processing',run_id=p_run,snapshot=jsonb_build_object('title',p.title,'tags',p.tags,'notes',p.notes) FROM batch b,public.book_productions p WHERE j.production_id=b.production_id AND p.id=j.production_id RETURNING j.*;
END $$;
REVOKE ALL ON FUNCTION public.claim_book_analysis(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_book_analysis(uuid) TO service_role;
CREATE FUNCTION public.finish_book_analysis(p_id uuid,p_run uuid,p_title text,p_tags text[],p_notes text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE j public.book_analysis_jobs; p public.book_productions; before_value jsonb; BEGIN
SELECT * INTO j FROM public.book_analysis_jobs WHERE production_id=p_id AND run_id=p_run AND status='processing' FOR UPDATE;
IF j.production_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.book_analysis_control WHERE id=true AND lease_id=p_run AND lease_until>now() AND pause_reason IS NULL) THEN RAISE EXCEPTION 'Traitement expiré'; END IF;
IF cardinality(p_tags)<5 OR cardinality(p_tags)>12 THEN RAISE EXCEPTION '5 à 12 tags requis'; END IF;
SELECT * INTO p FROM public.book_productions WHERE id=p_id FOR UPDATE;
before_value=jsonb_build_object('title',p.title,'tags',p.tags,'notes',p.notes);
UPDATE public.book_productions SET title=CASE WHEN p.title IS NOT DISTINCT FROM j.snapshot->>'title' THEN p_title ELSE p.title END,
tags=CASE WHEN to_jsonb(p.tags) IS NOT DISTINCT FROM j.snapshot->'tags' AND (j.mode='regenerate' OR cardinality(p.tags)=0) THEN p_tags ELSE p.tags END,
notes=CASE WHEN to_jsonb(p.notes) IS NOT DISTINCT FROM j.snapshot->'notes' AND (j.mode='regenerate' OR coalesce(p.notes,'')='') THEN p_notes ELSE p.notes END WHERE id=p_id;
UPDATE public.book_analysis_jobs SET status='done',finished_at=now(),error_message=NULL WHERE production_id=p_id;
INSERT INTO public.activity_logs(action_type,user_id,details) SELECT 'book_image_analyzed',j.requested_by,jsonb_build_object('production_id',p_id,'run_id',p_run,'before',before_value,'after',jsonb_build_object('title',title,'tags',tags,'notes',notes)) FROM public.book_productions WHERE id=p_id;
END $$;
REVOKE ALL ON FUNCTION public.finish_book_analysis(uuid,uuid,text,text[],text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_book_analysis(uuid,uuid,text,text[],text) TO service_role;
CREATE FUNCTION public.book_search_normalize(p_text text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT translate(lower(coalesce(p_text,'')), 'àâäáãåéèêëíìîïóòôöõúùûüýÿçœæ', 'aaaaaaeeeeiiiiooooouuuuyycoa'); $$;
GRANT EXECUTE ON FUNCTION public.book_search_normalize(text) TO authenticated,service_role;
CREATE FUNCTION public.search_book_productions(p_query text,p_album text DEFAULT NULL,p_limit integer DEFAULT 20) RETURNS TABLE(id uuid,album jsonb,title text,tags text[],notes text,thumbnail text) LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT p.id,jsonb_build_object('id',a.id,'title',a.title),p.title,p.tags,p.notes,coalesce(p.thumbnail_url,p.file_url) FROM public.book_productions p JOIN public.book_albums a ON a.id=p.album_id WHERE public.book_search_normalize(p.title||' '||array_to_string(p.tags,' ')||' '||coalesce(p.notes,'')) LIKE '%'||replace(replace(replace(public.book_search_normalize(p_query),'\','\\'),'%','\%'),'_','\_')||'%' AND (p_album IS NULL OR a.id::text=p_album OR public.book_search_normalize(a.title) LIKE '%'||public.book_search_normalize(p_album)||'%') ORDER BY p.created_at DESC,p.id LIMIT greatest(1,least(coalesce(p_limit,20),100)); $$;
REVOKE ALL ON FUNCTION public.search_book_productions(text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.search_book_productions(text,text,integer) TO authenticated,service_role;