-- Bascule de la refonte de connexion apprenant.
-- Référence : docs/SPEC_CONNEXION_APPRENANT.md chapitre 17.
--
-- CE SCRIPT N'EST PAS UNE MIGRATION. Il ne s'applique pas au déploiement :
-- il se joue à la main, le jour de la bascule, une fois les lots 1 à 5
-- déployés et vérifiés. Il invalide les liens d'accès en circulation.
--
-- Pourquoi : les liens émis avant la refonte vivent un an et sont
-- réutilisables. Tant qu'ils vivent, la trajectoire de reprise de compte
-- reste ouverte (S1 de docs/AUDIT_SURFACES_EXPOSEES.md).
--
-- Ce que voit un apprenant qui clique ensuite sur un vieux lien : l'écran
-- « Ce lien a déjà servi », avec l'envoi d'un lien neuf en une action.

-- ── 1. Avant : mesurer ──────────────────────────────────────────────────────
-- À jouer d'abord, pour dimensionner l'email de reprise.
SELECT
  count(*)                          AS jetons_encore_valides,
  count(DISTINCT lower(email))      AS apprenants_concernes,
  min(expires_at)                   AS plus_proche_expiration,
  max(expires_at)                   AS plus_lointaine_expiration
FROM public.learner_magic_links
WHERE used_at IS NULL
  AND expires_at > now();

-- ── 2. Bascule : invalider ──────────────────────────────────────────────────
-- Seuls les jetons de l'ancien régime sont visés : ceux qui expirent
-- au-delà de 30 jours. Les liens émis par la nouvelle chaîne valent 30
-- minutes ou 7 jours, ils ne sont pas touchés et continuent de fonctionner.
UPDATE public.learner_magic_links
SET used_at = now()
WHERE used_at IS NULL
  AND expires_at > now() + interval '30 days';

-- ── 3. Après : vérifier ─────────────────────────────────────────────────────
-- Doit renvoyer 0.
SELECT count(*) AS jetons_ancien_regime_restants
FROM public.learner_magic_links
WHERE used_at IS NULL
  AND expires_at > now() + interval '30 days';

-- ── 4. Ensuite ──────────────────────────────────────────────────────────────
-- Envoyer l'email de reprise (texte E-E du chapitre 11 de la spécification)
-- aux apprenants actifs, puis surveiller pendant sept jours le volume
-- d'envois de liens et les tickets support (chapitre 17.3).
