-- Book de productions module

-- Profiles
CREATE TABLE IF NOT EXISTS book_profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_url   TEXT,
  bio         TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE book_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "book_profiles_owner_all" ON book_profiles
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Albums
CREATE TABLE IF NOT EXISTS book_albums (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  cover_url   TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE book_albums ENABLE ROW LEVEL SECURITY;

CREATE POLICY "book_albums_owner_all" ON book_albums
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Productions
CREATE TABLE IF NOT EXISTS book_productions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id          UUID NOT NULL REFERENCES book_albums(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  file_url          TEXT NOT NULL,
  thumbnail_url     TEXT,
  file_type         TEXT NOT NULL CHECK (file_type IN ('image', 'video')),
  exif_date         TIMESTAMPTZ,
  exif_width        INT,
  exif_height       INT,
  original_filename TEXT,
  tags              TEXT[] NOT NULL DEFAULT '{}',
  notes             TEXT,
  sort_order        INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE book_productions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "book_productions_owner_all" ON book_productions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Share links
CREATE TABLE IF NOT EXISTS book_share_links (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id       UUID NOT NULL REFERENCES book_albums(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prospect_name  TEXT NOT NULL,
  token          UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  revoked_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE book_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "book_share_links_owner_all" ON book_share_links
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Analytics events
CREATE TABLE IF NOT EXISTS book_analytics_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id       UUID NOT NULL REFERENCES book_share_links(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL CHECK (event_type IN ('album_view', 'production_view')),
  production_id UUID REFERENCES book_productions(id) ON DELETE SET NULL,
  viewed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE book_analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "book_analytics_events_anon_insert" ON book_analytics_events
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "book_analytics_events_auth_insert" ON book_analytics_events
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "book_analytics_events_auth_select" ON book_analytics_events
  FOR SELECT TO authenticated
  USING (true);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('book-productions', 'book-productions', false)
ON CONFLICT DO NOTHING;

-- Storage RLS: owner can manage their own files only
CREATE POLICY "book_productions_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'book-productions' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "book_productions_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'book-productions' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "book_productions_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'book-productions' AND (storage.foldername(name))[1] = auth.uid()::text);
