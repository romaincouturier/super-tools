-- Feature usage tracking table
-- Tracks user interactions with product features to measure adoption and identify unused features
CREATE TABLE IF NOT EXISTS feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  feature_name TEXT NOT NULL,
  feature_category TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying usage by feature
CREATE INDEX idx_feature_usage_feature_name ON feature_usage (feature_name);

-- Index for querying usage by category
CREATE INDEX idx_feature_usage_category ON feature_usage (feature_category);

-- Index for time-based queries
CREATE INDEX idx_feature_usage_created_at ON feature_usage (created_at DESC);

-- Composite index for reporting: feature + time range
CREATE INDEX idx_feature_usage_feature_time ON feature_usage (feature_name, created_at DESC);

-- Enable RLS
ALTER TABLE feature_usage ENABLE ROW LEVEL SECURITY;

-- Users can insert their own usage events
CREATE POLICY "Users can insert own usage events"
  ON feature_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own usage events (for potential future dashboard)
CREATE POLICY "Users can read own usage events"
  ON feature_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can read all (for admin analytics)
-- Note: service_role bypasses RLS by default
