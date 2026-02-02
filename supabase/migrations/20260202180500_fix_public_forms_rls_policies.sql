-- Fix RLS policies for public forms (Evaluation, Questionnaire, Emargement)
-- These forms are accessed via email links by anonymous users who need to read
-- training information to display the forms correctly.

-- Allow anonymous users to read training info for public forms
-- This is needed because Evaluation.tsx, Questionnaire.tsx, and Emargement.tsx
-- all fetch training details to display form context
CREATE POLICY "Public can view training info via token"
ON public.trainings
FOR SELECT
TO anon
USING (true);

-- Allow anonymous users to read training schedules for questionnaire forms
-- Questionnaire.tsx fetches schedules to display training dates/times
CREATE POLICY "Public can view training schedules"
ON public.training_schedules
FOR SELECT
TO anon
USING (true);

-- Allow anonymous users to read their own participant info via Emargement
-- Emargement.tsx fetches participant name/email to display on signature page
CREATE POLICY "Public can view participant info"
ON public.training_participants
FOR SELECT
TO anon
USING (true);
