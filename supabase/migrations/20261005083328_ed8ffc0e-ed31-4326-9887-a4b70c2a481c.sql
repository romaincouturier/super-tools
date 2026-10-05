ALTER TABLE public.lms_work_deposits ADD COLUMN IF NOT EXISTS trainer_notify_requested_at timestamptz;
CREATE INDEX IF NOT EXISTS lms_work_deposits_notify_pending_idx ON public.lms_work_deposits (trainer_notify_requested_at) WHERE trainer_notified_at IS NULL AND trainer_notify_requested_at IS NOT NULL;

CREATE TABLE public.deposit_reaction_tokens (
  token text PRIMARY KEY,
  deposit_id uuid NOT NULL REFERENCES public.lms_work_deposits(id) ON DELETE CASCADE,
  trainer_email text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.deposit_reaction_tokens TO service_role;
ALTER TABLE public.deposit_reaction_tokens ENABLE ROW LEVEL SECURITY;