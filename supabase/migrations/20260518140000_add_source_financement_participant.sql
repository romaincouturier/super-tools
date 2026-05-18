ALTER TABLE training_participants
  ADD COLUMN IF NOT EXISTS source_financement_bpf TEXT;
