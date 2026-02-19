-- Add missing columns to formation_configs (added by recent PRs)
ALTER TABLE public.formation_configs
  ADD COLUMN IF NOT EXISTS objectives text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS prerequisites text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS supports_url text,
  ADD COLUMN IF NOT EXISTS elearning_duration numeric,
  ADD COLUMN IF NOT EXISTS elearning_access_email_content text,
  ADD COLUMN IF NOT EXISTS supertilt_link text,
  ADD COLUMN IF NOT EXISTS woocommerce_product_id integer,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Add missing catalog_id column to trainings
ALTER TABLE public.trainings
  ADD COLUMN IF NOT EXISTS catalog_id uuid REFERENCES public.formation_configs(id);