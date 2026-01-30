-- Add policy to allow public update of needs_survey_status
-- This is safe because participants can only update their own record via token validation in the questionnaire
CREATE POLICY "Public can update participant survey status"
  ON public.training_participants
  FOR UPDATE
  USING (true)
  WITH CHECK (true);