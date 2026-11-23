CREATE OR REPLACE FUNCTION public.request_book_analysis(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE p public.book_productions; BEGIN
SELECT * INTO p FROM public.book_productions WHERE id=p_id;
IF p.id IS NULL OR auth.uid() IS NULL OR NOT (p.user_id=auth.uid() OR public.has_module_access(auth.uid(),'book')) THEN RAISE EXCEPTION 'Accès Book requis'; END IF;
IF p.file_type<>'image' THEN RAISE EXCEPTION 'Une image est requise'; END IF;
IF EXISTS(SELECT 1 FROM public.book_analysis_jobs WHERE production_id=p_id AND status='processing') THEN RAISE EXCEPTION 'Analyse déjà en cours'; END IF;
INSERT INTO public.book_analysis_jobs(production_id,requested_by,mode) VALUES(p_id,auth.uid(),'regenerate') ON CONFLICT(production_id) DO UPDATE SET mode='regenerate',requested_by=auth.uid(),status='pending',error_message=NULL,finished_at=NULL WHERE book_analysis_jobs.status<>'processing';
INSERT INTO public.activity_logs(action_type,user_id,recipient_email,details) VALUES('book_analysis_requested',auth.uid(),'',jsonb_build_object('production_id',p_id)); END $$;
CREATE OR REPLACE FUNCTION public.finish_book_analysis(p_id uuid,p_run uuid,p_title text,p_tags text[],p_notes text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE j public.book_analysis_jobs; p public.book_productions; before_value jsonb; BEGIN
SELECT * INTO j FROM public.book_analysis_jobs WHERE production_id=p_id AND run_id=p_run AND status='processing' FOR UPDATE;
IF j.production_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.book_analysis_control WHERE id=true AND lease_id=p_run AND lease_until>now() AND pause_reason IS NULL) THEN RAISE EXCEPTION 'Traitement expiré'; END IF;
IF cardinality(p_tags)<5 OR cardinality(p_tags)>12 THEN RAISE EXCEPTION '5 à 12 tags requis'; END IF;
SELECT * INTO p FROM public.book_productions WHERE id=p_id FOR UPDATE;
before_value=jsonb_build_object('title',p.title,'tags',p.tags,'notes',p.notes);
UPDATE public.book_productions SET title=CASE WHEN p.title IS NOT DISTINCT FROM j.snapshot->>'title' AND (p.title ~* '^(IMG|DSC|DSCF|DSCN|PXL|IMAGE|PHOTO)[_ -]?[0-9][a-zA-Z0-9_ .()-]*$' OR p.title=regexp_replace(p.original_filename,'\.[^.]+$','')) THEN p_title ELSE p.title END,
tags=CASE WHEN to_jsonb(p.tags) IS NOT DISTINCT FROM j.snapshot->'tags' AND (j.mode='regenerate' OR cardinality(p.tags)=0) THEN p_tags ELSE p.tags END,
notes=CASE WHEN p.notes IS NOT DISTINCT FROM j.snapshot->>'notes' AND (j.mode='regenerate' OR coalesce(p.notes,'')='') THEN p_notes ELSE p.notes END WHERE id=p_id;
UPDATE public.book_analysis_jobs SET status='done',finished_at=now(),error_message=NULL WHERE production_id=p_id;
INSERT INTO public.activity_logs(action_type,user_id,recipient_email,details) SELECT 'book_image_analyzed',j.requested_by,'',jsonb_build_object('production_id',p_id,'run_id',p_run,'before',before_value,'after',jsonb_build_object('title',title,'tags',tags,'notes',notes)) FROM public.book_productions WHERE id=p_id;
END $$;
CREATE OR REPLACE FUNCTION public.resume_book_analysis() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF auth.uid() IS NULL OR NOT public.has_module_access(auth.uid(),'book') THEN RAISE EXCEPTION 'Accès Book requis'; END IF;
UPDATE public.book_analysis_control SET pause_reason=NULL,resume_after=NULL WHERE id=true;
INSERT INTO public.activity_logs(action_type,user_id,recipient_email,details) VALUES('book_analysis_resumed',auth.uid(),'','{}'::jsonb);
END $$;
CREATE OR REPLACE FUNCTION public.book_metadata_manual_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF auth.uid() IS NOT NULL THEN
IF NEW.title IS DISTINCT FROM OLD.title THEN NEW.title_manual=true; END IF;
IF (NEW.title,NEW.tags,NEW.notes) IS DISTINCT FROM (OLD.title,OLD.tags,OLD.notes) THEN INSERT INTO public.activity_logs(action_type,user_id,recipient_email,details) VALUES('book_metadata_edited',auth.uid(),'',jsonb_build_object('production_id',NEW.id,'before',jsonb_build_object('title',OLD.title,'tags',OLD.tags,'notes',OLD.notes),'after',jsonb_build_object('title',NEW.title,'tags',NEW.tags,'notes',NEW.notes))); END IF;
END IF; RETURN NEW; END $$;