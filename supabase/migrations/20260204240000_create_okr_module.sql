-- OKR Module: Objectives, Key Results, and Initiatives

-- OKR Time targets
CREATE TYPE okr_time_target AS ENUM ('Q1', 'Q2', 'Q3', 'Q4', 'S1', 'S2', 'annual');

-- OKR Review cadence
CREATE TYPE okr_cadence AS ENUM ('weekly', 'biweekly', 'monthly', 'quarterly');

-- OKR Status
CREATE TYPE okr_status AS ENUM ('draft', 'active', 'completed', 'cancelled');

-- Main Objectives table
CREATE TABLE IF NOT EXISTS public.okr_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  time_target okr_time_target NOT NULL DEFAULT 'Q1',
  target_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  status okr_status NOT NULL DEFAULT 'draft',
  cadence okr_cadence NOT NULL DEFAULT 'monthly',
  is_favorite BOOLEAN DEFAULT false,
  favorite_position INTEGER, -- 1, 2, or 3 for the 3 favorite spots
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  confidence_level INTEGER DEFAULT 50 CHECK (confidence_level >= 0 AND confidence_level <= 100),
  owner_email TEXT,
  color TEXT DEFAULT '#3b82f6',
  position INTEGER DEFAULT 0,
  next_review_date DATE,
  next_review_agenda TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Key Results table (linked to objectives)
