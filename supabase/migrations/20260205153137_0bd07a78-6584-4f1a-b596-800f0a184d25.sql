-- Create missions table first
CREATE TABLE IF NOT EXISTS public.missions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  client_name text,
  client_contact text,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'cancelled')),
  start_date date,
  end_date date,
  daily_rate numeric,
  total_days numeric,
  total_amount numeric,
  initial_amount numeric,
  consumed_amount numeric,
  billed_amount numeric,
  tags text[] DEFAULT '{}',
  color text DEFAULT '#3b82f6',
  position integer NOT NULL DEFAULT 0,
  emoji text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view missions"
  ON public.missions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert missions"
  ON public.missions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update missions"
  ON public.missions FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete missions"
  ON public.missions FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_missions_status ON public.missions(status);
CREATE INDEX idx_missions_created_by ON public.missions(created_by);

-- Trigger for updated_at
CREATE TRIGGER update_missions_updated_at
  BEFORE UPDATE ON public.missions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Now create mission_activities table
CREATE TABLE IF NOT EXISTS public.mission_activities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  description text NOT NULL,
  activity_date date NOT NULL,
  duration_type text NOT NULL DEFAULT 'hours' CHECK (duration_type IN ('hours', 'days')),
  duration numeric NOT NULL DEFAULT 0,
  billable_amount numeric,
  invoice_url text,
  invoice_number text,
  is_billed boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.mission_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view mission activities"
  ON public.mission_activities FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert mission activities"
  ON public.mission_activities FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update mission activities"
  ON public.mission_activities FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete mission activities"
  ON public.mission_activities FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_mission_activities_mission_id ON public.mission_activities(mission_id);

-- Trigger for updated_at
CREATE TRIGGER update_mission_activities_updated_at
  BEFORE UPDATE ON public.mission_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Now create mission_pages table
CREATE TABLE IF NOT EXISTS public.mission_pages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  parent_page_id uuid REFERENCES public.mission_pages(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Sans titre',
  content text,
  icon text,
  position integer NOT NULL DEFAULT 0,
  is_expanded boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.mission_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view mission pages"
  ON public.mission_pages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert mission pages"
  ON public.mission_pages FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update mission pages"
  ON public.mission_pages FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete mission pages"
  ON public.mission_pages FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_mission_pages_mission_id ON public.mission_pages(mission_id);
CREATE INDEX idx_mission_pages_parent_id ON public.mission_pages(parent_page_id);

-- Trigger for updated_at
CREATE TRIGGER update_mission_pages_updated_at
  BEFORE UPDATE ON public.mission_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Now create mission_media table
CREATE TABLE IF NOT EXISTS public.mission_media (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('image', 'video')),
  mime_type text,
  file_size bigint,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.mission_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view mission media"
  ON public.mission_media FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert mission media"
  ON public.mission_media FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update mission media"
  ON public.mission_media FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete mission media"
  ON public.mission_media FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_mission_media_mission_id ON public.mission_media(mission_id);

-- Storage bucket for mission media (photos + videos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mission-media',
  'mission-media',
  true,
  52428800,
  ARRAY[
    'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp',
    'image/heic', 'image/heif',
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "mission_media_select"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'mission-media');

CREATE POLICY "mission_media_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mission-media');

CREATE POLICY "mission_media_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'mission-media')
  WITH CHECK (bucket_id = 'mission-media');

CREATE POLICY "mission_media_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'mission-media');