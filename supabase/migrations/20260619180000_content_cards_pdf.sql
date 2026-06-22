-- ST-2026-0197 : permettre d'attacher un document PDF de preuve à une carte de contenu.
ALTER TABLE public.content_cards
  ADD COLUMN IF NOT EXISTS pdf_url  TEXT,
  ADD COLUMN IF NOT EXISTS pdf_name TEXT;
