ALTER TABLE public.mission_pages
ADD COLUMN IF NOT EXISTS is_deliverable boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_mission_pages_deliverable
ON public.mission_pages (mission_id, is_deliverable)
WHERE is_deliverable = true;