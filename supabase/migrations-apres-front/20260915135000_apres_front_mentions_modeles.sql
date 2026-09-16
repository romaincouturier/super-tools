-- À NE PAS APPLIQUER AVANT LA PUBLICATION DU FRONT.
-- Référence : docs/AUDIT_AVANT_PUSH.md, écart A2.
--
-- Ajoute aux modèles d'email la mention de la création automatique du compte et
-- du moyen d'en demander la suppression (critère 23, RG-22).
--
-- Pourquoi ce fichier attend : les modèles sont lus par des fonctions déjà
-- déployées. Tant que le front en ligne demande un mot de passe sur la page
-- d'arrivée, un email annonçant le contraire fait mentir le produit.

-- Ajoutée à la suite du bloc sur la durée de validité, en tutoiement ou
-- vouvoiement selon le modèle. Rejouable : la mention n'est ajoutée qu'une fois.
UPDATE public.email_templates
SET html_content = html_content || E'\n\n<p style="font-size: 13px; color: #666;">Un espace apprenant a été créé avec ton adresse email pour te donner accès à ta formation. Tes données sont traitées par SuperTilt à cette seule fin. Pour demander la suppression de ton compte, écris-nous à contact@supertilt.fr.</p>'
WHERE template_type IN ('elearning_magic_link_tu', 'elearning_start_reminder_tu')
  AND html_content NOT LIKE '%demander la suppression de ton compte%';

UPDATE public.email_templates
SET html_content = html_content || E'\n\n<p style="font-size: 13px; color: #666;">Un espace apprenant a été créé avec votre adresse email pour vous donner accès à votre formation. Vos données sont traitées par SuperTilt à cette seule fin. Pour demander la suppression de votre compte, écrivez-nous à contact@supertilt.fr.</p>'
WHERE template_type IN ('elearning_magic_link_vous', 'elearning_start_reminder_vous')
  AND html_content NOT LIKE '%demander la suppression de votre compte%';
