ALTER TABLE public.book_productions ADD COLUMN title_manual boolean NOT NULL DEFAULT false;
CREATE FUNCTION public.book_metadata_manual_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF auth.uid() IS NOT NULL THEN
IF NEW.title IS DISTINCT FROM OLD.title THEN NEW.title_manual=true; END IF;
IF (NEW.title,NEW.tags,NEW.notes) IS DISTINCT FROM (OLD.title,OLD.tags,OLD.notes) THEN INSERT INTO public.activity_logs(action_type,user_id,details) VALUES('book_metadata_edited',auth.uid(),jsonb_build_object('production_id',NEW.id,'before',jsonb_build_object('title',OLD.title,'tags',OLD.tags,'notes',OLD.notes),'after',jsonb_build_object('title',NEW.title,'tags',NEW.tags,'notes',NEW.notes))); END IF;
END IF; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.book_metadata_manual_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER book_metadata_manual_guard BEFORE UPDATE OF title,tags,notes ON public.book_productions FOR EACH ROW EXECUTE FUNCTION public.book_metadata_manual_guard();
CREATE OR REPLACE FUNCTION public.claim_book_analysis(p_run uuid) RETURNS SETOF public.book_analysis_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE c public.book_analysis_control; BEGIN
INSERT INTO public.book_analysis_control(id) VALUES(true) ON CONFLICT DO NOTHING;
SELECT * INTO c FROM public.book_analysis_control WHERE id=true FOR UPDATE;
IF c.lease_until>now() OR (c.pause_reason IS NOT NULL AND (c.resume_after IS NULL OR c.resume_after>now())) THEN RETURN; END IF;
UPDATE public.book_analysis_jobs SET status='error',error_message='Traitement interrompu : résultat IA inconnu, régénération manuelle requise',finished_at=now() WHERE status='processing';
UPDATE public.book_analysis_control SET lease_id=p_run,lease_until=now()+interval '10 minutes',pause_reason=NULL,resume_after=NULL WHERE id=true;
RETURN QUERY WITH batch AS (SELECT j.production_id FROM public.book_analysis_jobs j WHERE j.status='pending' ORDER BY (j.mode='regenerate') DESC,j.created_at DESC LIMIT 3 FOR UPDATE SKIP LOCKED) UPDATE public.book_analysis_jobs j SET status='processing',run_id=p_run,snapshot=jsonb_build_object('title',p.title,'tags',p.tags,'notes',p.notes) FROM batch b,public.book_productions p WHERE j.production_id=b.production_id AND p.id=j.production_id RETURNING j.*;
END $$;
CREATE FUNCTION public.book_analysis_title_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
IF OLD.title_manual AND auth.uid() IS NULL AND NEW.title IS DISTINCT FROM OLD.title THEN NEW.title=OLD.title; END IF;
RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.book_analysis_title_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER book_analysis_title_guard BEFORE UPDATE OF title ON public.book_productions FOR EACH ROW EXECUTE FUNCTION public.book_analysis_title_guard();