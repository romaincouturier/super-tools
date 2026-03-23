-- Create storage bucket for daily app screenshots
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'app-screenshots',
  'app-screenshots',
  true,
  5242880, -- 5MB per screenshot
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access (screenshots are not sensitive)
CREATE POLICY "Public read access for app-screenshots"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'app-screenshots');

-- Allow service-role uploads (the GitHub Action uses service role key)
-- No INSERT policy needed for service role as it bypasses RLS
