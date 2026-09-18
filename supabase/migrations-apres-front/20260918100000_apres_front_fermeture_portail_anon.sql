-- Fermeture de l'accès anonyme aux fonctions de l'espace apprenant.
--
-- À JOUER APRÈS LA PUBLICATION DU FRONT, jamais avant.
--
-- Pourquoi : le front actuellement en ligne appelle ces trois fonctions avec
-- un client anonyme porteur de l'en-tête x-learner-email.
--   - get_learner_portal_data et get_learner_portal_training_details, depuis
--     LearnerPortal.tsx ;
--   - learner_evaluation_course_id, depuis LmsCoursePlayer.tsx.
-- Les révoquer avant la publication rend l'espace apprenant inaccessible, et
-- l'erreur est un refus de droits, sans message exploitable pour l'apprenant.
--
-- Le front de la refonte n'utilise plus aucun de ces appels en anonyme :
-- l'identité vient de la session. Une fois publié, ces révocations sont sans
-- effet sur l'usage normal et ferment la porte restée ouverte.

REVOKE EXECUTE ON FUNCTION public.get_learner_portal_data(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_learner_portal_training_details(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.learner_evaluation_course_id(text, uuid) FROM anon;
