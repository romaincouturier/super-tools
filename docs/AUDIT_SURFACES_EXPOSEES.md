# Inventaire des surfaces exposées, préalable à la spécification d'autorisation

Date : 2026-09-14. Périmètre : accès aux données apprenant hors back-office staff.
Ce document ne propose pas de correctif. Il établit ce qui est exposé, par quel mécanisme, et ce que cela permet.

## 1. Le constat central : l'identité apprenant est déclarée par le client

`get_learner_email()` est la fonction d'identité de tout le portail apprenant. Version en vigueur : `supabase/migrations/20260904081727_58e5c860-ce3a-4e89-8eeb-3011da08e00e.sql:4-34`.

Elle lit l'adresse dans cet ordre :

1. l'en-tête HTTP `x-learner-email`, posé par le navigateur (`src/integrations/supabase/client.ts:24-34`) ;
2. à défaut seulement, l'adresse du jeton d'authentification.

Puis elle vérifie que cette adresse existe comme participant, comme inscrit LMS, ou comme destinataire d'un lien déjà consommé. Si oui, elle la renvoie.

Conséquence directe : **l'en-tête prime sur le jeton**. Quiconque connaît l'adresse d'un apprenant, authentifié ou non, peut la poser dans l'en-tête et obtenir ses lignes. La vérification ne contrôle pas que l'appelant est cette personne, seulement que cette personne existe.

### Tables dont les policies reposent sur cette fonction

22 tables, soit l'intégralité des données personnelles d'un apprenant.

`coaching_bookings`, `learner_notifications`, `learner_profiles`, `lms_deposit_comments`, `lms_deposit_feedback`, `lms_deposit_reactions`, `lms_enrollments`, `lms_forum_posts`, `lms_lesson_comments`, `lms_page_views`, `lms_progress`, `lms_quiz_attempts`, `lms_submissions`, `lms_user_badges`, `lms_work_deposits`, `practice_poll_options`, `practice_poll_votes`, `practice_polls`, `practice_post_comments`, `practice_post_hashtags`, `practice_post_reactions`, `practice_posts`.

121 occurrences de `get_learner_email()` dans les migrations. Plusieurs de ces policies sont en écriture, pas seulement en lecture.

Historique utile : ces policies remplacent, depuis `20260321130000_fix_rls_anon_policies.sql`, des policies `FOR ALL TO anon USING (true) WITH CHECK (true)` qui laissaient tout le monde lire et écrire. Le correctif a resserré la surface sans changer la nature du problème : l'identité reste déclarative.

## 2. Fonctions exécutables par un appelant anonyme

26 fonctions `SECURITY DEFINER` sont ouvertes au rôle `anon`. Trois groupes.

**Groupe A, légitimes, protégées par un jeton non devinable.** L'appelant présente un jeton à usage précis et la fonction ne renvoie que ce qui s'y rattache.
`get_attendance_by_token`, `mark_attendance_opened`, `get_mission_contact_by_token`, `get_mission_survey_by_token`, `get_training_survey_by_token`, `submit_training_survey`, `resolve_formulaire_token`, `check_formulaire_rate_limit`, `register_formulaire_orphan`.

**Groupe B, exposition de données publiques assumée.**
`get_public_contact`, `get_staff_public_profiles`, `get_active_vhd_procedure`, `get_training_public_info`, `get_participant_public_info`, `get_training_schedule_for_date`, `get_course_live_meetings`, `practice_popular_hashtags`, `is_signup_allowed`.
À vérifier au cas par cas : `get_participant_public_info` prend un identifiant de participant, `get_training_public_info` un identifiant de formation. Un identifiant n'est pas un secret.

**Groupe C, à fermer, identité passée en paramètre.**
- `get_learner_portal_data(text)` : renvoie formations, questionnaires et évaluations d'une adresse. Exécutable par `anon`. Connaître une adresse suffit.
- `get_learner_portal_training_details(text)` : même principe.
- `learner_evaluation_course_id(text, uuid)` : même principe.
- `preview_learner_token(text)` : renvoie l'adresse en clair et l'existence d'un compte.
- `validate_learner_token(text)`, `consume_learner_token(text)` : consomment un jeton sans authentification.

