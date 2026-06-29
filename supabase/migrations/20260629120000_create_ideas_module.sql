-- Boîte à idées — module dédié de capture d'idées (lot 1 MVP, sans IA)
-- Voir SPEC_BOITE_A_IDEES.md

-- 1. Table principale
CREATE TABLE IF NOT EXISTS public.ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text,
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'nouvelle'
    CHECK (status IN ('nouvelle','a_l_etude','acceptee','promue','realisee','rejetee')),
  promoted_to_improvement_id uuid REFERENCES public.improvements(id) ON DELETE SET NULL,
  created_by uuid,
  org_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ideas_status_idx ON public.ideas (status);
CREATE INDEX IF NOT EXISTS ideas_created_at_idx ON public.ideas (created_at DESC);

-- 2. Votes (un vote par personne et par idée)
CREATE TABLE IF NOT EXISTS public.idea_votes (
  idea_id uuid NOT NULL REFERENCES public.ideas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (idea_id, user_id)
);

-- 3. RLS — staff (authenticated), policies par commande (pas de FOR ALL)
ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idea_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ideas_select" ON public.ideas FOR SELECT TO authenticated USING (true);
CREATE POLICY "ideas_insert" ON public.ideas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ideas_update" ON public.ideas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "ideas_delete" ON public.ideas FOR DELETE TO authenticated USING (true);

CREATE POLICY "idea_votes_select" ON public.idea_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "idea_votes_insert" ON public.idea_votes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "idea_votes_delete" ON public.idea_votes FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 4. updated_at auto
CREATE OR REPLACE FUNCTION public.set_ideas_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_ideas_updated_at ON public.ideas;
CREATE TRIGGER trg_ideas_updated_at BEFORE UPDATE ON public.ideas
  FOR EACH ROW EXECUTE FUNCTION public.set_ideas_updated_at();

-- 5. Bucket de stockage (images + PDF), 50 Mo
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ideas', 'ideas', true, 52428800,
  ARRAY['image/png','image/jpeg','image/gif','image/webp','image/heic','image/heif','application/pdf']
) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "ideas_storage_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'ideas');
CREATE POLICY "ideas_storage_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ideas');
CREATE POLICY "ideas_storage_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'ideas');
