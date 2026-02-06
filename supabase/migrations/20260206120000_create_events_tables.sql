-- Events table
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  location TEXT,
  location_type TEXT NOT NULL DEFAULT 'physical' CHECK (location_type IN ('physical', 'visio')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Event media (images and video links)
CREATE TABLE IF NOT EXISTS public.event_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('image', 'video_link')),
  mime_type TEXT,
  file_size INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS policies
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read events"
  ON public.events FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert events"
  ON public.events FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update events"
  ON public.events FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete events"
  ON public.events FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read event_media"
  ON public.event_media FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert event_media"
  ON public.event_media FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update event_media"
  ON public.event_media FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete event_media"
  ON public.event_media FOR DELETE TO authenticated USING (true);

-- Indexes
CREATE INDEX idx_events_event_date ON public.events(event_date);
CREATE INDEX idx_event_media_event_id ON public.event_media(event_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION update_events_updated_at();

-- Storage bucket for event images
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-media', 'event-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload event media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'event-media');

CREATE POLICY "Anyone can view event media"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'event-media');

CREATE POLICY "Authenticated users can delete event media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'event-media');
