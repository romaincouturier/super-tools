ALTER TABLE public.crm_cards
ADD COLUMN IF NOT EXISTS source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_crm_cards_source_metadata
  ON public.crm_cards USING GIN (source_metadata);