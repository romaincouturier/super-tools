-- ============================================================
-- Agent feedback: store thumbs up/down on agent responses
-- Used to identify bad answers and improve the system prompt
-- ============================================================

CREATE TABLE IF NOT EXISTS public.agent_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.agent_conversations(id) ON DELETE SET NULL,
  rating text NOT NULL CHECK (rating IN ('up', 'down')),
  user_prompt text NOT NULL,
  assistant_response text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_feedback_user ON public.agent_feedback(user_id, created_at DESC);
CREATE INDEX idx_agent_feedback_rating ON public.agent_feedback(rating, created_at DESC);

ALTER TABLE public.agent_feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert and read their own feedback
CREATE POLICY "agent_feedback_insert_own" ON public.agent_feedback
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "agent_feedback_select_own" ON public.agent_feedback
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Service role can read all (for admin analysis)
CREATE POLICY "agent_feedback_service_all" ON public.agent_feedback
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
