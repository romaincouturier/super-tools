DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.email_templates
    WHERE concat_ws(' ', subject, html_content) ~* '(docs\.google\.com/forms|forms\.gle|goo\.gl/forms)'
  ) OR EXISTS (
    SELECT 1 FROM public.post_evaluation_emails
    WHERE concat_ws(' ', subject, html_content) ~* '(docs\.google\.com/forms|forms\.gle|goo\.gl/forms)'
  ) THEN
    RAISE EXCEPTION 'Google Forms link remains in an email template';
  END IF;
END;
$$;