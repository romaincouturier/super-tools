# Mails d'accès apprenant : bon mail selon l'état réel du compte

## Constats vérifiés (lecture seule)

- Un seul modèle aujourd'hui, `learner_access`, à deux variantes, choisies par la RPC `learner_password_set` : `password_set=false` -> « Créez votre mot de passe » ; `true` **ou absence de ligne** -> « Accéder à votre espace » + lien `/connexion`.
- **29 comptes sans ligne de sécurité** (aucun `password_set`).
  - 24 créés avant le 19/09 (époque du lien magique).
  - 5 créés après : test@test.com, severinerenaud78, laurent.broyer, marine@msconseils, mjudeaux (03/11). Tous connectés **à la seconde même de leur création**, sans prénom en métadonnées : ce sont des inscriptions où la personne choisit son mot de passe (pages `Signup`/`Auth` via `signUp`, ou ancienne version de `create-academy-account`). **Aucun de ces chemins n'écrit la ligne de sécurité.** C'est la cause racine : ces comptes ont bien un mot de passe, mais rien ne l'enregistre.
- Le mot de passe stocké côté authentification n'est pas un indicateur fiable (les 427 comptes `false` en ont un aussi, généré automatiquement), et le journal d'authentification hébergé est vide. Seule preuve exploitable : `login_attempts.success = true` (connexion **par mot de passe** via le formulaire).
- Parmi les 29 : connexions par mot de passe réussies uniquement pour romain@supertilt.fr, emma.marceau et **anita.bardy (03/11 17:56:20, 7 min après le mail)**. Anita a donc un mot de passe qui fonctionne (défini avant que le drapeau existe) : elle ne doit **pas** recevoir de mail de création.
- Mauvais mail « Accéder à votre espace » reçu les 03-04/11 (hors comptes internes) : agnesg, gabriela.stoica (2x), gobbberliza (2x), anais.surmin, delphine (04/11 05:41), anita.bardy (déjà OK).
- Toutes les voies où l'apprenant **définit** un mot de passe appellent bien `mark_password_changed` (lien email `ConnexionReinitialisation`, `PasswordCreationCard`, `ResetPassword`, `ForcePasswordChange`) ; « mot de passe oublié » passe par `ConnexionReinitialisation`, donc OK. Les voies où il le **choisit à l'inscription** ne l'appellent pas.
- `send-elearning-access` n'est plus appelée par l'interface ni par une autre fonction ; seule `sendElearningAccess` (service front, jamais importé) et les listes de surveillance la mentionnent.

## Ajouté

- Modèle éditable **`learner_course_access`** (tu/vous), visible dans Paramètres -> Emails : objet « Votre accès à « {{training_name}} » est ouvert », bouton « Accéder à ma formation » avec **lien direct vers le cours LMS** lié à la formation (`trainings.supports_lms_course_id` / `lms_courses`), à défaut l'espace apprenant ; rappel de connexion par mot de passe et lien « mot de passe oublié ». BCC et signature habituels.
- Phrase « la plateforme a changé » dans la variante création de mot de passe de `learner_access`, avec le nom de la formation.
- Helper pur `decideLearnerAccessEmail(état)` + tests, une règle par cas :

```text
pas de compte                 -> créer le compte + « Créez votre mot de passe » (avec formation)
password_set = true           -> learner_course_access, lien direct vers le cours
password_set = false          -> « Créez votre mot de passe » + formation + « la plateforme a changé »
pas de ligne de sécurité      -> comme password_set = false
```

- Bilan de l'import en lot : comptes créés / accès confirmés / échecs (un seul mail par personne, déjà dédoublonné par email).

## Transformé