CREATE TABLE IF NOT EXISTS public.okr_key_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id UUID NOT NULL REFERENCES public.okr_objectives(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_value DECIMAL(12,2),
  current_value DECIMAL(12,2) DEFAULT 0,
  unit TEXT, -- e.g., '%', '€', 'clients', 'formations'
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  confidence_level INTEGER DEFAULT 50 CHECK (confidence_level >= 0 AND confidence_level <= 100),
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Initiatives table (linked to key results)
CREATE TABLE IF NOT EXISTS public.okr_initiatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_result_id UUID NOT NULL REFERENCES public.okr_key_results(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status okr_status NOT NULL DEFAULT 'draft',
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  -- Links to other modules
  linked_mission_id UUID REFERENCES public.missions(id) ON DELETE SET NULL,
  linked_training_id UUID REFERENCES public.trainings(id) ON DELETE SET NULL,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- OKR Participants (who is concerned by each OKR)
CREATE TABLE IF NOT EXISTS public.okr_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id UUID NOT NULL REFERENCES public.okr_objectives(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'contributor', -- owner, contributor, observer
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(objective_id, email)
);

-- OKR Check-ins (regular follow-ups)
CREATE TABLE IF NOT EXISTS public.okr_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id UUID NOT NULL REFERENCES public.okr_objectives(id) ON DELETE CASCADE,
  check_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
  previous_progress INTEGER,
  new_progress INTEGER,
  previous_confidence INTEGER,
  new_confidence INTEGER,
  notes TEXT,
  agenda TEXT,
  action_items TEXT,
  created_by_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- OKR Scheduled Emails (for review reminders)
CREATE TABLE IF NOT EXISTS public.okr_scheduled_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id UUID NOT NULL REFERENCES public.okr_objectives(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  email_type TEXT NOT NULL DEFAULT 'review_reminder', -- review_reminder, check_in_summary
  recipient_emails TEXT[] NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.okr_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_key_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_scheduled_emails ENABLE ROW LEVEL SECURITY;

-- RLS Policies for okr_objectives
CREATE POLICY "Allow authenticated users to view objectives" ON public.okr_objectives
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert objectives" ON public.okr_objectives
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update objectives" ON public.okr_objectives
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete objectives" ON public.okr_objectives
  FOR DELETE TO authenticated USING (true);

-- RLS Policies for okr_key_results
CREATE POLICY "Allow authenticated users to view key_results" ON public.okr_key_results
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert key_results" ON public.okr_key_results
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update key_results" ON public.okr_key_results
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete key_results" ON public.okr_key_results
  FOR DELETE TO authenticated USING (true);

-- RLS Policies for okr_initiatives
CREATE POLICY "Allow authenticated users to view initiatives" ON public.okr_initiatives
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert initiatives" ON public.okr_initiatives
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update initiatives" ON public.okr_initiatives
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete initiatives" ON public.okr_initiatives
  FOR DELETE TO authenticated USING (true);

-- RLS Policies for okr_participants
CREATE POLICY "Allow authenticated users to view participants" ON public.okr_participants
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert participants" ON public.okr_participants
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update participants" ON public.okr_participants
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete participants" ON public.okr_participants
  FOR DELETE TO authenticated USING (true);

-- RLS Policies for okr_check_ins
CREATE POLICY "Allow authenticated users to view check_ins" ON public.okr_check_ins
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert check_ins" ON public.okr_check_ins
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update check_ins" ON public.okr_check_ins
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete check_ins" ON public.okr_check_ins
  FOR DELETE TO authenticated USING (true);

-- RLS Policies for okr_scheduled_emails
CREATE POLICY "Allow authenticated users to view scheduled_emails" ON public.okr_scheduled_emails
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert scheduled_emails" ON public.okr_scheduled_emails
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update scheduled_emails" ON public.okr_scheduled_emails
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete scheduled_emails" ON public.okr_scheduled_emails
  FOR DELETE TO authenticated USING (true);

-- Indexes for performance
CREATE INDEX idx_okr_objectives_favorite ON public.okr_objectives(is_favorite) WHERE is_favorite = true;
CREATE INDEX idx_okr_objectives_status ON public.okr_objectives(status);
CREATE INDEX idx_okr_objectives_time_target ON public.okr_objectives(time_target, target_year);
CREATE INDEX idx_okr_key_results_objective ON public.okr_key_results(objective_id);
CREATE INDEX idx_okr_initiatives_key_result ON public.okr_initiatives(key_result_id);
CREATE INDEX idx_okr_initiatives_mission ON public.okr_initiatives(linked_mission_id) WHERE linked_mission_id IS NOT NULL;
CREATE INDEX idx_okr_initiatives_training ON public.okr_initiatives(linked_training_id) WHERE linked_training_id IS NOT NULL;
CREATE INDEX idx_okr_participants_objective ON public.okr_participants(objective_id);
CREATE INDEX idx_okr_check_ins_objective ON public.okr_check_ins(objective_id);
CREATE INDEX idx_okr_scheduled_emails_date ON public.okr_scheduled_emails(scheduled_date) WHERE sent_at IS NULL;

-- Trigger to update objective progress based on key results
CREATE OR REPLACE FUNCTION update_objective_progress()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.okr_objectives
  SET
    progress_percentage = COALESCE((
      SELECT AVG(progress_percentage)::INTEGER
      FROM public.okr_key_results
      WHERE objective_id = COALESCE(NEW.objective_id, OLD.objective_id)
    ), 0),
    confidence_level = COALESCE((
      SELECT AVG(confidence_level)::INTEGER
      FROM public.okr_key_results
      WHERE objective_id = COALESCE(NEW.objective_id, OLD.objective_id)
    ), 50),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.objective_id, OLD.objective_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_objective_progress
AFTER INSERT OR UPDATE OR DELETE ON public.okr_key_results
FOR EACH ROW
EXECUTE FUNCTION update_objective_progress();

-- Trigger to update key result progress based on initiatives
CREATE OR REPLACE FUNCTION update_key_result_progress()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.okr_key_results
  SET
    progress_percentage = COALESCE((
      SELECT AVG(progress_percentage)::INTEGER
      FROM public.okr_initiatives
      WHERE key_result_id = COALESCE(NEW.key_result_id, OLD.key_result_id)
    ), 0),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.key_result_id, OLD.key_result_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_key_result_progress
AFTER INSERT OR UPDATE OR DELETE ON public.okr_initiatives
FOR EACH ROW
EXECUTE FUNCTION update_key_result_progress();

-- Trigger to ensure only 3 favorites
CREATE OR REPLACE FUNCTION check_favorite_limit()
RETURNS TRIGGER AS $$
DECLARE
  favorite_count INTEGER;
BEGIN
  IF NEW.is_favorite = true THEN
    SELECT COUNT(*) INTO favorite_count
    FROM public.okr_objectives
    WHERE is_favorite = true AND id != NEW.id;

    IF favorite_count >= 3 THEN
      RAISE EXCEPTION 'Maximum of 3 favorite OKRs allowed';
    END IF;

    -- Auto-assign favorite position if not set
    IF NEW.favorite_position IS NULL THEN
      SELECT COALESCE(MAX(favorite_position), 0) + 1 INTO NEW.favorite_position
      FROM public.okr_objectives
      WHERE is_favorite = true;
    END IF;
  ELSE
    NEW.favorite_position = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_favorite_limit
BEFORE INSERT OR UPDATE ON public.okr_objectives
FOR EACH ROW
EXECUTE FUNCTION check_favorite_limit();

-- Function to calculate next review date based on cadence
CREATE OR REPLACE FUNCTION calculate_next_review_date(p_cadence okr_cadence, p_current_date DATE DEFAULT CURRENT_DATE)
RETURNS DATE AS $$
BEGIN
  RETURN CASE p_cadence
    WHEN 'weekly' THEN p_current_date + INTERVAL '7 days'
    WHEN 'biweekly' THEN p_current_date + INTERVAL '14 days'
    WHEN 'monthly' THEN p_current_date + INTERVAL '1 month'
    WHEN 'quarterly' THEN p_current_date + INTERVAL '3 months'
    ELSE p_current_date + INTERVAL '1 month'
  END;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set initial next_review_date
CREATE OR REPLACE FUNCTION set_initial_review_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.next_review_date IS NULL AND NEW.status = 'active' THEN
    NEW.next_review_date := calculate_next_review_date(NEW.cadence);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_initial_review_date
BEFORE INSERT OR UPDATE ON public.okr_objectives
FOR EACH ROW
EXECUTE FUNCTION set_initial_review_date();
