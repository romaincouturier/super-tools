-- Add column to store e-learning access email content per training
ALTER TABLE public.trainings ADD COLUMN elearning_access_email_content TEXT NULL;

-- Add default e-learning access email template (tu/vous)
INSERT INTO public.email_templates (template_type, template_name, subject, html_content, is_default)
VALUES
  ('elearning_access_tu', 'Email d''accès e-learning (tutoiement)', 'Accès à ta formation e-learning "{{training_name}}"',
   'Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Tu es inscrit(e) à la formation e-learning "<strong>{{training_name}}</strong>".

Tu peux accéder à la formation en ligne à l''adresse suivante :
<p style="margin: 20px 0;"><a href="{{access_link}}" style="display: inline-block; padding: 12px 24px; background-color: #e6bc00; color: #000; text-decoration: none; border-radius: 6px; font-weight: bold;">🎓 Accéder à la formation</a></p>

La formation est accessible du <strong>{{start_date}}</strong> au <strong>{{end_date}}</strong>.

Si tu as la moindre question, n''hésite pas à me contacter.

Bonne formation !', true),
  ('elearning_access_vous', 'Email d''accès e-learning (vouvoiement)', 'Accès à votre formation e-learning "{{training_name}}"',
   'Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Vous êtes inscrit(e) à la formation e-learning "<strong>{{training_name}}</strong>".

Vous pouvez accéder à la formation en ligne à l''adresse suivante :
<p style="margin: 20px 0;"><a href="{{access_link}}" style="display: inline-block; padding: 12px 24px; background-color: #e6bc00; color: #000; text-decoration: none; border-radius: 6px; font-weight: bold;">🎓 Accéder à la formation</a></p>

La formation est accessible du <strong>{{start_date}}</strong> au <strong>{{end_date}}</strong>.

Si vous avez la moindre question, n''hésitez pas à me contacter.

Bonne formation !', true);