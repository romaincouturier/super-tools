-- Fix CRITICAL: coaching_bookings - replace overly permissive anon ALL with scoped SELECT + INSERT
DROP POLICY IF EXISTS "anon_manage_coaching_bookings" ON public.coaching_bookings;

-- Anon can SELECT bookings (learner portal reads by participant_id/training_id)
CREATE POLICY "anon_select_coaching_bookings"
  ON public.coaching_bookings FOR SELECT
  TO anon
  USING (true);

-- Anon can INSERT new bookings (learner portal creates reservations)
CREATE POLICY "anon_insert_coaching_bookings"
  ON public.coaching_bookings FOR INSERT
  TO anon
  WITH CHECK (true);

-- Fix CRITICAL: lms_forum_posts - remove anon access (only used by authenticated users)
DROP POLICY IF EXISTS "anon_manage_forum_posts" ON public.lms_forum_posts;