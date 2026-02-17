-- Add notes column to training_participants
ALTER TABLE training_participants
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create participant_files table for free file uploads
CREATE TABLE IF NOT EXISTS participant_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES training_participants(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE participant_files ENABLE ROW LEVEL SECURITY;

-- RLS policies for participant_files (same pattern as training_participants)
CREATE POLICY "Authenticated users can view participant files"
  ON participant_files FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert participant files"
  ON participant_files FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update participant files"
  ON participant_files FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete participant files"
  ON participant_files FOR DELETE
  TO authenticated
  USING (true);
