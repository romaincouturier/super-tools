-- Correction ponctuelle des 29 comptes sans ligne user_security_metadata.
-- PRÉPARÉE, NON EXÉCUTÉE : à jouer seulement après accord explicite de Romain.
-- Effet de password_set :
--   true  -> les mails d'ajout disent « Votre accès à la formation est ouvert ».
--   false -> les mails d'ajout disent « Créez votre mot de passe », et une
--            session déjà ouverte est envoyée sur l'écran de création du mot de
--            passe en entrant dans l'espace apprenant (jamais le back-office,
--            jamais le changement forcé, qui dépend de must_change_password).

-- 1. Mot de passe prouvé ou choisi à l'inscription -> true
INSERT INTO public.user_security_metadata (user_id, password_set)
SELECT u.id, true
FROM auth.users u
LEFT JOIN public.user_security_metadata m ON m.user_id = u.id
WHERE m.user_id IS NULL
  AND lower(u.email) IN (
    -- comptes internes / admin, traités à part : jamais false
    'romain@supertilt.fr',
    'couturier.romain@gmail.com',
    'emma.marceau@gmail.com',
    -- connexion par mot de passe réussie (login_attempts)
    'anita.bardy@orange.fr',
    -- inscriptions avec mot de passe choisi (connexion à la création)
    'severinerenaud78@gmail.com',
    'laurent.broyer@apicil.com',
    'marine@msconseils.org',
    'mjudeaux@yahoo.com',
    'test@test.com'
  );

-- 2. Tous les autres (époque du lien magique, aucun mot de passe prouvé) -> false
INSERT INTO public.user_security_metadata (user_id, password_set)
SELECT u.id, false
FROM auth.users u
LEFT JOIN public.user_security_metadata m ON m.user_id = u.id
WHERE m.user_id IS NULL
  AND lower(u.email) IN (
    'wysocki.valeriane@ladapt.net',
    'gabriela.stoica@charente-maritime.fr',
    'marina.rousguisto@gmail.com',
    'agnesg@etik.com',
    'sophie.bergaglio@gmail.com',
    'odile.lefranc-monsinjon@finances.gouv.fr',
    'gobbberliza@gmail.com',
    'n.foulonaudran@pm.me',
    'emilie.roupenel@live.fr',
    'guicherd.isabelle@orange.fr',
    'giraud.nico.ng@gmail.com',
    'muriel_meysen@yahoo.fr',
    'annaivacheff@gmail.com',
    'marilorbreton@yahoo.fr',
    'i.robert@ccfd-terresolidaire.org',
    'delphine@canevetetassocies.fr',
    'anna@gozmail.bzh',
    'christelle.loubriat@icloud.com',
    'emmanuelle.monrabal@acoss.fr',
    'anais.surmin@april.com'
  );

-- Contrôle attendu : 0
-- SELECT count(*) FROM auth.users u LEFT JOIN public.user_security_metadata m ON m.user_id = u.id WHERE m.user_id IS NULL;
