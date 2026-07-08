
ALTER TABLE public.wp_articles
  ADD COLUMN IF NOT EXISTS popularity text CHECK (popularity IN ('forte','moyenne','faible')),
  ADD COLUMN IF NOT EXISTS internal_note text;
