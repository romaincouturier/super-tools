-- Add tracking for evaluation summary sent to sponsor
ALTER TABLE public.trainings
ADD COLUMN IF NOT EXISTS evaluation_summary_sent_at TIMESTAMPTZ;

-- Comment for documentation
COMMENT ON COLUMN public.trainings.evaluation_summary_sent_at IS 'Timestamp when evaluation summary was sent to sponsor';
