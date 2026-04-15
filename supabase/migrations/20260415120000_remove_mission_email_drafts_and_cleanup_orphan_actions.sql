-- ─────────────────────────────────────────────────────────────────────────────
-- Remove mission_email_drafts feature and clean up orphan scheduled actions.
--
-- Context:
--  • The mission "emails" tab and the testimonial drafts pipeline are no
--    longer used. The associated edge functions and frontend code have been
--    removed. We drop the table here so nothing dangles.
--  • Mission scheduling has been reworked to live ONLY on
--    `missions.waiting_next_action_date` / `waiting_next_action_text` (same
--    model as CRM cards). Previously, every scheduled action also created a
--    placeholder row in `mission_activities` with `duration = 0`. Those
--    "scheduled-but-never-completed" rows are now orphans and pollute the
--    activity feed, so we delete them.
--  • Rows with `duration = 0 AND is_billed = true` are kept: they represent
--    a historical record of a completed action and remain valid activity
--    feed entries.
--
-- The dormant `missions.testimonial_status` and `missions.testimonial_last_sent_at`
-- columns are intentionally NOT dropped: they still hold historical values
-- and removing them would be destructive without functional benefit.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Delete orphan placeholder activities that represented scheduled-but-not-done actions.
DELETE FROM mission_activities
WHERE duration = 0
  AND is_billed = false;

-- 2. Drop the mission_email_drafts table (and its dependents via CASCADE).
DROP TABLE IF EXISTS mission_email_drafts CASCADE;
