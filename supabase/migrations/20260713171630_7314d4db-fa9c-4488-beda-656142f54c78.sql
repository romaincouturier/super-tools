
CREATE TABLE IF NOT EXISTS public.google_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_tokens TO authenticated;
GRANT ALL ON public.google_tokens TO service_role;

ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own google tokens"
ON public.google_tokens FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER google_tokens_set_updated_at
BEFORE UPDATE ON public.google_tokens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Migrer les tokens Drive existants (best effort)
INSERT INTO public.google_tokens (user_id, access_token, refresh_token, token_expires_at)
SELECT user_id, access_token, refresh_token, token_expires_at
FROM public.google_drive_tokens
ON CONFLICT (user_id) DO NOTHING;
