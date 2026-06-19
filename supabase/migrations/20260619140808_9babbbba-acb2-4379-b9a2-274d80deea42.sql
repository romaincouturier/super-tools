UPDATE email_templates
SET html_content = 'Bonjour {{recipient_name}},

Merci pour votre demande concernant la formation "{{formation_name}}".

{{#programme_link}}
Le programme de la formation est disponible en consultation et téléchargement <a href="{{programme_link}}" style="color:#1a73e8;text-decoration:underline;">ici</a>.
{{/programme_link}}

Vous trouverez en pièces jointes :

{{devis_description}}

{{signature_block}}

N''hésitez pas à revenir vers nous si vous avez la moindre question. Nous sommes à votre disposition pour vous accompagner dans votre projet de formation.

À très bientôt,'
WHERE template_type = 'micro_devis_vous';

UPDATE email_templates
SET html_content = 'Bonjour {{recipient_name}},

Merci pour ta demande concernant la formation "{{formation_name}}".

{{#programme_link}}
Le programme de la formation est disponible en consultation et téléchargement <a href="{{programme_link}}" style="color:#1a73e8;text-decoration:underline;">ici</a>.
{{/programme_link}}

Tu trouveras en pièces jointes :

{{devis_description}}

{{signature_block}}

N''hésite pas à revenir vers nous si tu as la moindre question. Nous sommes à ta disposition pour t''accompagner dans ton projet de formation.

À très bientôt,'
WHERE template_type = 'micro_devis_tu';