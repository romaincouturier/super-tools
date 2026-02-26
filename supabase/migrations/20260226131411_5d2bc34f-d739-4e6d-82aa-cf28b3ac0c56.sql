
-- 1. Add format_formation to formation_configs catalog
ALTER TABLE public.formation_configs ADD COLUMN IF NOT EXISTS format_formation text;

-- 2. Add catalog_id FK to post_evaluation_emails
ALTER TABLE public.post_evaluation_emails ADD COLUMN IF NOT EXISTS catalog_id uuid REFERENCES public.formation_configs(id);

-- 3. Migrate existing post_evaluation_emails data: match training_filter to catalog entries
UPDATE public.post_evaluation_emails pe
SET catalog_id = (
  SELECT fc.id FROM public.formation_configs fc
  WHERE LOWER(fc.formation_name) LIKE '%' || LOWER(TRIM(pe.training_filter)) || '%'
  LIMIT 1
)
WHERE pe.catalog_id IS NULL AND pe.training_filter IS NOT NULL AND pe.training_filter != '';

-- 4. Drop old training_filter column
ALTER TABLE public.post_evaluation_emails DROP COLUMN IF EXISTS training_filter;
