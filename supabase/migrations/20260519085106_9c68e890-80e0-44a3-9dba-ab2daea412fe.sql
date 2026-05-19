ALTER TABLE public.devis_signatures
  ADD COLUMN IF NOT EXISTS crm_card_id UUID REFERENCES public.crm_cards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS training_id UUID REFERENCES public.trainings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_devis_signatures_crm_card ON public.devis_signatures(crm_card_id);
CREATE INDEX IF NOT EXISTS idx_devis_signatures_training ON public.devis_signatures(training_id);