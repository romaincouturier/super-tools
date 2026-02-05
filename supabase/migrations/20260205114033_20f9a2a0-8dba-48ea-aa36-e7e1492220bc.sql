-- Create OKR Objectives table
CREATE TABLE public.okr_objectives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  time_target TEXT NOT NULL DEFAULT 'Q1' CHECK (time_target IN ('Q1', 'Q2', 'Q3', 'Q4', 'S1', 'S2', 'annual')),
  target_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  cadence TEXT NOT NULL DEFAULT 'monthly' CHECK (cadence IN ('weekly', 'biweekly', 'monthly', 'quarterly')),
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  favorite_position INTEGER,
  progress_percentage INTEGER NOT NULL DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  confidence_level INTEGER NOT NULL DEFAULT 50 CHECK (confidence_level >= 0 AND confidence_level <= 100),
  owner_email TEXT,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  position INTEGER NOT NULL DEFAULT 0,
  next_review_date TIMESTAMPTZ,
  next_review_agenda TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create OKR Key Results table
CREATE TABLE public.okr_key_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  objective_id UUID NOT NULL REFERENCES public.okr_objectives(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_value NUMERIC,
  current_value NUMERIC NOT NULL DEFAULT 0,
  unit TEXT,
  progress_percentage INTEGER NOT NULL DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  confidence_level INTEGER NOT NULL DEFAULT 50 CHECK (confidence_level >= 0 AND confidence_level <= 100),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create OKR Initiatives table (without FK references to missions/trainings for now)
CREATE TABLE public.okr_initiatives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key_result_id UUID NOT NULL REFERENCES public.okr_key_results(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  progress_percentage INTEGER NOT NULL DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  linked_mission_id UUID,
  linked_training_id UUID,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create OKR Participants table
CREATE TABLE public.okr_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  objective_id UUID NOT NULL REFERENCES public.okr_objectives(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'contributor' CHECK (role IN ('owner', 'contributor', 'observer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(objective_id, email)
);

-- Create OKR Check-ins table
CREATE TABLE public.okr_check_ins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  objective_id UUID NOT NULL REFERENCES public.okr_objectives(id) ON DELETE CASCADE,
  check_in_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  previous_progress INTEGER,
  new_progress INTEGER,
  previous_confidence INTEGER,
  new_confidence INTEGER,
  notes TEXT,
  agenda TEXT,
  action_items TEXT,
  created_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.okr_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_key_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_check_ins ENABLE ROW LEVEL SECURITY;

-- RLS policies for okr_objectives
CREATE POLICY "Authenticated users can view OKR objectives"
  ON public.okr_objectives FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert OKR objectives"
  ON public.okr_objectives FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update OKR objectives"
  ON public.okr_objectives FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete OKR objectives"
  ON public.okr_objectives FOR DELETE
  USING (auth.role() = 'authenticated');

-- RLS policies for okr_key_results
CREATE POLICY "Authenticated users can view OKR key results"
  ON public.okr_key_results FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert OKR key results"
  ON public.okr_key_results FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update OKR key results"
  ON public.okr_key_results FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete OKR key results"
  ON public.okr_key_results FOR DELETE
  USING (auth.role() = 'authenticated');

-- RLS policies for okr_initiatives
CREATE POLICY "Authenticated users can view OKR initiatives"
  ON public.okr_initiatives FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert OKR initiatives"
  ON public.okr_initiatives FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update OKR initiatives"
  ON public.okr_initiatives FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete OKR initiatives"
  ON public.okr_initiatives FOR DELETE
  USING (auth.role() = 'authenticated');

-- RLS policies for okr_participants
CREATE POLICY "Authenticated users can view OKR participants"
  ON public.okr_participants FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert OKR participants"
  ON public.okr_participants FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update OKR participants"
  ON public.okr_participants FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete OKR participants"
  ON public.okr_participants FOR DELETE
  USING (auth.role() = 'authenticated');

-- RLS policies for okr_check_ins
CREATE POLICY "Authenticated users can view OKR check-ins"
  ON public.okr_check_ins FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert OKR check-ins"
  ON public.okr_check_ins FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update OKR check-ins"
  ON public.okr_check_ins FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete OKR check-ins"
  ON public.okr_check_ins FOR DELETE
  USING (auth.role() = 'authenticated');

-- Create updated_at triggers
CREATE TRIGGER update_okr_objectives_updated_at
  BEFORE UPDATE ON public.okr_objectives
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_okr_key_results_updated_at
  BEFORE UPDATE ON public.okr_key_results
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_okr_initiatives_updated_at
  BEFORE UPDATE ON public.okr_initiatives
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_okr_objectives_target_year ON public.okr_objectives(target_year);
CREATE INDEX idx_okr_objectives_status ON public.okr_objectives(status);
CREATE INDEX idx_okr_objectives_is_favorite ON public.okr_objectives(is_favorite);
CREATE INDEX idx_okr_key_results_objective_id ON public.okr_key_results(objective_id);
CREATE INDEX idx_okr_initiatives_key_result_id ON public.okr_initiatives(key_result_id);
CREATE INDEX idx_okr_participants_objective_id ON public.okr_participants(objective_id);
CREATE INDEX idx_okr_check_ins_objective_id ON public.okr_check_ins(objective_id);