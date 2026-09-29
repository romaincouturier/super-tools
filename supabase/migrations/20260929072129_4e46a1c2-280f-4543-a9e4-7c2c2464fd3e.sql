CREATE OR REPLACE FUNCTION public.reject_google_forms_email_template()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF concat_ws(' ', NEW.subject, NEW.html_content) ~* '(docs\.google\.com/forms|forms\.gle|goo\.gl/forms)' THEN
    RAISE EXCEPTION 'Google Forms links are forbidden in email templates';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_google_forms_email_template() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_google_forms_email_template() TO service_role;

DROP TRIGGER IF EXISTS reject_google_forms_email_template ON public.email_templates;
CREATE TRIGGER reject_google_forms_email_template
BEFORE INSERT OR UPDATE OF subject, html_content ON public.email_templates
FOR EACH ROW EXECUTE FUNCTION public.reject_google_forms_email_template();

DROP TRIGGER IF EXISTS reject_google_forms_post_evaluation_email ON public.post_evaluation_emails;
CREATE TRIGGER reject_google_forms_post_evaluation_email
BEFORE INSERT OR UPDATE OF subject, html_content ON public.post_evaluation_emails
FOR EACH ROW EXECUTE FUNCTION public.reject_google_forms_email_template();