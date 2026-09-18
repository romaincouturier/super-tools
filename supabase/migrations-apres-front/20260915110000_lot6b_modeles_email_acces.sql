-- Modèles d'email d'accès : alignement sur la nouvelle chaîne de connexion.
-- Le lien ouvre désormais une session, il n'y a plus de mot de passe à créer,
-- et sa durée est de 7 jours à usage unique (RG-06, RG-15).
-- Remplacements ciblés : les personnalisations faites ailleurs dans les
-- modèles sont préservées, et rejouer la migration ne change plus rien.

-- ── Étape « crée ton mot de passe » ─────────────────────────────────────────
UPDATE public.email_templates
SET html_content = replace(
      html_content,
      '<li>Crée ton mot de passe (ou connecte-toi si tu as déjà un compte)</li>',
      '<li>Tu es connecté automatiquement, sans mot de passe à créer</li>'
    )
WHERE template_type IN ('elearning_magic_link_tu', 'elearning_start_reminder_tu');

UPDATE public.email_templates
SET html_content = replace(
      html_content,
      '<li>Créez votre mot de passe (ou connectez-vous si vous avez déjà un compte)</li>',
      '<li>Vous êtes connecté automatiquement, sans mot de passe à créer</li>'
    )
WHERE template_type IN ('elearning_magic_link_vous', 'elearning_start_reminder_vous');

-- ── Durée de validité annoncée ──────────────────────────────────────────────
UPDATE public.email_templates
SET html_content = replace(
      html_content,
      'Ce lien est personnel, valable <strong>1 an</strong> et réutilisable autant de fois que nécessaire pendant cette période. Au-delà, connecte-toi directement depuis ton espace apprenant.',
      'Ce lien est personnel, valable <strong>7 jours</strong> et utilisable une seule fois. Passé ce délai, rends-toi sur la page de connexion : nous t''en enverrons un nouveau en quelques secondes.'
    )
WHERE template_type = 'elearning_magic_link_tu';

UPDATE public.email_templates
SET html_content = replace(
      html_content,
      'Ce lien est personnel, valable <strong>1 an</strong> et réutilisable autant de fois que nécessaire pendant cette période. Au-delà, connectez-vous directement depuis votre espace apprenant.',
      'Ce lien est personnel, valable <strong>7 jours</strong> et utilisable une seule fois. Passé ce délai, rendez-vous sur la page de connexion : nous vous en enverrons un nouveau en quelques secondes.'
    )
WHERE template_type = 'elearning_magic_link_vous';

UPDATE public.email_templates
SET html_content = replace(
      html_content,
      'Ce lien est personnel, valable 1 an et réutilisable autant de fois que nécessaire pendant cette période.',
      'Ce lien est personnel, valable 7 jours et utilisable une seule fois. Passé ce délai, rends-toi sur la page de connexion : nous t''en enverrons un nouveau en quelques secondes.'
    )
WHERE template_type = 'elearning_start_reminder_tu';

UPDATE public.email_templates
SET html_content = replace(
      html_content,
      'Ce lien est personnel, valable 1 an et réutilisable autant de fois que nécessaire pendant cette période.',
      'Ce lien est personnel, valable 7 jours et utilisable une seule fois. Passé ce délai, rendez-vous sur la page de connexion : nous vous en enverrons un nouveau en quelques secondes.'
    )
WHERE template_type = 'elearning_start_reminder_vous';
