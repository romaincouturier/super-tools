-- Seed default CRM email templates into email_templates table.
-- These templates support variable placeholders: {{company}}, {{first_name}}, {{title}}
-- They will be loaded dynamically in the CRM CardDetailDrawer.

INSERT INTO email_templates (template_type, template_name, subject, html_content, is_default) VALUES
(
  'crm_relance_devis',
  'Relance devis',
  'Suivi de votre demande{{company? – {{company}}}}',
  '<p>Bonjour{{first_name? {{first_name}}}},</p><p>Je reviens vers vous concernant le devis que je vous ai transmis{{title? pour votre demande de {{title}}}}.</p><p>Je voulais m''assurer que vous aviez bien reçu tous les éléments et que tout était clair pour vous.</p><p>Je reste à votre disposition pour répondre à vos questions et vous aider à finaliser votre décision.</p><p>Bonne journée,</p>',
  true
),
(
  'crm_premier_contact',
  'Premier contact',
  '{{company?{{company}} – }}Prise de contact SuperTilt',
  '<p>Bonjour{{first_name? {{first_name}}}},</p><p>Je me permets de vous contacter suite à votre demande concernant {{title||notre offre de formation}}.</p><p>Je serais ravi(e) d''échanger avec vous pour mieux comprendre vos besoins et vous proposer la solution la plus adaptée.</p><p>Seriez-vous disponible pour un appel de 15 minutes cette semaine ?</p><p>Bonne journée,</p>',
  true
),
(
  'crm_envoi_devis',
  'Envoi de devis',
  'Votre devis{{company? – {{company}}}}',
  '<p>Bonjour{{first_name? {{first_name}}}},</p><p>Suite à notre échange, veuillez trouver ci-joint votre devis pour {{title||la prestation demandée}}.</p><p>Ce document détaille l''ensemble des éléments convenus. N''hésitez pas à me revenir si vous souhaitez apporter des ajustements.</p><p>Dans l''attente de votre retour,</p>',
  true
),
(
  'crm_confirmation_formation',
  'Confirmation de formation',
  'Confirmation de votre inscription{{company? – {{company}}}}',
  '<p>Bonjour{{first_name? {{first_name}}}},</p><p>Je suis ravi(e) de confirmer votre participation à {{title||la formation}}.</p><p>Vous recevrez prochainement tous les documents nécessaires (convention, programme, modalités pratiques).</p><p>En attendant, n''hésitez pas à me contacter pour toute question.</p><p>À très bientôt,</p>',
  true
)
ON CONFLICT DO NOTHING;
