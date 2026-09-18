-- Bascule avant la démolition du lien magique (PR "démolition du lien
-- magique" de la refonte connexion). Se joue à la main, avant de fusionner
-- cette PR — elle supprime learner_magic_links.
--
-- CE SCRIPT N'EST PAS UNE MIGRATION.
--
-- Contrairement à la bascule précédente (scripts/bascule-connexion.sql), un
-- vieux lien reçu par email ne mène plus à une erreur technique : /connexion/
-- lien redirige vers /connexion (jamais de cul-de-sac), et "mot de passe
-- oublié" reste utilisable par n'importe quel compte, avec ou sans mot de
-- passe déjà défini. Rien ne bloque donc la fusion. Ce script mesure
-- seulement l'exposition, pour décider s'il faut prévenir les apprenants
-- concernés avant qu'ils ne remarquent d'eux-mêmes que l'ancien lien ne fait
-- plus rien.

-- ── 1. Combien de comptes dépendent encore d'un lien pour entrer ───────────
-- Un compte password_set = false n'a jamais utilisé "définir mon mot de
-- passe" ; sans lien, sa seule porte d'entrée devient "mot de passe oublié".
SELECT count(*) AS comptes_sans_mot_de_passe
FROM public.user_security_metadata
WHERE password_set = false;

-- ── 2. Combien avaient un lien encore valide (bientôt sans effet) ──────────
SELECT
  count(*)                     AS jetons_encore_valides,
  count(DISTINCT lower(email)) AS apprenants_concernes
FROM public.learner_magic_links
WHERE used_at IS NULL
  AND expires_at > now();

-- ── 3. Après la fusion : vérifier qu'aucun compte n'est réellement bloqué ──
-- Doit renvoyer 0 : "mot de passe oublié" doit rester joignable pour
-- l'échantillon issu de la requête 1 (à rejouer sur quelques adresses via
-- send-password-reset une fois déployé).

-- ── 4. Ensuite, à la discrétion du produit ──────────────────────────────────
-- Envoyer un email annonçant que les liens ne connectent plus, avec un lien
-- "définir mon mot de passe" (send-password-reset), aux comptes listés en 1 —
-- pas un prérequis à la fusion, seulement une prévenance.
