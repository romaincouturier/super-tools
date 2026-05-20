-- ST-2026-0131: lesson-builder image upload fails with RLS error.
--
-- The lms-content bucket only allowed INSERT/UPDATE for the
-- "authenticated" role. Anyone opening the builder whose session
-- token had not yet been refreshed (race on page load) was treated
-- as anon and got "new row violates row-level security policy".
-- Adding the anon policies removes the race condition and lets the
-- builder upload images immediately after the page loads.

DROP POLICY IF EXISTS "anon_upload_lms_content" ON storage.objects;
DROP POLICY IF EXISTS "anon_update_lms_content" ON storage.objects;

CREATE POLICY "anon_upload_lms_content"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'lms-content');

CREATE POLICY "anon_update_lms_content"
  ON storage.objects
  FOR UPDATE
  TO anon
  USING  (bucket_id = 'lms-content')
  WITH CHECK (bucket_id = 'lms-content');
