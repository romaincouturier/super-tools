-- Mission Activities: Track time and billing for each mission
CREATE TABLE IF NOT EXISTS public.mission_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_type TEXT NOT NULL DEFAULT 'hours' CHECK (duration_type IN ('hours', 'days')),
  duration DECIMAL(10,2) NOT NULL DEFAULT 0,
  billable_amount DECIMAL(12,2),
  invoice_url TEXT,
  invoice_number TEXT,
  is_billed BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Mission Pages: Notion-like nested pages for each mission
CREATE TABLE IF NOT EXISTS public.mission_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  parent_page_id UUID REFERENCES public.mission_pages(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Sans titre',
  content TEXT,
  icon TEXT,
  position INTEGER DEFAULT 0,
  is_expanded BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Add financial tracking columns to missions
ALTER TABLE public.missions
ADD COLUMN IF NOT EXISTS initial_amount DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS consumed_amount DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS billed_amount DECIMAL(12,2) DEFAULT 0;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_mission_activities_mission_id ON public.mission_activities(mission_id);
CREATE INDEX IF NOT EXISTS idx_mission_activities_date ON public.mission_activities(activity_date);
CREATE INDEX IF NOT EXISTS idx_mission_pages_mission_id ON public.mission_pages(mission_id);
CREATE INDEX IF NOT EXISTS idx_mission_pages_parent_id ON public.mission_pages(parent_page_id);

-- Enable RLS
ALTER TABLE public.mission_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_pages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for mission_activities
CREATE POLICY "Authenticated users can view mission activities"
ON public.mission_activities FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create mission activities"
ON public.mission_activities FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update mission activities"
ON public.mission_activities FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete mission activities"
ON public.mission_activities FOR DELETE TO authenticated
USING (true);

-- RLS Policies for mission_pages
CREATE POLICY "Authenticated users can view mission pages"
ON public.mission_pages FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create mission pages"
ON public.mission_pages FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update mission pages"
ON public.mission_pages FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete mission pages"
ON public.mission_pages FOR DELETE TO authenticated
USING (true);

-- Trigger to update missions consumed/billed amounts
CREATE OR REPLACE FUNCTION update_mission_amounts()
RETURNS TRIGGER AS $$
BEGIN
  -- Update consumed_amount (sum of all activity billable amounts)
  UPDATE public.missions
  SET
    consumed_amount = COALESCE((
      SELECT SUM(billable_amount)
      FROM public.mission_activities
      WHERE mission_id = COALESCE(NEW.mission_id, OLD.mission_id)
    ), 0),
    billed_amount = COALESCE((
      SELECT SUM(billable_amount)
      FROM public.mission_activities
      WHERE mission_id = COALESCE(NEW.mission_id, OLD.mission_id)
      AND is_billed = true
    ), 0),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.mission_id, OLD.mission_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_mission_amounts ON public.mission_activities;
CREATE TRIGGER trigger_update_mission_amounts
AFTER INSERT OR UPDATE OR DELETE ON public.mission_activities
FOR EACH ROW EXECUTE FUNCTION update_mission_amounts();

-- Add updated_at trigger for mission_activities
CREATE TRIGGER update_mission_activities_updated_at
BEFORE UPDATE ON public.mission_activities
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add updated_at trigger for mission_pages
CREATE TRIGGER update_mission_pages_updated_at
BEFORE UPDATE ON public.mission_pages
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE public.mission_activities IS 'Time and billing tracking for missions';
COMMENT ON TABLE public.mission_pages IS 'Notion-like nested pages for mission documentation';
COMMENT ON COLUMN public.missions.initial_amount IS 'Initial contracted amount for the mission';
COMMENT ON COLUMN public.missions.consumed_amount IS 'Sum of all activity billable amounts';
COMMENT ON COLUMN public.missions.billed_amount IS 'Sum of billed activity amounts';
