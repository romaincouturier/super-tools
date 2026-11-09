CREATE OR REPLACE FUNCTION public.audit_mcp_extension_write() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF NOT public.is_staff_user() THEN RAISE EXCEPTION 'Accès personnel requis' USING ERRCODE='42501'; END IF;
 IF TG_TABLE_NAME='lms_courses' AND OLD.cover_image_url IS NOT DISTINCT FROM NEW.cover_image_url THEN RETURN NEW; END IF;
 INSERT INTO public.activity_logs(action_type,recipient_email,user_id,details) VALUES('mcp_extension_record_updated',COALESCE(auth.jwt()->>'email','mcp'),auth.uid(),jsonb_build_object('table',TG_TABLE_NAME,'record_id',NEW.id,'before',CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,'after',to_jsonb(NEW)));
 RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.audit_mcp_extension_write() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER audit_watch_source_write AFTER INSERT OR UPDATE ON public.watch_sources FOR EACH ROW EXECUTE FUNCTION public.audit_mcp_extension_write();
CREATE TRIGGER audit_lms_cover_write AFTER UPDATE OF cover_image_url ON public.lms_courses FOR EACH ROW EXECUTE FUNCTION public.audit_mcp_extension_write();