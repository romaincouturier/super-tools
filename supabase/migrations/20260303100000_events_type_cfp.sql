-- ===========================================
-- Événements: type interne/externe + CFP
-- ===========================================

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'internal' CHECK (event_type IN ('internal', 'external'));

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS cfp_deadline DATE;

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS event_url TEXT;

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS cfp_url TEXT;
