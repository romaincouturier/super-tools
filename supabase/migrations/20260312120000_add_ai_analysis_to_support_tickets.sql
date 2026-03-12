-- Add AI analysis JSONB column to support_tickets
-- Stores the structured analysis produced by AI on ticket creation:
--   For bugs:      { type, title, priority, constat, reproduction, situation_desiree, procedure_test }
--   For evolutions: { type, title, priority, user_stories, criteres_acceptation, impact_produit }
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS ai_analysis JSONB;

COMMENT ON COLUMN public.support_tickets.ai_analysis IS 'Structured AI analysis generated at ticket creation';
