-- Commentaires au niveau newsletter (discussion sur la newsletter dans son ensemble)
CREATE TABLE IF NOT EXISTS newsletter_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  newsletter_id uuid NOT NULL REFERENCES newsletters(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  content text NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_newsletter_comments_newsletter
  ON newsletter_comments(newsletter_id) WHERE NOT is_deleted;

ALTER TABLE newsletter_comments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can read newsletter_comments"
    ON newsletter_comments FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert newsletter_comments"
    ON newsletter_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authors can update own newsletter_comments"
    ON newsletter_comments FOR UPDATE TO authenticated
    USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Realtime (meme pattern que content_notifications / content_cards)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.newsletter_comments;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
