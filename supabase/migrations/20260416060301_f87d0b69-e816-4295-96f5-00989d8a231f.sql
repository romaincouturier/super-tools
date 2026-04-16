UPDATE email_templates
SET html_content = 'Bonjour{{#sponsor_first_name}} {{sponsor_first_name}}{{/sponsor_first_name}},

J''espère que vous allez bien ! Je me permets de vous contacter en vue de la formation "{{training_name}}" prévue le {{training_date}} dans vos locaux.

Afin de garantir les meilleures conditions d''apprentissage pour tous les participants, pourriez-vous me confirmer la mise à disposition des éléments suivants :

🏢 Salle et mobilier
• 1 salle pour accueillir tous les participants + moi
• Autant de chaises que de participants + 1 pour moi
• Plusieurs tables en partant du principe que 1 table = 4 personnes
• Je dois pouvoir faire le tour de chacune des tables
• Les tables et les chaises sont mobiles
• 1 petite table pour pouvoir poser mon matériel
• Le moins de meubles possibles pour favoriser la circulation des personnes
• Des murs libres pour afficher les paperboard

☕ Accueil et confort
• Un buffet d''accueil et pour toute la journée (eau, fruits, amandes, noix, noisette, café, thé)

📋 Matériel
• 1 tableau Paper board
• 1 recharge papier paperboard
• 1 rame de feuilles A4 blanches
• 1 vidéoprojecteur avec connectique HDMI

📱 Accès et contact
• Le nom et numéro de mobile de la personne à contacter pour accéder aux locaux et en cas de problème à mon arrivée

Merci beaucoup pour votre aide ! N''hésitez pas à me contacter si vous avez la moindre question.',
    updated_at = now()
WHERE template_type = 'logistics_requirements_vous';

UPDATE email_templates
SET html_content = 'Bonjour{{#sponsor_first_name}} {{sponsor_first_name}}{{/sponsor_first_name}},

J''espère que tu vas bien ! Je me permets de te contacter en vue de la formation "{{training_name}}" prévue le {{training_date}} dans tes locaux.

Afin de garantir les meilleures conditions d''apprentissage pour tous les participants, pourrais-tu me confirmer la mise à disposition des éléments suivants :

🏢 Salle et mobilier
• 1 salle pour accueillir tous les participants + moi
• Autant de chaises que de participants + 1 pour moi
• Plusieurs tables en partant du principe que 1 table = 4 personnes
• Je dois pouvoir faire le tour de chacune des tables
• Les tables et les chaises sont mobiles
• 1 petite table pour pouvoir poser mon matériel
• Le moins de meubles possibles pour favoriser la circulation des personnes
• Des murs libres pour afficher les paperboard

☕ Accueil et confort
• Un buffet d''accueil et pour toute la journée (eau, fruits, amandes, noix, noisette, café, thé)

📋 Matériel
• 1 tableau Paper board
• 1 recharge papier paperboard
• 1 rame de feuilles A4 blanches
• 1 vidéoprojecteur avec connectique HDMI

📱 Accès et contact
• Le nom et numéro de mobile de la personne à contacter pour accéder aux locaux et en cas de problème à mon arrivée

Merci beaucoup pour ton aide ! N''hésite pas à me contacter si tu as la moindre question.',
    updated_at = now()
WHERE template_type = 'logistics_requirements_tu';