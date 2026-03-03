CREATE TABLE public.formation_formulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_config_id UUID NOT NULL REFERENCES public.formation_configs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  duree_heures NUMERIC NULL,
  prix NUMERIC NULL,
  elearning_access_email_content TEXT NULL,
  woocommerce_product_id INTEGER NULL,
  supports_url TEXT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.formation_formulas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select formation_formulas"
  ON public.formation_formulas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert formation_formulas"
  ON public.formation_formulas FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update formation_formulas"
  ON public.formation_formulas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete formation_formulas"
  ON public.formation_formulas FOR DELETE TO authenticated USING (true);