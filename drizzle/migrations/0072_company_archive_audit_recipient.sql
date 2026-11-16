CREATE OR REPLACE FUNCTION public.audit_company_archive_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 INSERT INTO public.activity_logs(action_type,user_id,recipient_email,details) VALUES ('company_document_archived',auth.uid(),coalesce(auth.jwt()->>'email','system'),jsonb_build_object('document_id',NEW.id,'file_name',NEW.file_name,'category',NEW.category,'valid_until',NEW.valid_until,'gmail_message_id',NEW.source_gmail_message_id));
 RETURN NEW;
END; $$;