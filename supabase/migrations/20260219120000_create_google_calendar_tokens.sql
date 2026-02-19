-- Google Calendar tokens table (mirrors google_drive_tokens structure)
CREATE TABLE IF NOT EXISTS public.google_calendar_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS policies
ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own calendar tokens"
  ON public.google_calendar_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calendar tokens"
  ON public.google_calendar_tokens FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar tokens"
  ON public.google_calendar_tokens FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar tokens"
  ON public.google_calendar_tokens FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role access for edge functions
CREATE POLICY "Service role full access on calendar tokens"
  ON public.google_calendar_tokens FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
