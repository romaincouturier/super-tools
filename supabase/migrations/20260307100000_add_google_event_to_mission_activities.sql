-- Add Google Calendar event link to mission activities
ALTER TABLE mission_activities
  ADD COLUMN IF NOT EXISTS google_event_id TEXT,
  ADD COLUMN IF NOT EXISTS google_event_link TEXT;

-- Index for dedup on import
CREATE INDEX IF NOT EXISTS idx_mission_activities_google_event_id
  ON mission_activities (google_event_id)
  WHERE google_event_id IS NOT NULL;
