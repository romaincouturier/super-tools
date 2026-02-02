-- Create table for scheduled training actions/reminders
CREATE TABLE public.training_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  due_date DATE NOT NULL,
  assigned_user_email TEXT NOT NULL,
  assigned_user_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed', 'cancelled')),
  reminder_sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.training_actions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all training actions
CREATE POLICY "Authenticated users can view training actions"
  ON public.training_actions
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to create training actions
CREATE POLICY "Authenticated users can create training actions"
  ON public.training_actions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update training actions
CREATE POLICY "Authenticated users can update training actions"
  ON public.training_actions
  FOR UPDATE
  TO authenticated
  USING (true);

-- Allow authenticated users to delete training actions
CREATE POLICY "Authenticated users can delete training actions"
  ON public.training_actions
  FOR DELETE
  TO authenticated
  USING (true);

-- Create index for efficient queries
CREATE INDEX idx_training_actions_training_id ON public.training_actions(training_id);
CREATE INDEX idx_training_actions_due_date ON public.training_actions(due_date);
CREATE INDEX idx_training_actions_status ON public.training_actions(status);