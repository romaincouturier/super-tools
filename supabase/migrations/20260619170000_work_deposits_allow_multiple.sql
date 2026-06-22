-- Autorise plusieurs dépôts de travail par leçon et par apprenant.
-- La contrainte d'unicité forçait un dépôt unique (donc l'écrasement).
ALTER TABLE public.lms_work_deposits
  DROP CONSTRAINT IF EXISTS lms_work_deposits_lesson_id_learner_email_key;
