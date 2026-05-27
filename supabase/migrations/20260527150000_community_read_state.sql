CREATE TABLE IF NOT EXISTS public.community_read_state (
  user_id   uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.community_read_state ENABLE ROW LEVEL SECURITY;

-- Each authenticated user can only read/upsert their own row
CREATE POLICY "owner_select" ON public.community_read_state
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "owner_upsert" ON public.community_read_state
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
