UPDATE email_templates
SET subject = 'Suivi de votre projet de {{title||prestation}}',
    html_content = '<p>Bonjour{{first_name? {{first_name}}}},</p><p>Je reviens vers vous concernant le devis que je vous ai transmis pour votre projet de {{title||prestation}}.</p><p>Je voulais m''assurer que vous aviez bien reçu tous les éléments et que tout était clair pour vous.</p><p>Je reste à votre disposition pour répondre à vos questions et vous aider à finaliser votre décision.</p><p>Bonne journée,</p>'
WHERE template_type = 'crm_relance_devis';