- RPC de détection : renvoie `exists` + `password_set` ; **absence de ligne = pas de mot de passe** (suppression du `COALESCE(..., true)`). Service-role uniquement, rien d'exposé au navigateur.
- Tous les chemins utilisent la règle : ajout unitaire (`add-training-participant`, qui transmet enfin le nom de la formation et l'id du cours), lot, MCP (`lms-enrollment-tools`), bouton « Renvoyer l'accès » et repositionnement (`send-learner-access-email`).
- **Cause racine** : `create-academy-account` écrit `password_set=true` après création ; les pages `Signup` et `Auth` (inscription avec mot de passe) appellent `mark_password_changed` après `signUp`. Option plus sûre à valider : trigger applicatif sur la création de compte qui crée systématiquement la ligne (`false` par défaut), les chemins avec mot de passe la passant à vrai.
- Correction ponctuelle des 29 comptes (requête proposée, **non exécutée**) :

```sql
-- Comptes avec connexion par mot de passe prouvée -> mot de passe défini
INSERT INTO user_security_metadata (user_id, password_set)
SELECT u.id, true FROM auth.users u
LEFT JOIN user_security_metadata m ON m.user_id = u.id
WHERE m.user_id IS NULL
  AND EXISTS (SELECT 1 FROM login_attempts l
              WHERE lower(l.email) = lower(u.email) AND l.success);
-- concerne romain@supertilt.fr, emma.marceau, anita.bardy

-- Les 5 inscriptions avec mot de passe post-19/09 -> mot de passe défini
-- (liste nominative, à confirmer : severinerenaud78, laurent.broyer,
--  marine@msconseils, mjudeaux ; test@test.com à supprimer plutôt)

-- Tous les autres -> sans mot de passe
INSERT INTO user_security_metadata (user_id, password_set)
SELECT u.id, false FROM auth.users u
LEFT JOIN user_security_metadata m ON m.user_id = u.id
WHERE m.user_id IS NULL;
```

  Comptes admin/staff (romain@supertilt.fr, couturier.romain) à traiter à part : vérifier le rôle avant, ne jamais leur forcer `false` s'ils se connectent au back-office.

## Supprimé

- La valeur par défaut « absence de ligne = mot de passe défini ».
- Aucun filet « déjà connecté = mot de passe défini » (une connexion par lien magique ne prouve rien).
- La fonction `send-elearning-access`, le service front inutilisé `sendElearningAccess` et ses entrées de surveillance (suppression du déploiement après merge).

## Rattrapage (après correction et accord)

Renvoyer « Créez votre mot de passe » (avec formation) à : **delphine@canevetetassocies.fr, gabriela.stoica@charente-maritime.fr, gobbberliza@gmail.com, agnesg@etik.com, anais.surmin@april.com**.
Exclus : anita.bardy (connectée par mot de passe le 03/11 à 17:56), romain@supertilt.fr, emma.marceau. Juste avant l'envoi, revérifier `login_attempts` de chacun ; envoi par l'outil admin (sans quota), traçé.

## Présentiel ou mixte avec contenus en ligne (à décider)

Workflow actuel constaté :
- Ajout d'un participant : déclencheur base qui l'**inscrit au cours LMS** si la session a un cours de supports (`supports_lms_course_id`) — inscription seule, **aucun compte créé, aucun mail d'accès**.
- Mails : questionnaire de besoins, convocation (immédiate si J-7 à J-2 ou en cours, sinon programmée J-7) contenant un lien secondaire « Accéder au e-learning de la formation » vers les supports (avec `?email=`), émargement, puis séquence post-formation.
- Si un contenu en ligne est rattaché plus tard : `send-elearning-available` prévient les participants une fois par support.
- Résultat : le participant arrive sur l'espace apprenant sans compte ni mot de passe et doit passer par « première connexion ».

Recommandation : créer le compte à l'ajout (silencieux) et **ne pas envoyer de mail séparé** ; intégrer dans la convocation un bloc conditionnel « Créez votre mot de passe » ou « Votre accès est ouvert » selon la même règle. Exception : contenu à suivre avant la session (pré-requis) -> envoyer le mail d'accès à l'ajout. Après la session, `send-elearning-available` suffit pour les contenus ajoutés.

## Détails techniques

- Fichiers : `_shared/learner-account.ts`, `_shared/editable-email-defaults.ts`, `settingsConstants.ts`, `emailVariableDocs.ts`, `add-training-participant`, `send-learner-access-email`, `_shared/lms-enrollment-tools.ts`, `bulkParticipants.ts`, `BulkAddParticipantsDialog.tsx`, `create-academy-account`, `Signup.tsx`, `Auth.tsx`, migration RPC (+ trigger éventuel).
- Tests : helper de décision (4 cas), RPC (absence de ligne = false), bilan du lot.
- Redéploiements : `add-training-participant`, `send-learner-access-email`, `create-academy-account`, `mcp-server` ; suppression de `send-elearning-access`.
- Sécurité : RPC service-role, aucune révélation d'existence de compte, aucun lien qui ouvre une session.
