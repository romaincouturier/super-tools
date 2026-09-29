UPDATE public.email_templates
SET html_content = regexp_replace(
      regexp_replace(
        regexp_replace(html_content, 'https?://docs\.google\.com/forms[^[:space:]<]*', '', 'gi'),
        'https?://forms\.gle/[^[:space:]<]*',
        CASE WHEN template_type IN ('cold_evaluation_tu', 'cold_evaluation_vous') THEN '{{evaluation_link}}' ELSE '' END,
        'gi'
      ),
      'https?://goo\.gl/forms/[^[:space:]<]*',
      CASE WHEN template_type IN ('cold_evaluation_tu', 'cold_evaluation_vous') THEN '{{evaluation_link}}' ELSE '' END,
      'gi'
    ),
    updated_at = now()
WHERE html_content ~* '(docs\.google\.com/forms|forms\.gle|goo\.gl/forms)';

UPDATE public.post_evaluation_emails
SET html_content = regexp_replace(
      regexp_replace(
        regexp_replace(html_content, 'https?://docs\.google\.com/forms[^[:space:]<]*', '', 'gi'),
        'https?://forms\.gle/[^[:space:]<]*', '', 'gi'
      ),
      'https?://goo\.gl/forms/[^[:space:]<]*', '', 'gi'
    ),
    updated_at = now()
WHERE html_content ~* '(docs\.google\.com/forms|forms\.gle|goo\.gl/forms)';