Références : `supabase/migrations/20260518220000_grant_learner_portal_functions.sql`, `supabase/migrations/20260518210000_preview_learner_token_has_account.sql`.

## 3. Policies ouvertes au rôle anonyme

Après les correctifs de mars et mai 2026, les policies `TO anon` restantes sont en lecture seule et scopées, sauf à vérifier :

- contenu LMS publié : `lms_courses` (statut publié), `lms_modules`, `lms_lessons`, `lms_quizzes`, `lms_quiz_questions`, `lms_assignments`, `lms_badges`, `lms_forums`, `lms_user_badges`. Un cours publié est donc lisible sans compte, y compris ses questions de quiz.
- supports de formation : `training_supports` (publiés), `training_support_sections`, `training_support_media`, et les buckets `lms-content` et `training-supports` en lecture publique.
- enquêtes mission : `mission_surveys` (actives), `mission_survey_questions` en lecture, `mission_survey_responses` et `mission_survey_answers` en insertion libre.

Point à trancher dans la spec d'autorisation : un cours publié doit-il rester lisible sans compte ? Aujourd'hui oui, et les fichiers du bucket `lms-content` sont publics.

## 4. Identités portées par l'URL

| Emplacement | Paramètre | Effet |
|-------------|-----------|-------|
| `src/pages/LmsCoursePlayer.tsx:46` | `?email=` | Identité de l'apprenant pour la lecture et l'écriture de progression |
| `src/pages/LearnerPortal.tsx` | `?preview_email=` | Prévisualisation staff, contrôlée par la présence d'un profil |
| `src/components/lms/LearnerCourseHeader.tsx:192-201`, `src/components/lms/CourseHomeSidebar.tsx:54-91` | `preview_email` propagé, `sessionStorage.learner_email` | L'adresse circule entre écrans par l'URL et le stockage de session |

`sessionStorage.learner_email` est écrit côté navigateur et relu comme source d'identité. Il est modifiable par l'utilisateur.

## 5. Ce que cela permet, concrètement

Avec la seule connaissance d'une adresse email d'apprenant, sans compte :

1. lire ses formations, questionnaires et évaluations via `get_learner_portal_data` ;
2. lire et écrire sa progression, ses dépôts de travaux, ses commentaires et ses réactions via l'en-tête `x-learner-email` sur 22 tables ;
3. consulter le contenu des cours publiés et les fichiers de leurs buckets.

Ces trois trajectoires sont indépendantes. Fermer l'une ne ferme pas les autres.

## 6. Ce que la spécification d'autorisation devra trancher

1. Identité : passer de l'en-tête déclaratif à l'identifiant du compte authentifié, et rattacher ce compte à son adresse une fois pour toutes. 22 tables et 121 occurrences de policies à reprendre.
2. Contenu public : ce qui reste lisible sans compte, cours publiés et buckets compris.
3. Prévisualisation staff : mécanisme de remplacement, vérifié côté serveur.
4. Périmètre de partage entre apprenants d'une même session, pour la communauté et les dépôts.
5. Accès du commanditaire intra et du formateur, aujourd'hui non modélisés.
6. Ordre de reprise, la migration devant se faire sans interrompre les apprenants en cours de formation.

## 7. Méthode de reprise proposée

Le travail ne se découpe pas par table mais par source d'identité. Trois chantiers, dans cet ordre :

1. **Rendre l'identité vérifiable.** Le compte authentifié devient la seule source. `get_learner_email()` cesse de lire l'en-tête et se limite au jeton. Cette seule modification referme la trajectoire 2, sans toucher aux 121 policies. Prérequis : que tout apprenant ait un compte, ce que le lot 1 de la spécification de connexion garantit.
2. **Fermer les fonctions de portail au rôle anonyme**, trajectoire 1. Elles prennent l'identité du jeton au lieu d'un paramètre.
3. **Reprendre le contenu public**, trajectoire 3, qui est une décision métier avant d'être technique.

Les deux premiers chantiers sont mécaniques et mesurables. Le troisième demande un arbitrage.
