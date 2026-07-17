-- Feedback visuel du pipeline auto-coding sur les tickets support.
-- coding_status suit le cycle : queued (dispatch envoyé) -> running (workflow
-- démarré) -> done (branche/PR poussée) | error (échec, détail dans coding_error).
-- NULL = aucun traitement en cours (état par défaut, ou questions posées).

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS coding_status text
    CHECK (coding_status IN ('queued', 'running', 'done', 'error')),
  ADD COLUMN IF NOT EXISTS coding_error text;
