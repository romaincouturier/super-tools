-- Update micro-devis email templates:
-- 1. Hide the raw programme URL by making "ici" a hyperlink (instead of showing {{programme_link}} as plain text).
-- 2. Insert {{signature_block}} placeholder so the e-signature CTA is rendered when tokens are available.

UPDATE email_templates
SET html_content = 'Bonjour {{recipient_name}},

Merci pour votre demande concernant la formation "{{formation_name}}".

Vous trouverez en pièces jointes :

{{devis_description}}

{{signature_block}}

{{#programme_link}}
Le programme de la formation est disponible en consultation et téléchargement <a href="{{programme_link}}" style="color:#1a73e8;text-decoration:underline;">ici</a>.
{{/programme_link}}

N''hésitez pas à revenir vers nous si vous avez la moindre question. Nous sommes à votre disposition pour vous accompagner dans votre projet de formation.

À très bientôt,'
WHERE template_type = 'micro_devis_vous';

UPDATE email_templates
SET html_content = 'Bonjour {{recipient_name}},

Merci pour ta demande concernant la formation "{{formation_name}}".

Tu trouveras en pièces jointes :

{{devis_description}}

{{signature_block}}

{{#programme_link}}
Le programme de la formation est disponible en consultation et téléchargement <a href="{{programme_link}}" style="color:#1a73e8;text-decoration:underline;">ici</a>.
{{/programme_link}}

N''hésite pas à revenir vers nous si tu as la moindre question. Nous sommes à ta disposition pour t''accompagner dans ton projet de formation.

À très bientôt,'
WHERE template_type = 'micro_devis_tu';