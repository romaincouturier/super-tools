-- ─────────────────────────────────────────────────────────────────────────────
-- Restore mission_email_drafts feature.
--
-- The table was dropped in migration 20260415120000 when the "Emails" tab
-- was removed from MissionDetailDrawer. We're bringing back the underlying
-- draft workflow because the business need (automated testimonial requests
-- reviewed by the communication manager before sending) is still there.
--
-- The UI moves from a per-mission tab (which nobody discovered) to a
-- dedicated `/emails-a-valider` page surfaced via the daily actions of
-- the communication manager.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mission_email_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  email_type text NOT NULL,  -- 'google_review' | 'video_testimonial'
  contact_email text NOT NULL,
  contact_name text,
  subject text NOT NULL,
  html_content text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'scheduled', 'sent', 'rejected')),
  scheduled_for timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mission_email_drafts_status
  ON public.mission_email_drafts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mission_email_drafts_mission
  ON public.mission_email_drafts(mission_id);

ALTER TABLE public.mission_email_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mission_email_drafts_select" ON public.mission_email_drafts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "mission_email_drafts_insert" ON public.mission_email_drafts
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "mission_email_drafts_update" ON public.mission_email_drafts
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "mission_email_drafts_service" ON public.mission_email_drafts
  FOR ALL TO service_role USING (true) WITH CHECK (true);
