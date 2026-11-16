ALTER TABLE public.admin_documents ADD COLUMN IF NOT EXISTS valid_until date, ADD COLUMN IF NOT EXISTS storage_path text, ADD COLUMN IF NOT EXISTS source_gmail_message_id text;
CREATE INDEX IF NOT EXISTS admin_documents_valid_until_idx ON public.admin_documents(valid_until) WHERE valid_until IS NOT NULL;
CREATE OR REPLACE FUNCTION public.audit_company_archive_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 INSERT INTO public.activity_logs(action_type,user_id,details) VALUES ('company_document_archived',auth.uid(),jsonb_build_object('document_id',NEW.id,'file_name',NEW.file_name,'category',NEW.category,'valid_until',NEW.valid_until,'gmail_message_id',NEW.source_gmail_message_id));
 RETURN NEW;
END; $$;
CREATE TRIGGER company_archive_insert_audit AFTER INSERT ON public.admin_documents FOR EACH ROW EXECUTE FUNCTION public.audit_company_archive_insert();