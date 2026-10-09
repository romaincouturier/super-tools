UPDATE public.email_templates
SET html_content = replace(html_content, '👉 Remplir le questionnaire : https://forms.gle/Hm4TvAVUSvzuWeBJ6', '{{evaluation_link}}'),
    updated_at = now()
WHERE template_type IN ('cold_evaluation_tu', 'cold_evaluation_vous')
  AND html_content LIKE '%https://forms.gle/Hm4TvAVUSvzuWeBJ6%';