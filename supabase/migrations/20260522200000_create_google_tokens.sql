CREATE TABLE IF NOT EXISTS google_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT google_tokens_user_id_key UNIQUE (user_id)
);
ALTER TABLE google_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON google_tokens USING (false);
