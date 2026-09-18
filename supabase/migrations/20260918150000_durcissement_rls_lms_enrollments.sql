-- auth_manage_enrollments (FOR ALL TO authenticated USING(true)), posée dans
-- 20260308224610_..., n'a jamais été retirée : un client authentifié pouvait
-- donc insérer/modifier/supprimer n'importe quelle ligne de lms_enrollments,
-- pour n'importe quel apprenant. La policy plus récente auth_learner_
-- enrollments (SELECT seul, sa propre adresse) est additive, pas un
-- remplacement — Postgres combine les policies permissives par OR.
--
-- Toute écriture doit désormais passer par une edge function en clé service
-- (create-academy-account, enroll-academy-courses), qui contourne RLS. Il ne
-- reste côté client que la lecture de ses propres inscriptions.

DROP POLICY IF EXISTS "auth_manage_enrollments" ON public.lms_enrollments;
