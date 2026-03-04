-- Daily actions: stores the morning TODO snapshot per user per day
-- Populated by generate-daily-actions at 7:00 AM, same data as the digest email

CREATE TABLE IF NOT EXISTS public.daily_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  link TEXT,
  entity_type TEXT,
  entity_id TEXT,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  auto_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX idx_daily_actions_user_date ON public.daily_actions(user_id, action_date);
CREATE INDEX idx_daily_actions_entity ON public.daily_actions(entity_type, entity_id);
CREATE UNIQUE INDEX idx_daily_actions_unique ON public.daily_actions(user_id, action_date, category, entity_type, entity_id);

-- RLS
ALTER TABLE public.daily_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own daily actions"
  ON public.daily_actions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily actions"
  ON public.daily_actions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all daily actions"
  ON public.daily_actions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Daily action analytics: end-of-day summaries with theme ranking
CREATE TABLE IF NOT EXISTS public.daily_action_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_date DATE NOT NULL,
  total_actions INT NOT NULL DEFAULT 0,
  completed_count INT NOT NULL DEFAULT 0,
  auto_completed_count INT NOT NULL DEFAULT 0,
  manual_completed_count INT NOT NULL DEFAULT 0,
  category_stats JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, action_date)
);

CREATE INDEX idx_daily_action_analytics_user ON public.daily_action_analytics(user_id, action_date DESC);

-- RLS
ALTER TABLE public.daily_action_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own analytics"
  ON public.daily_action_analytics FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all analytics"
  ON public.daily_action_analytics FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Cron: generate daily actions at 7:05 AM (after the digest email at 7:00)
SELECT cron.schedule(
  'generate-daily-actions',
  '5 7 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/generate-daily-actions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Cron: process daily summary at 23:00
SELECT cron.schedule(
  'process-daily-summary',
  '0 23 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/process-daily-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
