-- Create trainer_attendance_signatures table for trainer signing per slot
CREATE TABLE IF NOT EXISTS trainer_attendance_signatures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  training_id UUID NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  schedule_date DATE NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('AM', 'PM')),
  signature_data TEXT,
  signed_at TIMESTAMPTZ,
  trainer_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(training_id, schedule_date, period)
);

-- Enable RLS
ALTER TABLE trainer_attendance_signatures ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage trainer signatures
CREATE POLICY "Authenticated users can manage trainer signatures"
  ON trainer_attendance_signatures FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
