CREATE TABLE public.testimonials (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  drive_file_id   TEXT        NOT NULL UNIQUE,
  client_name     TEXT,
  company         TEXT,
  service_type    TEXT,
  raw_transcript  TEXT,
  reviewer_notes  TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending_review'
                              CHECK (status IN ('pending_review', 'published', 'rejected')),
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage testimonials"
  ON public.testimonials FOR ALL TO authenticated USING (true);

CREATE TRIGGER testimonials_updated_at
  BEFORE UPDATE ON public.testimonials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
