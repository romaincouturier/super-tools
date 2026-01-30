-- Create improvements table to store accepted AI recommendations
CREATE TABLE public.improvements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  training_id UUID REFERENCES public.trainings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL, -- 'strength', 'weakness', 'recommendation'
  source_analysis_id UUID, -- Reference to keep track of which analysis generated this
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.improvements ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view improvements"
  ON public.improvements FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create improvements"
  ON public.improvements FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update improvements"
  ON public.improvements FOR UPDATE
  USING (true);

CREATE POLICY "Authenticated users can delete improvements"
  ON public.improvements FOR DELETE
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_improvements_updated_at
  BEFORE UPDATE ON public.improvements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create evaluation_analyses table to store AI analyses
CREATE TABLE public.evaluation_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
  weaknesses JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT,
  evaluations_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.evaluation_analyses ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view analyses"
  ON public.evaluation_analyses FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create analyses"
  ON public.evaluation_analyses FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete analyses"
  ON public.evaluation_analyses FOR DELETE
  USING (true);