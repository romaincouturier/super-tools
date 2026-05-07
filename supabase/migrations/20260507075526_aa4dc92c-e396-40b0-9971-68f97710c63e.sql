
ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_status_check;

UPDATE public.support_tickets SET status = 'vibe_coding' WHERE status = 'en_cours';
UPDATE public.support_tickets SET status = 'qualification' WHERE status = 'en_attente';
UPDATE public.support_tickets SET status = 'resolu' WHERE status = 'ferme';

ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_status_check
  CHECK (status = ANY (ARRAY['nouveau'::text, 'qualification'::text, 'vibe_coding'::text, 'resolu'::text]));

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS discussion_requested_at timestamptz;
