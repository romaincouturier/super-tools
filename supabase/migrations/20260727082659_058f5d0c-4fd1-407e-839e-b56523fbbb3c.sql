UPDATE public.email_templates
SET html_content = $$Bonjour{{#first_name}} {{first_name}}{{/first_name}},
Tu es inscrit(e) à la formation "{{training_name}}"{{#training_date}} qui aura lieu le {{training_date}}{{/training_date}}.
{{#no_date}}
Les dates de ta formation ne sont pas encore fixées. Serais-tu disponible cette semaine pour un échange de quelques minutes afin de définir ensemble les dates qui te conviennent ? N'hésite pas à me proposer plusieurs créneaux.
{{/no_date}}
Afin de personnaliser au mieux cette formation, je t'invite à remplir ce court questionnaire de recueil des besoins :
{{questionnaire_link}}

Ce questionnaire me permettra de mieux comprendre tes attentes et d'adapter le contenu de la formation à tes besoins spécifiques.
Je te remercie de le compléter{{#deadline_date}} avant le {{deadline_date}}{{/deadline_date}} dès que possible.
À très bientôt !$$,
    updated_at = now()
WHERE template_type = 'needs_survey_tu';

UPDATE public.email_templates
SET html_content = $$Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Vous êtes inscrit(e) à la formation "{{training_name}}"{{#training_date}} qui aura lieu le {{training_date}}{{/training_date}}.
{{#no_date}}
Les dates de votre formation ne sont pas encore fixées. Seriez-vous disponible cette semaine pour un échange de quelques minutes afin de définir ensemble les dates qui vous conviennent ? N'hésitez pas à me proposer plusieurs créneaux.
{{/no_date}}
Afin de personnaliser au mieux cette formation, je vous invite à remplir ce court questionnaire de recueil des besoins :
{{questionnaire_link}}

Ce questionnaire me permettra de mieux comprendre vos attentes et d'adapter le contenu de la formation à vos besoins spécifiques.

Je vous remercie de le compléter{{#deadline_date}} avant le {{deadline_date}}{{/deadline_date}} dès que possible.

À très bientôt !$$,
    updated_at = now()
WHERE template_type = 'needs_survey_vous';