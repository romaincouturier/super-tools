-- ST-2026-0235 — Métadonnées d'organisation du backoffice LMS.
-- Réutilise la colonne status existante (draft/published/archived) en y ajoutant
-- la valeur to_review ("À vérifier"). Ajoute expertise et access_type.

ALTER TABLE public.lms_courses
  ADD COLUMN IF NOT EXISTS expertise TEXT,
  ADD COLUMN IF NOT EXISTS access_type TEXT NOT NULL DEFAULT 'gratuit';

-- Backfill : un cours rattaché à une organisation cliente est considéré intra.
UPDATE public.lms_courses SET access_type = 'intra' WHERE org_id IS NOT NULL;

-- Normalise les statuts inattendus avant pose de la contrainte.
UPDATE public.lms_courses
SET status = 'draft'
WHERE status NOT IN ('draft', 'published', 'to_review', 'archived');

DO $$
BEGIN
  ALTER TABLE public.lms_courses
    ADD CONSTRAINT lms_courses_expertise_check
    CHECK (expertise IS NULL OR expertise IN (
      'facilitation_graphique',
      'intelligence_collective',
      'agilite',
      'ia',
      'jeux_outils',
      'ressources_gratuites',
      'intra_clients'
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.lms_courses
    ADD CONSTRAINT lms_courses_access_type_check
    CHECK (access_type IN ('gratuit', 'payant', 'intra'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.lms_courses
    ADD CONSTRAINT lms_courses_status_check
    CHECK (status IN ('draft', 'published', 'to_review', 'archived'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
